'use client';

// One match, opened beside the match list on the account page: who and when, the draft penalties,
// the date (propose / answer / withdraw a change), the coach, standins both ways and how to get into
// the lobby. Same actions and rules as the old my-team match card, laid out on rules instead of boxes.

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ClipboardList, Gavel, Loader2, RefreshCw, X } from 'lucide-react';
import { useTournament } from '@/context/TournamentContext';
import { DateInput } from '@/components/ui/date-time-input';
import { cn } from '@/lib/utils';
import { C, TeamLogo, Tip, TipBody, ink, useHeaderFont } from '@/components/stats-lab/kit';
import { DRAFT_PENALTY_LEVELS, type Match } from '@/lib/definitions';
import { extraTag } from '@/lib/match-flags';
import { checkReschedule, reschedulePolicy } from '@/lib/reschedule-rules';
import { count } from '@/lib/plural';
import { useOpenMatchPrep } from '@/components/draft-prep/open';
import { getPublicBotInfo, type PublicBotInfo } from '@/lib/bot/bot-config-actions';
import { MatchDetailModal } from '@/components/divisions/MatchDetailModal';
import { PDLStandinRequestSection } from '@/components/pdl/my-team/PDLStandinRequest';
import { PDLCoachSection } from '@/components/pdl/my-team/PDLCoachSection';
import type { PDLUpcomingMatchProps } from '@/components/pdl/my-team/PDLUpcomingMatchNew';
import { Act, Label, Solid, T, fieldClass as field, seriesScore } from './ui';

const longDate = (iso: string) => new Date(iso).toLocaleString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const normalizeTime = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 4); return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`; };

export function MatchPanel(p: PDLUpcomingMatchProps) {
  const { match, myTeamId, isCaptain, teams = [] } = p;
  const font = useHeaderFont();
  const openPrep = useOpenMatchPrep();
  const [details, setDetails] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [proposing, setProposing] = useState(false);
  const canPropose = isCaptain && !(match.status === 'completed') && match.rescheduleRequest?.status !== 'pending';

  const isTeamA = match.teamA?.id === myTeamId;
  const opponent = isTeamA ? match.teamB : match.teamA;
  const oppTeam = teams.find(t => t.id === opponent?.id);
  const done = match.status === 'completed';
  const score = done ? seriesScore(match, myTeamId) : null;
  // Games in the series (the bot's fallback: group → bo2, playoff → bo3)
  const format = match.series_format || (match.group_id ? 'bo2' : 'bo3');
  const games = format === 'bo5' ? 5 : format === 'bo3' ? 3 : format === 'bo2' ? 2 : 1;
  const kicker = [
    match.isPlayoff ? `Playoffy${match.playoffCode ? ` · ${match.playoffCode}` : ''}` : (!p.isMmrLimited && (match.matchday || match.round) ? `Kolejka ${match.matchday || match.round}` : null),
    format.toUpperCase(),
    extraTag(match),
  ].filter(Boolean) as string[];

  const refresh = async () => {
    if (!p.onRefreshMatch || refreshing) return;
    setRefreshing(true);
    try { await p.onRefreshMatch(); } finally { setRefreshing(false); }
  };

  return (
    <div className="lg:h-full lg:min-h-0 flex flex-col" style={{ color: C.text }}>
      {/* Who and when */}
      <div className="shrink-0 flex flex-wrap items-center gap-x-6 gap-y-4 pb-4" style={{ borderBottom: `1px solid ${ink(12)}` }}>
        <div className="flex items-center gap-x-6 gap-y-4 min-w-0 basis-full md:basis-0 md:flex-1">
        <span className="hidden sm:block shrink-0"><TeamLogo team={{ name: opponent?.name ?? '?', logoUrl: oppTeam?.logoUrl || opponent?.logoUrl, tag: oppTeam?.tag }} size={140} className="drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)]" /></span>
        <span className="sm:hidden shrink-0"><TeamLogo team={{ name: opponent?.name ?? '?', logoUrl: oppTeam?.logoUrl || opponent?.logoUrl, tag: oppTeam?.tag }} size={72} /></span>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-[0.25em] flex flex-wrap gap-x-3" style={{ color: C.muted }}>{kicker.map(k => <span key={k}>{k}</span>)}</div>
          <h3 className="font-logik-extended-bold uppercase leading-[0.95] mt-1 break-words" style={{ fontSize: 'clamp(24px, 2.4vw, 40px)', color: C.heading, ...font }}>vs {opponent?.name ?? 'TBA'}</h3>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1">
            <span className="text-[16px] first-letter:uppercase" style={{ color: match.scheduledFor ? C.text : C.loss }}>
              {match.scheduledFor ? longDate(match.scheduledFor) : 'Termin do ustalenia'}
            </span>
            {canPropose && !proposing && <Act onClick={() => setProposing(true)}>{match.scheduledFor ? 'Zmień termin' : 'Ustal termin'}</Act>}
          </div>
        </div>
        </div>
        {score && <div className="font-logik-extended-bold tabular-nums leading-none" style={{ fontSize: 56, color: score.color, ...font }}>{score.us}:{score.them}</div>}
        <div className="flex items-center gap-5">
          {!done && opponent?.id && <Act onClick={() => openPrep({ us: myTeamId, them: opponent.id })}><ClipboardList className="w-4 h-4" />Przygotuj draft</Act>}
          {done && <Act onClick={() => setDetails(true)}>Szczegóły meczu</Act>}
          {p.onRefreshMatch && (
            <Tip content={<TipBody title="Odśwież mecz" />}>
              <button type="button" onClick={refresh} disabled={refreshing} aria-label="Odśwież mecz" className="opacity-60 hover:opacity-100 disabled:opacity-30" style={{ color: C.text }}>
                <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
              </button>
            </Tip>
          )}
        </div>
      </div>

      {/* Admin-issued draft penalties */}
      {(match.draftPenalties ?? []).map(pen => {
        const lvl = DRAFT_PENALTY_LEVELS[pen.level];
        const mine = pen.teamId === myTeamId;
        const which = !pen.games?.length ? 'całą serię' : `gry ${pen.games.join(', ')}`;
        return (
          <div key={pen.id} className="shrink-0 relative flex items-start gap-3 py-2.5 pl-4" style={{ borderBottom: `1px solid ${ink(8)}` }}>
            <span className="absolute left-0 top-3 bottom-3 w-[3px]" style={{ background: mine ? C.loss : '#f0c419' }} />
            <Gavel className="w-4 h-4 mt-0.5 shrink-0" style={{ color: mine ? C.loss : '#f0c419' }} />
            <div className="text-[14px]">
              <b style={{ color: C.heading }}>{mine ? 'Twoja drużyna' : opponent?.name ?? 'Przeciwnik'}: −{lvl.seconds} s czasu na draft</b>
              <span style={{ color: C.muted }}> · {which}{pen.reason ? ` · ${pen.reason}` : ''}</span>
            </div>
          </div>
        );
      })}

      {/* Two columns that share the rest of the height (each scrolls only if it must) */}
      <div className="grid gap-x-12 gap-y-10 lg:grid-cols-2 mt-5 lg:flex-1 lg:min-h-0">
        <div className="min-w-0 flex flex-col gap-8 lg:min-h-0 lg:overflow-y-auto custom-scrollbar lg:pr-2">
          <DateBlock {...p} open={proposing} setOpen={setProposing} />
          {p.onSetCoach && p.onRemoveCoach && (
            <section>
              <Label>Trener</Label>
              <PDLCoachSection isCaptain={isCaptain} currentCoach={p.myCoachInfo} nextMatchDate={match.scheduledFor || undefined}
                onSetCoach={data => p.onSetCoach!(match.id, data)} onRemoveCoach={() => p.onRemoveCoach!(match.id)} />
            </section>
          )}
          {p.onSubmitStandinRequest && p.onApproveStandinRequest && p.onRejectStandinRequest && p.onAppealStandinRequest && (
            <section>
              <Label>Standiny</Label>
              <PDLStandinRequestSection matchId={match.id} myTeamId={myTeamId} players={p.myTeamPlayers} isCaptain={isCaptain}
                existingRequests={p.standinRequests} onSubmitRequest={p.onSubmitStandinRequest} onApproveRequest={p.onApproveStandinRequest}
                onRejectRequest={p.onRejectStandinRequest} onAppealRequest={p.onAppealStandinRequest} onCancelRequest={p.onCancelStandinRequest}
                onEditGames={p.onEditStandinGames} isOpponentView={false} isMmrLimited={p.isMmrLimited} totalGames={games} />
            </section>
          )}
          {(p.opponentStandinRequests ?? []).length > 0 && p.onApproveStandinRequest && p.onRejectStandinRequest && (
            <section>
              <Label>Standiny · {opponent?.name ?? 'przeciwnik'}</Label>
              <PDLStandinRequestSection matchId={match.id} myTeamId={myTeamId} players={[]} isCaptain={isCaptain}
                existingRequests={p.opponentStandinRequests!} onSubmitRequest={async () => {}} onApproveRequest={p.onApproveStandinRequest}
                onRejectRequest={p.onRejectStandinRequest} onAppealRequest={async () => {}} isOpponentView
                allTournamentRequests={p.allTournamentRequests} matchNameMap={p.matchNameMap} totalGames={games} />
            </section>
          )}
        </div>
        {!done && (
          <div className="min-w-0 lg:min-h-0 lg:overflow-y-auto custom-scrollbar lg:pr-2">
            <Lobby match={match} games={games} timePenalty={p.timePenalty} lobbyName={p.botLobbyName} lobbyPassword={p.botLobbyPassword} />
          </div>
        )}
      </div>

      {done && details && createPortal(<MatchDetailModal match={match} isOpen onClose={() => setDetails(false)} divisionColor="var(--tournament-primary)" />, document.body)}
    </div>
  );
}

// ── The date: propose a change, answer one, withdraw one ─────────────────

/** Only when there is something to do: answer the opponent, see or withdraw your proposal, or propose (opened beside the date) */
function DateBlock(p: PDLUpcomingMatchProps & { open: boolean; setOpen: (v: boolean) => void }) {
  const { match, myTeamId, isCaptain, open, setOpen } = p;
  const { tournament } = useTournament();
  const font = useHeaderFont();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [busy, setBusy] = useState(false);

  const req = match.rescheduleRequest;
  const pending = req?.status === 'pending';
  const fromUs = !!req && req.requestedBy === myTeamId;
  const fromThem = pending && !fromUs;
  // One policy for the picker bounds, the rules shown and the error (checked again on send / approve).
  // Anchored to the first scheduled time, so captains can't chain changes to drift further.
  const policy = reschedulePolicy({ originalIso: req?.originalDate || match.scheduledFor || '', tournament, match });
  const dayValue = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const closed = !!policy.latest && policy.latest.getTime() <= policy.earliest.getTime();
  const validTime = /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
  const iso = date && validTime ? new Date(`${date}T${time}`).toISOString() : null;
  const broken = iso ? checkReschedule(policy, iso) : null;

  const run = async (f: () => Promise<void>) => { setBusy(true); try { await f(); } catch (e) { console.error('[MatchPanel]', e); } finally { setBusy(false); } };
  const send = () => iso && !broken && p.onRequestReschedule && run(async () => { await p.onRequestReschedule!(match.id, iso); setOpen(false); setDate(''); setTime(''); });
  const canPropose = isCaptain && match.status !== 'completed' && !pending;
  if (!(fromThem && isCaptain) && !(fromUs && req) && !(canPropose && open)) return null;

  return (
    <section>

      {fromThem && isCaptain && (
        <div className="relative pl-4 py-1">
          <span className="absolute left-0 top-1 bottom-1 w-[3px]" style={{ background: C.loss }} />
          <div className="text-[13px]" style={{ color: C.muted }}>{req!.requestedByName} proponuje</div>
          <div className="font-logik-extended-bold text-[20px] first-letter:uppercase" style={{ color: C.heading, ...font }}>{req!.proposedDate ? longDate(req!.proposedDate) : '–'}</div>
          <div className="flex items-center gap-5 mt-3">
            <Solid onClick={() => p.onApproveReschedule && run(() => p.onApproveReschedule!(match.id))} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Akceptuj</Solid>
            <Act danger onClick={() => p.onRejectReschedule && run(() => p.onRejectReschedule!(match.id))} disabled={busy}>Odrzuć</Act>
          </div>
        </div>
      )}

      {fromUs && req && (
        <div className="relative pl-4 py-1">
          <span className="absolute left-0 top-1 bottom-1 w-[3px]" style={{ background: req.status === 'approved' ? C.win : req.status === 'rejected' ? C.loss : T }} />
          <div className="text-[13px]" style={{ color: req.status === 'approved' ? C.win : req.status === 'rejected' ? C.loss : C.muted }}>
            {req.status === 'approved' ? 'Przeciwnik przyjął zmianę' : req.status === 'rejected' ? 'Przeciwnik odrzucił zmianę' : 'Czekasz na odpowiedź przeciwnika'}
          </div>
          <div className="font-logik-extended-bold text-[20px] first-letter:uppercase" style={{ color: C.heading, ...font }}>{req.proposedDate ? longDate(req.proposedDate) : '–'}</div>
          {/* An approved change stays on record; a pending one can be withdrawn, a rejected one cleared */}
          {req.status !== 'approved' && (
            <div className="mt-2">
              <Act danger={req.status === 'pending'} onClick={() => p.onCancelReschedule && run(() => p.onCancelReschedule!(match.id))} disabled={busy}>
                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{req.status === 'pending' ? 'Wycofaj propozycję' : 'Usuń'}
              </Act>
            </div>
          )}
        </div>
      )}

      {canPropose && open && (
        <div className="mt-2">
          <div className="text-[12px] leading-relaxed space-y-0.5 mb-3" style={{ color: C.muted }}>
            {policy.summary.map(line => <p key={line}>{line}</p>)}
            {closed && <p style={{ color: C.loss }}>Termin przełożenia tego meczu już minął. W razie problemów napisz do administracji.</p>}
          </div>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: C.muted }}>Dzień</span>
              <DateInput aria-label="Dzień" value={date} onChange={setDate} min={dayValue(policy.earliest)} max={policy.latest ? dayValue(policy.latest) : undefined} className="w-[190px] bg-transparent" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: C.muted }}>Godzina</span>
              <input inputMode="numeric" placeholder="20:00" value={time} onChange={e => setTime(normalizeTime(e.target.value))} className={cn(field, 'w-[90px] tabular-nums')} style={{ borderColor: ink(20), color: C.heading }} />
            </label>
            <Solid onClick={send} disabled={!iso || !!broken || closed || busy}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}Wyślij przeciwnikowi</Solid>
            <Act onClick={() => setOpen(false)}><X className="w-3.5 h-3.5" />Anuluj</Act>
          </div>
          {broken && <p className="mt-2 text-[13px]" style={{ color: C.loss }}>{broken.violation}</p>}
        </div>
      )}
    </section>
  );
}

// ── Getting into the lobby ───────────────────────────────────────────────

type ClientLang = 'en' | 'pl';
const LANG_KEY = 'pdl:dota-client-lang';
const MODE_LABEL: Record<string, string> = { all_pick: 'All Pick', captains_mode: 'Captains Mode', captains_draft: 'Captains Draft', random_draft: 'Random Draft', single_draft: 'Single Draft', all_random: 'All Random', turbo: 'Turbo' };
const REGION_LABEL: Record<string, string> = { us_west: 'US West', us_east: 'US East', europe_west: 'Europe West', europe_east: 'Europe East', russia: 'Russia', southeast_asia: 'SE Asia', south_america: 'South America', australia: 'Australia', dubai: 'Dubai', chile: 'Chile', peru: 'Peru', india: 'India', japan: 'Japan', south_africa: 'South Africa' };
// Menu names as the Dota client shows them (Polish names confirmed by the organiser)
const MENU: Record<ClientLang, { play: string; lobbies: string; browse: string; region: string; mode: string; password: string }> = {
  en: { play: 'PLAY DOTA', lobbies: 'Custom Lobbies', browse: 'Browse', region: 'Server region', mode: 'Game mode', password: 'Password' },
  pl: { play: 'GRAJ W DOTA 2', lobbies: 'Prywatne poczekalnie', browse: 'Przeglądaj', region: 'Region', mode: 'Tryb gry', password: 'Hasło' },
};
const K = ({ children }: { children: React.ReactNode }) => <b className="px-1 rounded whitespace-nowrap" style={{ color: C.heading, background: ink(10) }}>{children}</b>;
/** "Gry 1, 3 i 5": the games of a bo-N series matching `odd` */
function gamesList(total: number, odd: boolean): string {
  const g = Array.from({ length: total }, (_, i) => i + 1).filter(n => (n % 2 === 1) === odd);
  if (!g.length) return '';
  if (g.length === 1) return `Gra ${g[0]}`;
  return `Gry ${g.slice(0, -1).join(', ')} i ${g[g.length - 1]}`;
}

function Lobby({ match, games, timePenalty, lobbyName, lobbyPassword }: { match: Match; games: number; timePenalty?: { minutes: number; reason: string }; lobbyName?: string; lobbyPassword?: string }) {
  const { tournament } = useTournament();
  const font = useHeaderFont();
  const [bot, setBot] = useState<PublicBotInfo | null>(null);
  const [lang, setLangState] = useState<ClientLang>('en');
  const [manual, setManual] = useState(false);
  useEffect(() => { try { const v = localStorage.getItem(LANG_KEY); if (v === 'pl' || v === 'en') setLangState(v); } catch { /* storage blocked */ } }, []);
  const setLang = (l: ClientLang) => { setLangState(l); try { localStorage.setItem(LANG_KEY, l); } catch { /* storage blocked */ } };
  useEffect(() => {
    if (!tournament?.id) return;
    let live = true;
    getPublicBotInfo(tournament.id).then(b => { if (live) setBot(b); }).catch(() => {});
    return () => { live = false; };
  }, [tournament?.id]);

  const lobby = tournament?.lobbySettings;
  // The admin's bot switch (bot config) decides; the old tournament flag is a fallback
  const botOn = bot?.enabled ?? !!lobby?.botLobbyEnabled;
  const mode = bot ? (MODE_LABEL[bot.gameMode] ?? bot.gameMode) : (lobby?.gameMode || 'Captains Mode');
  const region = bot ? (REGION_LABEL[bot.region] ?? bot.region) : (lobby?.server || 'EU West');
  const password = lobbyPassword || bot?.password || '';
  const m = MENU[lang];
  const Step = ({ children }: { children: React.ReactNode }) => <li className="pl-1">{children}</li>;

  return (
    <section>
      <Label>Lobby</Label>
      {timePenalty && (
        <div className="relative pl-4 py-1 mb-5">
          <span className="absolute left-0 top-1 bottom-1 w-[3px]" style={{ background: C.loss }} />
          <b style={{ color: C.loss }}>Kara czasowa: {count(timePenalty.minutes, 'minuta', 'minuty', 'minut')}</b>
          <div className="text-[13px]" style={{ color: C.muted }}>{timePenalty.reason}</div>
        </div>
      )}

      {botOn ? (
        <>
          <div className="grid grid-cols-[1fr_auto] gap-x-8 gap-y-1">
            <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: C.muted }}>Nazwa</span>
            <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: C.muted }}>Hasło</span>
            <span className="font-bold break-words" style={{ color: lobbyName ? C.heading : C.muted }}>{lobbyName || 'po otwarciu lobby'}</span>
            <span className="font-logik-extended-bold tracking-widest" style={{ color: password ? C.heading : C.muted, ...(password ? font : {}) }}>{password || '–'}</span>
          </div>
          <p className="mt-4 text-[14px] leading-relaxed">
            Bot otwiera lobby <b style={{ color: C.heading }}>{count(bot?.leadMinutes ?? 10, 'minutę', 'minuty', 'minut')} przed meczem</b> i zaprasza zgłoszonych graczy. Przyjmij zaproszenie w Dota 2.
          </p>

          <button type="button" onClick={() => setManual(v => !v)} className="mt-4 text-[12px] font-bold uppercase tracking-widest hover:underline underline-offset-4" style={{ color: T }}>
            {manual ? 'Ukryj' : 'Zaproszenie nie dotarło?'}
          </button>
          {manual && (
            <div className="mt-3 pl-4" style={{ borderLeft: `1px solid ${ink(14)}` }}>
              <div className="flex gap-1 mb-2 -ml-2" role="group" aria-label="Język klienta Doty">
                {(['en', 'pl'] as const).map(l => (
                  <button key={l} type="button" onClick={() => setLang(l)} className="relative px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest" style={{ color: lang === l ? C.heading : C.muted }}>
                    {l === 'en' ? 'Dota po angielsku' : 'Dota po polsku'}
                    {lang === l && <span className="absolute left-2 right-2 -bottom-0.5 h-[2px] rounded-full" style={{ background: T }} />}
                  </button>
                ))}
              </div>
              <ol className="list-decimal pl-5 space-y-1 text-[14px] marker:text-[var(--team)]">
                <Step><K>{m.play}</K> → <K>{m.lobbies}</K> → <K>{m.browse}</K></Step>
                <Step>{m.region}: <K>{region}</K>, {m.mode.toLowerCase()}: <K>{mode}</K></Step>
                <Step>Otwórz {lobbyName ? <K>{lobbyName}</K> : 'lobby z nazwą powyżej'}</Step>
                <Step>{m.password}: {password ? <K>{password}</K> : 'jak powyżej'}</Step>
              </ol>
            </div>
          )}

          <div className="mt-6 text-[10px] uppercase tracking-[0.2em] mb-1.5" style={{ color: C.muted }}>W lobby</div>
          <ol className="list-decimal pl-5 space-y-1 text-[14px] marker:text-[var(--team)]">
            <Step>Wybierz swoją drużynę z listy.</Step>
            <Step>Cała piątka siada w slotach po swojej stronie, nie w widowni.</Step>
            <Step>Gotowi? Wpisz <K>!r</K> na czacie.</Step>
            <Step>Gra startuje sama, gdy obie drużyny są gotowe.</Step>
          </ol>
          <p className="mt-4 text-[13px]" style={{ color: C.loss }}>Lobby nie działa albo bot nie odpowiada? Od razu napisz do administratora.</p>
        </>
      ) : (
        <div className="text-[14px] space-y-1">
          <div><b style={{ color: C.heading }}>Gra 1:</b> lobby tworzy kapitan <b style={{ color: T }}>{match.teamA?.name}</b></div>
          <div><b style={{ color: C.heading }}>Gra 2:</b> lobby tworzy kapitan <b style={{ color: T }}>{match.teamB?.name}</b></div>
        </div>
      )}

      <Rules games={games} />
    </section>
  );
}

/** Pick priority and lateness: the series rules that apply to every match */
function Rules({ games }: { games: number }) {
  const { tournament } = useTournament();
  const lobby = tournament?.lobbySettings;
  return (
    <section className="mt-6">
      <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] mb-1.5" style={{ color: C.muted }}>Priorytet wyboru</div>
          <div className="text-[14px] space-y-1">
            <div><b style={{ color: C.heading }}>{gamesList(games, true)}:</b> rzut monetą</div>
            {games > 1 && <div><b style={{ color: C.heading }}>{gamesList(games, false)}:</b> przegrany poprzedniego rzutu</div>}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] mb-1.5" style={{ color: C.muted }}>Spóźnienie</div>
          <div className="text-[14px] space-y-1">
            <div><b style={{ color: C.heading }}>{lobby?.latePenaltyGameMinutes ?? 15} min:</b> walkower za grę</div>
            <div><b style={{ color: C.heading }}>{lobby?.latePenaltySeriesMinutes ?? 30} min:</b> walkower za serię</div>
          </div>
        </div>
      </div>
    </section>
  );
}
