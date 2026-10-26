'use client';

import { useEffect, useState } from 'react';
import { Info, Users, AlertTriangle, Bot, Lock, Search, Swords, Send } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useTournament } from '@/context/TournamentContext';
import { count } from '@/lib/plural';
import { getPublicBotInfo, type PublicBotInfo } from '@/lib/bot/bot-config-actions';

interface PDLMatchRulesProps {
  leagueName?: string;
  isGame1Host?: boolean;
  hostTeamName?: string;
  opponentTeamName?: string;
  timePenalty?: {
    minutes: number;
    reason: string;
  };
  /** Lobby name from the active bot session for this match */
  botLobbyName?: string;
  /** Lobby password from the active bot session */
  botLobbyPassword?: string;
  /** Games in the series (bo1 = 1 … bo5 = 5) — for the pick-priority rule per game */
  totalGames?: number;
}

// ─── Dota client wording ─────────────────────────────────────────────────────
// The manual-join steps name the menus as the Dota client shows them, in English or Polish
// (the player picks which client language they use; Polish names confirmed by the organiser).

type ClientLang = 'en' | 'pl';
const LANG_KEY = 'pdl:dota-client-lang';

// Game modes and server regions are not translated in the Polish client — one set of names
const MODE_LABEL: Record<string, string> = { all_pick: 'All Pick', captains_mode: 'Captains Mode', captains_draft: 'Captains Draft', random_draft: 'Random Draft', single_draft: 'Single Draft', all_random: 'All Random', turbo: 'Turbo' };
const REGION_LABEL: Record<string, string> = { us_west: 'US West', us_east: 'US East', europe_west: 'Europe West', europe_east: 'Europe East', russia: 'Russia', southeast_asia: 'SE Asia', south_america: 'South America', australia: 'Australia', dubai: 'Dubai', chile: 'Chile', peru: 'Peru', india: 'India', japan: 'Japan', south_africa: 'South Africa' };
const MENU: Record<ClientLang, { play: string; lobbies: string; browse: string; region: string; mode: string; password: string }> = {
  en: { play: 'PLAY DOTA', lobbies: 'Custom Lobbies', browse: 'Browse', region: 'Server region', mode: 'Game mode', password: 'Password' },
  pl: { play: 'GRAJ W DOTA 2', lobbies: 'Prywatne poczekalnie', browse: 'Przeglądaj', region: 'Region', mode: 'Tryb gry', password: 'Hasło' },
};

function useClientLang(): [ClientLang, (l: ClientLang) => void] {
  const [lang, setLang] = useState<ClientLang>('en');
  useEffect(() => {
    try { const v = localStorage.getItem(LANG_KEY); if (v === 'pl' || v === 'en') setLang(v); } catch { /* storage blocked */ }
  }, []);
  const set = (l: ClientLang) => { setLang(l); try { localStorage.setItem(LANG_KEY, l); } catch { /* storage blocked */ } };
  return [lang, set];
}

/** "Gry 1, 3 i 5" — the games of a bo-N series matching `odd` */
function gamesList(total: number, odd: boolean): string {
  const g = Array.from({ length: total }, (_, i) => i + 1).filter(n => (n % 2 === 1) === odd);
  if (!g.length) return '';
  if (g.length === 1) return `Gra ${g[0]}`;
  return `Gry ${g.slice(0, -1).join(', ')} i ${g[g.length - 1]}`;
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="text-pdl-gold font-logik-extended-bold flex-shrink-0 w-4">{n}.</span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}

const K = ({ children }: { children: React.ReactNode }) => (
  <span className="font-logik-extended-bold text-white bg-white/10 px-1 rounded whitespace-nowrap">{children}</span>
);

export function PDLMatchRules({
  isGame1Host,
  hostTeamName,
  opponentTeamName,
  timePenalty,
  botLobbyName,
  botLobbyPassword,
  totalGames,
}: PDLMatchRulesProps) {
  const { tournament } = useTournament();

  const lobby = tournament?.lobbySettings;
  const [bot, setBot] = useState<PublicBotInfo | null>(null);
  useEffect(() => {
    if (!tournament?.id) return;
    let live = true;
    getPublicBotInfo(tournament.id).then(b => { if (live) setBot(b); }).catch(() => {});
    return () => { live = false; };
  }, [tournament?.id]);
  const [lang, setLang] = useClientLang();

  // The admin's bot switch (bot config) is what decides; the old tournament flag is a fallback
  const botOn = bot?.enabled ?? !!lobby?.botLobbyEnabled;
  const modeLabel = bot ? (MODE_LABEL[bot.gameMode] ?? bot.gameMode) : (lobby?.gameMode || 'Captains Mode');
  const regionLabel = bot ? (REGION_LABEL[bot.region] ?? bot.region) : (lobby?.server || 'EU West');
  const password = botLobbyPassword || bot?.password || '';
  const games = Math.max(1, totalGames ?? 3);

  const displayLatePenaltyGame = lobby?.latePenaltyGameMinutes ?? 15;
  const displayLatePenaltySeries = lobby?.latePenaltySeriesMinutes ?? 30;
  const m = MENU[lang];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Info className="w-4 h-4 text-pdl-gold" />
        <h4 className="text-xs font-logik-extended-bold text-white/60 uppercase tracking-wide">
          Zasady rozgrywki
        </h4>
      </div>

      {/* Time Penalty Alert */}
      {timePenalty && (
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-logik-extended-bold text-orange-300">
                Kara czasowa: {count(timePenalty.minutes, 'minuta', 'minuty', 'minut')}
              </p>
              <p className="text-xs text-orange-200/70 font-logik">
                {timePenalty.reason}
              </p>
              <p className="text-xs text-orange-200/50 font-logik mt-2">
                Drużyna rozpoczyna mecz z opóźnieniem czasowym dla pierwszego draftu.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hosting Rules */}
      {hostTeamName && opponentTeamName && (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 space-y-3">
          <div className="flex items-start gap-2">
            {botOn ? (
              <>
                <Bot className="w-4 h-4 text-pdl-gold mt-0.5 flex-shrink-0" />
                <div className="space-y-3 text-xs font-logik w-full min-w-0">
                  <p className="text-white font-logik-extended-bold">
                    Lobby zarządzane automatycznie przez bota
                  </p>
                  <p className="text-white/70 flex items-start gap-2">
                    <Send className="w-3.5 h-3.5 text-pdl-gold flex-shrink-0 mt-0.5" />
                    <span>
                      Bot otworzy lobby <span className="text-white font-logik-extended-bold">{count(bot?.leadMinutes ?? 10, 'minutę', 'minuty', 'minut')} przed meczem</span> i
                      wyśle zaproszenie każdemu zarejestrowanemu graczowi. Zaakceptuj je w Dota 2 — trafisz od razu do lobby.
                    </span>
                  </p>

                  {/* Lobby name + password */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-3 py-2 min-w-0">
                      <Search className="w-3.5 h-3.5 text-pdl-gold flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-white/40 text-[10px] uppercase tracking-wide">Nazwa lobby</p>
                        {botLobbyName
                          ? <p className="text-white font-logik-extended-bold break-words">{botLobbyName}</p>
                          : <p className="text-white/40 italic text-[11px]">pojawi się, gdy bot otworzy lobby</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                      <Lock className="w-3.5 h-3.5 text-pdl-gold flex-shrink-0" />
                      <div>
                        <p className="text-white/40 text-[10px] uppercase tracking-wide">Hasło</p>
                        {password
                          ? <p className="text-white font-logik-extended-bold tracking-widest">{password}</p>
                          : <p className="text-white/40 italic text-[11px]">pojawi się, gdy bot otworzy lobby</p>}
                      </div>
                    </div>
                  </div>

                  {/* Manual join, in the words of the player's Dota client */}
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-white font-logik-extended-bold">Zaproszenie nie dotarło? Wejdź ręcznie:</p>
                      <div className="flex items-center rounded-full border border-white/10 p-0.5 text-[10px]" role="group" aria-label="Język klienta Doty">
                        {(['en', 'pl'] as const).map(l => (
                          <button key={l} type="button" onClick={() => setLang(l)}
                            className={cn('rounded-full px-2 py-0.5 font-logik-extended-bold uppercase tracking-wide transition-colors',
                              lang === l ? 'bg-pdl-gold text-black' : 'text-white/50 hover:text-white')}>
                            {l === 'en' ? 'Dota po angielsku' : 'Dota po polsku'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <ol className="space-y-1.5 text-white/70 list-none">
                      <Step n={1}><K>{m.play}</K></Step>
                      <Step n={2}><K>{m.lobbies}</K></Step>
                      <Step n={3}><K>{m.browse}</K></Step>
                      <Step n={4}>{m.region}: <K>{regionLabel}</K>, {m.mode.toLowerCase()}: <K>{modeLabel}</K></Step>
                      <Step n={5}>Otwórz poczekalnię{botLobbyName ? <> <K>{botLobbyName}</K></> : ' z nazwą podaną powyżej'}</Step>
                      <Step n={6}>{m.password}: {password ? <K>{password}</K> : <span className="italic text-white/40">podane powyżej</span>}</Step>
                    </ol>
                  </div>

                  <p className="text-white/50 font-logik-extended-bold uppercase tracking-wide text-[10px] pt-1">W lobby</p>
                  <ol className="space-y-2 text-white/70 list-none">
                    <Step n={1}>Wybierz swoją zarejestrowaną drużynę z listy rozwijanej.</Step>
                    <Step n={2}>Zajmij slot gracza po właściwej stronie. Wszystkich 5 zawodników musi siedzieć w slotach (nie w widowni).</Step>
                    <Step n={3}>Gdy drużyna jest gotowa, wpisz <K>!r</K> na czacie.</Step>
                    <Step n={4}>Gra uruchomi się automatycznie po dokonaniu wyborów przez obie drużyny.</Step>
                  </ol>

                  {/* Emergency notice */}
                  <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 mt-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-red-300/80">
                      Jeśli lobby nie działa lub bot nie reaguje — <span className="font-logik-extended-bold text-red-300">natychmiast powiadom administratora.</span>
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <Users className="w-4 h-4 text-white/40 mt-0.5 flex-shrink-0" />
                <div className="space-y-2 text-xs font-logik">
                  <p className="text-white/70">
                    <span className="font-logik-extended-bold text-white">Gra 1:</span>{' '}
                    Lobby tworzy kapitan{' '}
                    <span className={cn(
                      'font-logik-extended-bold',
                      isGame1Host ? 'text-pdl-gold' : 'text-white/90'
                    )}>
                      {isGame1Host ? hostTeamName : opponentTeamName}
                    </span>
                  </p>
                  <p className="text-white/70">
                    <span className="font-logik-extended-bold text-white">Gra 2:</span>{' '}
                    Lobby tworzy kapitan{' '}
                    <span className={cn(
                      'font-logik-extended-bold',
                      !isGame1Host ? 'text-pdl-gold' : 'text-white/90'
                    )}>
                      {!isGame1Host ? hostTeamName : opponentTeamName}
                    </span>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Pick priority, game by game */}
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 space-y-2">
        <p className="text-xs text-white font-logik-extended-bold uppercase tracking-wide flex items-center gap-2">
          <Swords className="w-3.5 h-3.5 text-pdl-gold" />
          Priorytet wyboru
        </p>
        <ul className="space-y-1 text-xs font-logik text-white/70">
          <li><span className="text-white font-logik-extended-bold">{gamesList(games, true)}:</span> rzut monetą decyduje o priorytecie wyboru.</li>
          {games > 1 && (
            <li><span className="text-white font-logik-extended-bold">{gamesList(games, false)}:</span> priorytet ma drużyna, która przegrała rzut monetą w poprzedniej grze.</li>
          )}
        </ul>
      </div>

      {/* Important Notes */}
      <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
        <div className="flex gap-2">
          <Info className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-yellow-200/80 font-logik space-y-1">
            <p className="font-logik-extended-bold text-yellow-300">Ważne:</p>
            <ul className="list-disc list-inside space-y-0.5 text-yellow-200/70">
              <li>Spóźnienie {displayLatePenaltyGame} min = walkower za grę</li>
              <li>Spóźnienie {displayLatePenaltySeries} min = walkower za serię (0-2)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
