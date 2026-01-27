"use client";

import React, { useEffect, useState } from 'react';
import { useTournament, useTournamentType } from '@/context/TournamentContext';
import { useAuth } from '@/context/AuthContext';
import { checkIfAdmin } from '@/lib/auth';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  Settings, 
  Shield,
  LogIn,
  Loader2,
  Layers,
  CalendarDays,
  Users,
  ArrowLeftRight,
  Gamepad2,
  Crown,
  Newspaper,
  BarChart3,
  ScrollText,
  Building2,
} from 'lucide-react';

// Import admin tab components
import { GeneralTab } from './tabs/GeneralTab';
import { TournamentStructureTab } from './tabs/TournamentStructureTab';
import { DivisionsTab } from './tabs/DivisionsTab';
import { SchedulingTab } from './tabs/SchedulingTab';
import { TeamsTab } from './tabs/TeamsTab';
import { TransfersTab } from './tabs/TransfersTab';
import { StandinsTab } from './tabs/StandinsTab';
import { MatchesTab } from './tabs/MatchesTab';
import { FantasyPickemTab } from './tabs/FantasyPickemTab';
import { NewsTab } from './tabs/NewsTab';
import { StatsTab } from './tabs/StatsTab';
import { RulesTab } from './tabs/RulesTab';

/**
 * Admin Panel - Tournament Administration
 * Modern, ultra-clean design matching the rest of the platform
 */
export default function AdminPage() {
  const { tournament, theme } = useTournament();
  const { isLeague } = useTournamentType();
  const { user, signInWithGoogle } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('general');

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

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin" style={{ color: theme.primaryColor }} />
          <p className="text-muted-foreground font-logik">Ładowanie panelu...</p>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-0 shadow-2xl bg-card/80 backdrop-blur-xl">
          <CardHeader className="text-center pb-2">
            <div 
              className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: `${theme.primaryColor}20` }}
            >
              <Shield className="h-8 w-8" style={{ color: theme.primaryColor }} />
            </div>
            <CardTitle className="text-2xl font-logik-extended-bold">Panel Administracyjny</CardTitle>
            <CardDescription className="font-logik">
              Zaloguj się aby uzyskać dostęp do panelu administracyjnego.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <Button 
              onClick={signInWithGoogle} 
              className="w-full h-12 font-logik"
              style={{ backgroundColor: theme.primaryColor }}
            >
              <LogIn className="mr-2 h-5 w-5" />
              Zaloguj przez Google
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not an admin
  if (!isAdmin) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-0 shadow-2xl bg-card/80 backdrop-blur-xl">
          <CardHeader className="text-center pb-2">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-red-500/20">
              <Shield className="h-8 w-8 text-red-500" />
            </div>
            <CardTitle className="text-2xl font-logik-extended-bold text-red-500">Brak dostępu</CardTitle>
            <CardDescription className="font-logik">
              Nie masz uprawnień do przeglądania tej strony.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 text-center">
            <p className="text-sm text-muted-foreground font-logik">
              Skontaktuj się z administratorem platformy aby uzyskać dostęp.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tab configuration
  const tabs = [
    { id: 'general', label: 'Ogólne', icon: Settings },
    { id: 'structure', label: 'Struktura', icon: Building2 },
    { id: 'divisions', label: 'Dywizje', icon: Layers, showFor: 'league' },
    { id: 'scheduling', label: 'Terminarz', icon: CalendarDays },
    { id: 'teams', label: 'Drużyny', icon: Users },
    { id: 'transfers', label: 'Transfery', icon: ArrowLeftRight, showFor: 'league' },
    { id: 'standins', label: 'Standiny', icon: Shield },
    { id: 'matches', label: 'Mecze', icon: Gamepad2 },
    { id: 'fantasy', label: 'Fantasy', icon: Crown },
    { id: 'news', label: 'Aktualności', icon: Newspaper },
    { id: 'stats', label: 'Statystyki', icon: BarChart3 },
    { id: 'rules', label: 'Regulamin', icon: ScrollText },
  ];

  // Filter tabs based on tournament type
  const filteredTabs = tabs.filter(tab => {
    if (!tab.showFor) return true;
    if (tab.showFor === 'league' && isLeague) return true;
    if (tab.showFor === 'mmr-limited' && !isLeague) return true;
    return false;
  });

  return (
    <div className="min-h-[calc(100vh-4rem)] font-logik">
      {/* Tabs Navigation - Full width, at the very top */}
      <div className="sticky top-14 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full h-auto p-1 bg-transparent flex flex-wrap justify-start gap-1">
              {filteredTabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-200",
                    "data-[state=active]:shadow-lg font-logik text-sm",
                    "hover:bg-muted/50"
                  )}
                  style={{
                    backgroundColor: activeTab === tab.id ? theme.primaryColor : undefined,
                    color: activeTab === tab.id ? 'white' : undefined,
                  }}
                >
                  <tab.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Tab Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="general" className="mt-0">
            <GeneralTab />
          </TabsContent>
          
          <TabsContent value="structure" className="mt-0">
            <TournamentStructureTab />
          </TabsContent>
          
          <TabsContent value="divisions" className="mt-0">
            <DivisionsTab />
          </TabsContent>
          
          <TabsContent value="scheduling" className="mt-0">
            <SchedulingTab />
          </TabsContent>
          
          <TabsContent value="teams" className="mt-0">
            <TeamsTab />
          </TabsContent>
          
          <TabsContent value="transfers" className="mt-0">
            <TransfersTab />
          </TabsContent>
          
          <TabsContent value="standins" className="mt-0">
            <StandinsTab />
          </TabsContent>
          
          <TabsContent value="matches" className="mt-0">
            <MatchesTab />
          </TabsContent>
          
          <TabsContent value="fantasy" className="mt-0">
            <FantasyPickemTab />
          </TabsContent>
          
          <TabsContent value="news" className="mt-0">
            <NewsTab />
          </TabsContent>
          
          <TabsContent value="stats" className="mt-0">
            <StatsTab />
          </TabsContent>
          
          <TabsContent value="rules" className="mt-0">
            <RulesTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
