"use client";

import { useTournament } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Settings, Users, CalendarDays, Trophy, FileText, Bell } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * Admin dashboard - tournament administration
 */
export default function AdminPage() {
  const { tournament, getTournamentPath, theme } = useTournament();

  if (!tournament) return null;

  const adminLinks = [
    { href: '/admin/teams', label: 'Zarządzaj drużynami', icon: Users },
    { href: '/admin/matches', label: 'Zarządzaj meczami', icon: CalendarDays },
    { href: '/admin/standings', label: 'Zarządzaj tabelami', icon: Trophy },
    { href: '/admin/announcements', label: 'Ogłoszenia', icon: Bell },
    { href: '/admin/rules', label: 'Edytuj regulamin', icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8" style={{ color: theme.primaryColor }} />
        <h1 className="text-3xl font-bold">Panel administracyjny</h1>
      </div>

      <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
        <CardHeader>
          <CardTitle>Witaj w panelu admina</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">
            Zarządzaj turniejem {tournament.name} z tego miejsca.
          </p>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {adminLinks.map((link) => (
              <Button
                key={link.href}
                asChild
                variant="outline"
                className="h-auto py-4 justify-start"
              >
                <Link href={getTournamentPath(link.href)} className="flex items-center gap-3">
                  <link.icon className="h-5 w-5" style={{ color: theme.primaryColor }} />
                  <span>{link.label}</span>
                </Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
        <CardHeader>
          <CardTitle>Status turnieju</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg border" style={{ borderColor: theme.borderColor }}>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="text-lg font-bold capitalize">{tournament.status}</p>
            </div>
            <div className="p-4 rounded-lg border" style={{ borderColor: theme.borderColor }}>
              <p className="text-sm text-muted-foreground">Typ turnieju</p>
              <p className="text-lg font-bold">{tournament.type === 'league' ? 'Liga' : 'Turniej MMR'}</p>
            </div>
            <div className="p-4 rounded-lg border" style={{ borderColor: theme.borderColor }}>
              <p className="text-sm text-muted-foreground">League ID</p>
              <p className="text-lg font-bold">{tournament.leagueId || 'Brak'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
