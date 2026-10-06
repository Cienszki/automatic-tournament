"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { User } from "firebase/auth";
import { Search, Sparkles, X, CornerDownRight, AlertTriangle, ArrowRight } from "lucide-react";
import { useTournament } from "@/context/TournamentContext";
import { useAuth } from "@/context/AuthContext";
import { auth } from "@/lib/firebase";
import { organizationConfig } from "@/config/organization";
import type { NumberedRule } from "@/lib/rules-numbering";
import {
  INLINE_REF_PATTERN,
  MAX_HISTORY_MESSAGES,
  MAX_QUESTION_CHARS,
  normalizeRef,
  type ChatTurn,
  type RulesCitation,
} from "@/lib/rules-assistant";

type Result =
  | { kind: "answer"; question: string; text: string; citations: RulesCitation[]; covered: boolean }
  | { kind: "error"; question: string; text: string };

interface RulesAssistantProps {
  rules: NumberedRule[];
  /** Scrolls the rules page to a paragraph and highlights it */
  onCitationClick: (paragraphId: string) => void;
}

const PLACEHOLDER = "Wpisz tutaj swoje pytanie, a nasz bot odpowie na podstawie regulaminu.";
const PLACEHOLDER_SHORT = "Zadaj pytanie o regulamin…";

/**
 * Search-style Q&A over the rulebook, shown above the chapters. Answers come from
 * /api/rules-assistant (Gemini, grounded in this tournament's rules) with clickable citations.
 */
export function RulesAssistant({ rules, onCitationClick }: RulesAssistantProps) {
  const { tournament, theme } = useTournament();
  const { user, signInWithGoogle } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [remainingToday, setRemainingToday] = useState<number | null>(null);
  const [narrow, setNarrow] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const primary = theme?.primaryColor || "#3b82f6";
  const headingColor = theme?.headingColor || theme?.primaryTextColor || "white";
  const textColor = theme?.primaryTextColor || "#e5e7eb";
  const mutedColor = theme?.secondaryTextColor || "#9ca3af";
  const linkColor = theme?.linkColor || primary;
  const headerFont = theme?.headerFont ? `var(${theme.headerFont})` : undefined;
  const discordUrl = tournament?.discordUrl || organizationConfig.defaults.discord;

  const ruleByRef = useMemo(() => new Map(rules.map(r => [r.ref, r])), [rules]);

  useEffect(() => {
    fetch("/api/rules-assistant")
      .then(res => (res.ok ? res.json() : { enabled: false }))
      .then(data => setEnabled(!!data.enabled))
      .catch(() => setEnabled(false));
  }, []);

  // The full hint doesn't fit the bar on phones
  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  if (!enabled || !tournament) return null;

  const discordLink = (label: string) => (
    <a href={discordUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:opacity-80" style={{ color: linkColor }}>
      {label}
    </a>
  );

  const send = async (question: string, asUser: User) => {
    setPending(question);
    try {
      const token = await asUser.getIdToken();
      const res = await fetch("/api/rules-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tournamentId: tournament.id, question, history: history.slice(-MAX_HISTORY_MESSAGES) }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.reason === "user_day") setRemainingToday(0);
        setResult({ kind: "error", question, text: data.error || "Asystent jest chwilowo niedostępny. Spróbuj ponownie później." });
        return;
      }
      if (typeof data.remainingToday === "number") setRemainingToday(data.remainingToday);
      setResult({ kind: "answer", question, text: data.answer, citations: data.citations ?? [], covered: data.covered !== false });
      setHistory(prev => [...prev, { role: "user" as const, text: question }, { role: "assistant" as const, text: data.answer }].slice(-MAX_HISTORY_MESSAGES));
    } catch {
      setResult({ kind: "error", question, text: "Nie udało się połączyć z asystentem. Sprawdź połączenie i spróbuj ponownie." });
    } finally {
      setPending(null);
    }
  };

  const submit = async () => {
    const question = input.trim().slice(0, MAX_QUESTION_CHARS);
    if (!question || pending || remainingToday === 0) return;
    inputRef.current?.blur();
    if (user) return send(question, user);
    // Questions are limited per account: sign in, then send the question that was typed
    await signInWithGoogle();
    if (auth.currentUser) send(question, auth.currentUser);
  };

  const clear = () => {
    setInput("");
    setResult(null);
    setHistory([]);
    inputRef.current?.focus();
  };

  /** Answer text with inline "[3.2]" markers turned into chips that jump to the rule. */
  const renderAnswerText = (text: string): ReactNode[] => {
    const nodes: ReactNode[] = [];
    let last = 0;
    for (const match of text.matchAll(INLINE_REF_PATTERN)) {
      const ref = normalizeRef(match[1]);
      const rule = ruleByRef.get(ref);
      if (match.index! > last) nodes.push(text.slice(last, match.index));
      nodes.push(rule ? (
        <button
          key={`${match.index}-${ref}`}
          onClick={() => onCitationClick(rule.paragraphId)}
          className="inline-flex items-center mx-0.5 px-1.5 rounded-md border text-[0.8rem] font-body font-semibold tabular-nums align-baseline transition-colors hover:brightness-125"
          style={{ backgroundColor: `${primary}33`, borderColor: `${primary}80`, color: headingColor }}
          title={`Przejdź do punktu ${ref}`}
        >
          §{ref}
        </button>
      ) : (
        <Fragment key={`${match.index}-${ref}`}>{match[0]}</Fragment>
      ));
      last = match.index! + match[0].length;
    }
    if (last < text.length) nodes.push(text.slice(last));
    return nodes;
  };

  const limitReached = remainingToday === 0;
  const canSubmit = !!input.trim() && !pending && !limitReached;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 }}
      className="max-w-3xl mx-auto w-full"
      aria-label="Zapytaj o regulamin"
    >
      {/* Search bar */}
      <form onSubmit={e => { e.preventDefault(); submit(); }}>
        <div
          className="flex items-center gap-3 h-14 rounded-full border backdrop-blur-md pl-5 pr-2 transition-all duration-300"
          style={{
            backgroundColor: focused ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.05)",
            borderColor: focused ? `${primary}99` : "rgba(255,255,255,0.12)",
            boxShadow: focused ? `0 0 0 4px ${primary}1f, 0 12px 40px -14px ${primary}80` : "0 8px 30px -18px rgba(0,0,0,0.8)",
          }}
          onClick={() => inputRef.current?.focus()}
        >
          <Search className="w-5 h-5 shrink-0 transition-colors" style={{ color: focused ? primary : mutedColor }} />
          <input
            ref={inputRef}
            type="text"
            enterKeyHint="search"
            value={input}
            onChange={e => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={e => { if (e.key === "Escape") inputRef.current?.blur(); }}
            maxLength={MAX_QUESTION_CHARS}
            disabled={limitReached}
            // Like a search engine: the hint disappears as soon as the field is clicked
            placeholder={focused ? "" : limitReached ? "Dzisiejszy limit pytań wyczerpany — wróć jutro." : narrow ? PLACEHOLDER_SHORT : PLACEHOLDER}
            aria-label="Pytanie o regulamin"
            className="flex-1 min-w-0 bg-transparent outline-none text-[0.95rem] font-body placeholder:text-white/40 disabled:cursor-not-allowed"
            style={{ color: textColor }}
          />
          {(input || result) && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); clear(); }}
              className="p-2 rounded-full hover:bg-white/10 transition-colors shrink-0"
              style={{ color: mutedColor }}
              aria-label="Wyczyść"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="submit"
            disabled={!canSubmit}
            className="h-10 rounded-full px-3 sm:px-4 flex items-center gap-2 shrink-0 text-sm font-logik-extended-bold transition-opacity disabled:opacity-35 disabled:cursor-not-allowed hover:opacity-90"
            style={{ backgroundColor: primary, color: "white", fontFamily: headerFont }}
            aria-label="Zapytaj"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Zapytaj</span>
          </button>
        </div>
      </form>

      {/* Disclaimer */}
      <p className="mt-3 px-4 text-center text-xs font-body leading-relaxed" style={{ color: mutedColor }}>
        AI może się mylić — w ważnych sprawach zapytaj adminów na {discordLink("Discordzie")}
        {!user || remainingToday !== null ? (
          <span className="opacity-80">
            {" · "}
            {!user ? "Wymaga logowania" : `Pozostało pytań dziś: ${remainingToday}`}
          </span>
        ) : "."}
      </p>

      {/* Answer */}
      <AnimatePresence mode="wait">
        {(pending || result) && (
          <motion.div
            key={pending ? `pending-${pending}` : `result-${result!.question}-${result!.kind}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="mt-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden text-left"
            aria-live="polite"
          >
            <div className="flex items-start gap-3 px-5 pt-5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${primary}30`, color: primary }}>
                {result?.kind === "error" && !pending ? <AlertTriangle className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-logik-extended-bold" style={{ color: headingColor, fontFamily: headerFont }}>
                  {pending ? "Szukam w regulaminie…" : "Odpowiedź asystenta"}
                </p>
                <p className="text-xs font-body truncate" style={{ color: mutedColor }}>
                  „{pending ?? result!.question}”
                </p>
              </div>
            </div>

            <div className="px-5 pb-5 pt-3">
              {pending ? (
                <div className="flex gap-1.5 py-2" aria-label="Asystent pisze">
                  {[0, 1, 2].map(i => (
                    <motion.span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: primary }}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </div>
              ) : result!.kind === "error" ? (
                <p className="font-body text-sm" style={{ color: mutedColor }}>{result!.text}</p>
              ) : (
                <div className="space-y-4">
                  <p className="font-rules-content leading-relaxed whitespace-pre-wrap break-words" style={{ color: textColor }}>
                    {renderAnswerText(result!.text)}
                  </p>

                  {!result!.covered && (
                    <p className="text-xs font-body" style={{ color: mutedColor }}>
                      Regulamin nie rozstrzyga tego jednoznacznie — najlepiej zapytaj adminów na {discordLink("Discordzie")}.
                    </p>
                  )}

                  {result!.citations.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <p className="text-[0.65rem] uppercase tracking-wider font-body font-semibold" style={{ color: mutedColor }}>
                        Źródła w regulaminie
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {result!.citations.map(citation => (
                          <button
                            key={citation.ref}
                            onClick={() => onCitationClick(citation.paragraphId)}
                            className="group text-left rounded-lg border-l-2 pl-3 pr-2 py-2 bg-white/[0.03] hover:bg-white/[0.07] transition-colors"
                            style={{ borderLeftColor: `${primary}80` }}
                            title={`Przejdź do punktu ${citation.ref}`}
                          >
                            <span className="flex items-center gap-1.5 text-xs font-body font-semibold tabular-nums" style={{ color: headingColor }}>
                              <span className="px-1.5 rounded border" style={{ backgroundColor: `${primary}33`, borderColor: `${primary}80` }}>§{citation.ref}</span>
                              <span className="font-medium truncate" style={{ color: mutedColor }}>
                                · {citation.sectionTitle.replace(/^\d+\.\s*/, "")}
                              </span>
                              <CornerDownRight className="w-3 h-3 ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </span>
                            <span className="block text-xs italic font-rules-content leading-relaxed mt-0.5 line-clamp-3" style={{ color: textColor }}>
                              „{citation.quote}”
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => { inputRef.current?.focus(); inputRef.current?.select(); }}
                    className="inline-flex items-center gap-1.5 text-xs font-body hover:opacity-80 transition-opacity"
                    style={{ color: linkColor }}
                  >
                    Zadaj pytanie uzupełniające <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
