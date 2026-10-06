import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminInitialized, getAdminAuth, getAdminDb } from '@/lib/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { consumeRulesAssistantQuota, type QuotaDenial } from '@/lib/rules-assistant-quota';
import { numberRules, sortRuleSections, type NumberedRule, type RuleSection } from '@/lib/rules-numbering';
import {
  ANSWER_RESPONSE_SCHEMA,
  MAX_QUESTION_CHARS,
  buildSystemInstruction,
  resolveAnswer,
  sanitizeHistory,
} from '@/lib/rules-assistant';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const RULES_CACHE_MS = 60 * 1000;

const rulesCache = new Map<string, { at: number; name: string; rules: NumberedRule[] }>();

/** Rulebook as the rules page shows it, read server-side so the prompt can't be tampered with. */
async function loadRulebook(tournamentId: string): Promise<{ name: string; rules: NumberedRule[] } | null> {
  const cached = rulesCache.get(tournamentId);
  if (cached && Date.now() - cached.at < RULES_CACHE_MS) return cached;

  const db = getAdminDb();
  const tournamentRef = db.collection('tournaments').doc(tournamentId);
  const [tournamentSnap, rulesSnap] = await Promise.all([tournamentRef.get(), tournamentRef.collection('rules').get()]);
  if (!tournamentSnap.exists) return null;

  const sections: RuleSection[] = await Promise.all(rulesSnap.docs.map(async sectionDoc => {
    const paragraphsSnap = await sectionDoc.ref.collection('paragraphs').get();
    return {
      id: sectionDoc.id,
      title: sectionDoc.data().title || '',
      order: sectionDoc.data().order || 0,
      paragraphs: paragraphsSnap.docs.map(p => ({
        id: p.id,
        content: p.data().content || '',
        commentary: p.data().commentary || undefined,
        order: p.data().order || 0,
        parentId: p.data().parentId || undefined,
      })),
    };
  }));

  const entry = { at: Date.now(), name: tournamentSnap.data()?.name || 'Turniej', rules: numberRules(sortRuleSections(sections)) };
  rulesCache.set(tournamentId, entry);
  return entry;
}

/**
 * Sign-in is required: limits are per account. IP-based limits don't work here — requests
 * via dota2inhouse.pl arrive through the community site's Vercel rewrite, so the client IP
 * we see is Vercel's and every anonymous visitor would share one bucket.
 */
async function getCallerUid(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    ensureAdminInitialized();
    return (await getAdminAuth().verifyIdToken(authHeader.slice('Bearer '.length))).uid;
  } catch {
    return null;
  }
}

const DENIAL_MESSAGES: Record<QuotaDenial, string> = {
  user_hour: 'Wykorzystałeś limit pytań na tę godzinę. Spróbuj ponownie później.',
  user_day: 'Wykorzystałeś dzisiejszy limit pytań. Wróć jutro lub zapytaj adminów na Discordzie.',
  global_minute: 'Asystent jest teraz mocno obciążony. Spróbuj ponownie za chwilę.',
  global_day: 'Asystent wyczerpał dzisiejszy limit zapytań. Wróć jutro lub zapytaj adminów na Discordzie.',
};

/** GET /api/rules-assistant — whether the assistant is configured (the widget hides itself otherwise). */
export async function GET() {
  return NextResponse.json({ enabled: !!GEMINI_API_KEY });
}

/**
 * POST /api/rules-assistant
 * Body: { tournamentId: string, question: string, history?: { role: 'user'|'assistant', text: string }[] }
 * Requires Authorization: Bearer <Firebase ID token>.
 */
export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: 'Asystent regulaminu nie jest skonfigurowany.' }, { status: 503 });
  }

  const uid = await getCallerUid(request);
  if (!uid) {
    return NextResponse.json({ error: 'Zaloguj się, aby zadać pytanie.', reason: 'signin_required' }, { status: 401 });
  }

  // Cheap per-instance burst guard before touching Firestore (keyed by uid — the IP part is shared via Vercel)
  const burst = checkRateLimit(request, `rules-assistant:${uid}`, {
    limit: 4,
    windowMs: 20 * 1000,
    message: 'Za dużo pytań naraz. Odczekaj chwilę.',
  });
  if (burst) return burst;

  try {
    const body = await request.json().catch(() => null);
    const tournamentId = typeof body?.tournamentId === 'string' ? body.tournamentId : '';
    const question = typeof body?.question === 'string' ? body.question.trim() : '';
    if (!tournamentId || !/^[\w-]{1,128}$/.test(tournamentId)) {
      return NextResponse.json({ error: 'Nieprawidłowy turniej.' }, { status: 400 });
    }
    if (!question || question.length > MAX_QUESTION_CHARS) {
      return NextResponse.json({ error: `Pytanie musi mieć od 1 do ${MAX_QUESTION_CHARS} znaków.` }, { status: 400 });
    }

    ensureAdminInitialized();
    const rulebook = await loadRulebook(tournamentId);
    if (!rulebook) return NextResponse.json({ error: 'Nie znaleziono turnieju.' }, { status: 404 });
    if (rulebook.rules.length === 0) {
      return NextResponse.json({ error: 'Ten turniej nie ma jeszcze regulaminu.' }, { status: 404 });
    }

    const quota = await consumeRulesAssistantQuota(uid);
    if (!quota.allowed) {
      return NextResponse.json(
        { error: DENIAL_MESSAGES[quota.reason], reason: quota.reason, retryAfter: quota.retryAfterSec },
        { status: 429, headers: { 'Retry-After': String(quota.retryAfterSec) } }
      );
    }

    const history = sanitizeHistory(body?.history);
    const contents = [...history, { role: 'user' as const, text: question }].map(turn => ({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.text }],
    }));

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: buildSystemInstruction(rulebook.name, rulebook.rules) }] },
          contents,
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema: ANSWER_RESPONSE_SCHEMA,
          },
        }),
        signal: AbortSignal.timeout(30_000),
      }
    );

    if (!geminiRes.ok) {
      const detail = await geminiRes.text().catch(() => '');
      console.error(`[rules-assistant] Gemini ${geminiRes.status}:`, detail.slice(0, 500));
      if (geminiRes.status === 429) {
        return NextResponse.json(
          { error: DENIAL_MESSAGES.global_minute, reason: 'global_minute', retryAfter: 60 },
          { status: 429, headers: { 'Retry-After': '60' } }
        );
      }
      return NextResponse.json({ error: 'Asystent jest chwilowo niedostępny. Spróbuj ponownie później.' }, { status: 502 });
    }

    const data = await geminiRes.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? '')
      .join('');
    let parsed: unknown = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { /* handled below */ }

    const answer = resolveAnswer(parsed, rulebook.rules);
    if (!answer) {
      console.error('[rules-assistant] Unusable model output:', data?.candidates?.[0]?.finishReason, text?.slice(0, 300));
      return NextResponse.json({ error: 'Nie udało się przygotować odpowiedzi. Spróbuj zadać pytanie inaczej.' }, { status: 502 });
    }

    return NextResponse.json({ ...answer, remainingToday: quota.remainingToday });
  } catch (error) {
    console.error('[rules-assistant] Error:', error);
    return NextResponse.json({ error: 'Asystent jest chwilowo niedostępny. Spróbuj ponownie później.' }, { status: 500 });
  }
}
