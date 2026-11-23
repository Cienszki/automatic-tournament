// The public team list, rendered on the server with its data in the first response: no effect,
// no loading screen. Colours come from the tournament's CSS variables (TournamentTheme).

import { getTranslations } from 'next-intl/server';
import { tournamentHref, type Linkable } from '@/features/tournaments';
import type { TeamListItem, TeamListMember } from '../domain/team-list';

const HIDDEN_STATUSES = new Set(['verified', 'eliminated']);

export async function TeamsView({ tournament, teams }: { tournament: Linkable; teams: TeamListItem[] }) {
  const t = await getTranslations('teams');
  return (
    <main className="relative mx-auto max-w-[1800px] px-6 py-8 lg:px-12">
      <header className="py-8 text-center">
        <h1 className="font-logik-wide-black text-6xl uppercase tracking-tighter text-[var(--tournament-title)] md:text-7xl 2xl:text-9xl">
          {t('title')}
        </h1>
        <div className="mx-auto mt-4 h-px w-24 bg-gradient-to-r from-transparent via-[var(--tournament-primary)] to-transparent" />
      </header>
      {teams.length === 0 ? (
        <p className="py-16 text-center text-[var(--tournament-muted)]">{t('noTeamsRegistered')}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {teams.map((team) => (
            <li key={team.id}>
              <a
                href={tournamentHref(tournament, `/teams/${team.id}`)}
                className="block h-full rounded-xl border border-[var(--tournament-border)] bg-[var(--tournament-card)] p-5 transition-colors hover:border-[var(--tournament-primary)]"
              >
                <TeamHeading team={team} status={HIDDEN_STATUSES.has(team.status) ? null : t(`status.${team.status}`)} />
                <Roster members={team.members} labels={{ coach: t('coach'), substitute: t('substitute') }} />
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function TeamHeading({ team, status }: { team: TeamListItem; status: string | null }) {
  return (
    <div className="flex items-center gap-4">
      {team.logoUrl ? (
        // Logos come from hosts the image optimizer may not allow; a plain image cannot fail the page.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logoUrl} alt="" width={56} height={56} loading="lazy" className="h-14 w-14 shrink-0 object-contain" />
      ) : (
        <span className="flex h-14 w-14 shrink-0 items-center justify-center text-2xl font-bold text-[var(--tournament-primary)]">
          {team.name.charAt(0)}
        </span>
      )}
      <div className="min-w-0">
        <h2 className="truncate text-lg font-semibold text-[var(--tournament-heading)]">{team.name}</h2>
        <p className="truncate text-sm text-[var(--tournament-muted)]">
          {[team.group, status].filter(Boolean).join(' · ')}
        </p>
      </div>
    </div>
  );
}

function Roster({ members, labels }: { members: TeamListMember[]; labels: { coach: string; substitute: string } }) {
  if (members.length === 0) return null;
  return (
    <ul className="mt-4 space-y-1 border-t border-[var(--tournament-border)] pt-3 text-sm">
      {members.map((m, i) => (
        <li key={`${m.nickname}-${i}`} className="flex justify-between gap-2">
          <span className="truncate">{m.nickname}</span>
          {m.kind !== 'player' && <span className="shrink-0 text-[var(--tournament-muted)]">{labels[m.kind]}</span>}
        </li>
      ))}
    </ul>
  );
}
