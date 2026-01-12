"use client";

import React, { useEffect, useState } from 'react';
import { useTournament, useTournamentType } from '@/context/TournamentContext';
import { useAuth } from '@/context/AuthContext';
import { checkIfAdmin } from '@/lib/auth';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Users, 
  CalendarDays, 
  Trophy, 
  FileText, 
  Bell,
  Shield,
  LogIn,
  Loader2,
  FileCheck,
  BarChart3,
  Layers,
  Import
} from 'lucide-react';

// Import existing admin components for legacy tournament
import { StageManagementTab } from '@/app/admin/StageManagementTab';
import { StandingsTab } from '@/app/admin/StandingsTab';
import { MatchManagementTab } from '@/app/admin/MatchManagementTab';
import { MatchImportTab } from '@/app/admin/MatchImportTab';
import { TeamVerificationTab } from '@/app/admin/TeamVerificationTab';
import { AnnouncementsTab } from '@/app/admin/AnnouncementsTab';
import { StandinManagementTab } from '@/app/admin/StandinManagementTab';
import { TournamentStatusTab } from '@/app/admin/TournamentStatusTab';
import { PlayoffManagementTab } from '@/app/admin/PlayoffManagementTab';
import { StatsManagementTab } from '@/app/admin/StatsManagementTab';

/**
 * Admin dashboard - tournament administration
 */
export default function AdminPage() {
  const { tournament, getTournamentPath, theme, isLegacyTournament } = useTournament();
  const { isLeague } = useTournamentType();
  const { user, signInWithGoogle } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function verifyAdmin() {
      if (user) {
        const adminStatus = await checkIfAdmin(user);
        setIsAdmin(adminStatus);
      }
      setIsLoading(false);
    }
    verifyAdmin();
  }, [user]);

  if (!tournament) return null;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-200px)]">
        <Loader2 className="h-16 w-16 animate-spin" style={{ color: theme.primaryColor }} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8" style={{ color: theme.primaryColor }} />
          <h1 className="text-3xl font-bold">Panel administracyjny</h1>
        </div>
        <Card className="text-center max-w-md mx-auto" style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardHeader>
            <Shield className="h-12 w-12 mx-auto mb-4" style={{ color: theme.primaryColor }} />
            <CardTitle>Wymagane logowanie</CardTitle>
            <CardDescription>Zaloguj się aby uzyskać dostęp do panelu administracyjnego.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={signInWithGoogle}>
              <LogIn className="mr-2 h-4 w-4" />
              Zaloguj przez Google
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8" style={{ color: theme.primaryColor }} />
          <h1 className="text-3xl font-bold">Panel administracyjny</h1>
        </div>
        <Card className="text-center max-w-md mx-auto" style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardHeader>
            <Shield className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <CardTitle className="text-red-500">Brak dostępu</CardTitle>
            <CardDescription>Nie masz uprawnień do przeglądania tej strony.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Skontaktuj się z administratorem platformy aby uzyskać dostęp.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // For legacy tournaments, use the existing admin tabs
  if (isLegacyTournament) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8" style={{ color: theme.primaryColor }} />
            <h1 className="text-3xl font-bold">Panel administracyjny</h1>
          </div>
          <Badge style={{ backgroundColor: theme.primaryColor }}>
            {tournament.name}
          </Badge>
        </div>

        <Tabs defaultValue="status" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:grid-cols-10">
            <TabsTrigger value="status">Status</TabsTrigger>
            <TabsTrigger value="teams">Drużyny</TabsTrigger>
            <TabsTrigger value="matches">Mecze</TabsTrigger>
            <TabsTrigger value="import">Import</TabsTrigger>
            <TabsTrigger value="standings">Tabele</TabsTrigger>
            <TabsTrigger value="stages">Etapy</TabsTrigger>
            <TabsTrigger value="playoffs">Playoff</TabsTrigger>
            <TabsTrigger value="standins">Standins</TabsTrigger>
            <TabsTrigger value="stats">Statystyki</TabsTrigger>
            <TabsTrigger value="announcements">Ogłoszenia</TabsTrigger>
          </TabsList>

          <TabsContent value="status">
            <TournamentStatusTab />
          </TabsContent>
          <TabsContent value="teams">
            <TeamVerificationTab />
          </TabsContent>
          <TabsContent value="matches">
            <MatchManagementTab />
          </TabsContent>
          <TabsContent value="import">
            <MatchImportTab />
          </TabsContent>
          <TabsContent value="standings">
            <StandingsTab />
          </TabsContent>
          <TabsContent value="stages">
            <StageManagementTab />
          </TabsContent>
          <TabsContent value="playoffs">
            <PlayoffManagementTab />
          </TabsContent>
          <TabsContent value="standins">
            <StandinManagementTab />
          </TabsContent>
          <TabsContent value="stats">
            <StatsManagementTab />
          </TabsContent>
          <TabsContent value="announcements">
            <AnnouncementsTab />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // For new tournaments (PDL style)
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8" style={{ color: theme.primaryColor }} />
          <h1 className="text-3xl font-bold">Panel administracyjny</h1>
        </div>
        <Badge style={{ backgroundColor: theme.primaryColor }}>
          {tournament.name}
        </Badge>
      </div>

      {/* Tournament Status Card */}
      <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Status turnieju
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="p-4 rounded-lg border" style={{ borderColor: theme.borderColor }}>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="text-lg font-bold capitalize">{tournament.status}</p>
            </div>
            <div className="p-4 rounded-lg border" style={{ borderColor: theme.borderColor }}>
              <p className="text-sm text-muted-foreground">Typ</p>
              <p className="text-lg font-bold">{isLeague ? 'Liga' : 'Turniej MMR'}</p>
            </div>
            <div className="p-4 rounded-lg border" style={{ borderColor: theme.borderColor }}>
              <p className="text-sm text-muted-foreground">League ID</p>
              <p className="text-lg font-bold">{tournament.leagueId || 'Brak'}</p>
            </div>
            <div className="p-4 rounded-lg border" style={{ borderColor: theme.borderColor }}>
              <p className="text-sm text-muted-foreground">Dywizje</p>
              <p className="text-lg font-bold">{tournament.divisions?.length || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admin Tabs */}
      <Tabs defaultValue="teams" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
          <TabsTrigger value="teams" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Drużyny
          </TabsTrigger>
          <TabsTrigger value="matches" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Mecze
          </TabsTrigger>
          <TabsTrigger value="divisions" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Dywizje
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Statystyki
          </TabsTrigger>
          <TabsTrigger value="import" className="flex items-center gap-2">
            <Import className="h-4 w-4" />
            Import
          </TabsTrigger>
          <TabsTrigger value="announcements" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Ogłoszenia
          </TabsTrigger>
        </TabsList>

        <TabsContent value="teams">
          <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
            <CardHeader>
              <CardTitle>Zarządzanie drużynami</CardTitle>
              <CardDescription>Weryfikuj i zarządzaj drużynami zarejestrowanymi w turnieju.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Panel zarządzania drużynami dla nowych turniejów będzie dostępny wkrótce.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matches">
          <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
            <CardHeader>
              <CardTitle>Zarządzanie meczami</CardTitle>
              <CardDescription>Ustalaj terminy meczów i importuj wyniki.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Panel zarządzania meczami dla nowych turniejów będzie dostępny wkrótce.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="divisions">
          <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
            <CardHeader>
              <CardTitle>Zarządzanie dywizjami</CardTitle>
              <CardDescription>Konfiguruj dywizje i zarządzaj awansami/spadkami.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Panel zarządzania dywizjami będzie dostępny wkrótce.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats">
          <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
            <CardHeader>
              <CardTitle>Statystyki</CardTitle>
              <CardDescription>Przeglądaj i przeliczaj statystyki turnieju.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Panel statystyk będzie dostępny wkrótce.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import">
          <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
            <CardHeader>
              <CardTitle>Import danych</CardTitle>
              <CardDescription>Importuj mecze i wyniki z OpenDota API.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Panel importu danych będzie dostępny wkrótce.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="announcements">
          <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
            <CardHeader>
              <CardTitle>Ogłoszenia</CardTitle>
              <CardDescription>Publikuj ogłoszenia dla uczestników turnieju.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Panel ogłoszeń będzie dostępny wkrótce.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
