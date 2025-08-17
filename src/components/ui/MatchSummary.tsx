import React from 'react';

type TeamSide = {
  team?: { id?: string; name?: string };
  score?: { score?: number };
};

type Match = {
  id: string;
  name?: string;
  scheduled?: number | string;
  sides?: { home?: TeamSide; visitor?: TeamSide };
};

export default function MatchSummary({
  match,
  onClick,
}: {
  match: Match;
  onClick?: (m: Match) => void;
}) {
  const scheduled = match?.scheduled ? new Date(match.scheduled) : null;
  const home = match.sides?.home ?? {};
  const visitor = match.sides?.visitor ?? {};
  const homeName = home.team?.name ?? 'Home';
  const visitorName = visitor.team?.name ?? 'Visitor';
  const homeScore = Number(home.score?.score ?? 0);
  const visitorScore = Number(visitor.score?.score ?? 0);

  const initials = (name?: string) =>
    (name ?? '')
      .split(' ')
      .map((s) => (s ? s[0] : ''))
      .slice(0, 2)
      .join('')
      .toUpperCase();

  const homeInitials = initials(homeName);
  const visitorInitials = initials(visitorName);

  const dateLabel = scheduled
    ? scheduled.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: 'numeric' })
    : 'TBD';

  const isHomeWinner = homeScore > visitorScore;
  const isVisitorWinner = visitorScore > homeScore;

  return (
    <button
      type="button"
      onClick={() => onClick?.(match)}
      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-md bg-slate-900/40 border border-slate-700 hover:bg-slate-900/60 transition"
    >
      <div className="flex-shrink-0 text-xs text-slate-200 px-2 py-1 rounded-full bg-slate-700/50">{dateLabel}</div>

      <div className="flex-1 flex items-center justify-center gap-6 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">{homeInitials}</div>
          <div className="min-w-0">
            <div className={`text-sm font-medium truncate ${isHomeWinner ? 'text-emerald-300' : 'text-white'}`}>{homeName}</div>
          </div>
          <div className={`ml-2 text-sm px-2 py-0.5 rounded ${isHomeWinner ? 'bg-emerald-600' : 'bg-slate-700'} text-white`}>{homeScore}</div>
        </div>

        <div className="text-sm text-slate-400">—</div>

        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-pink-700 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">{visitorInitials}</div>
          <div className="min-w-0">
            <div className={`text-sm font-medium truncate ${isVisitorWinner ? 'text-emerald-300' : 'text-white'}`}>{visitorName}</div>
          </div>
          <div className={`ml-2 text-sm px-2 py-0.5 rounded ${isVisitorWinner ? 'bg-emerald-600' : 'bg-slate-700'} text-white`}>{visitorScore}</div>
        </div>
      </div>

      <div className="flex-shrink-0 text-xs text-slate-200 px-3 py-1 rounded-full bg-slate-700/30">{match.name ?? 'Match'}</div>
    </button>
  );
}
