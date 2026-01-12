"use client";

import { useState } from "react";
import { useTournament } from '@/context/TournamentContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  ScrollText, 
  Users, 
  Trophy, 
  Clock, 
  Shield, 
  Settings, 
  UserPlus, 
  Ban, 
  Heart,
  FileText,
  Gamepad2,
  Calendar,
  Monitor,
  Crown,
  Award,
  ChevronRight
} from "lucide-react";
import Link from "next/link";
import { MMRCalculator } from "@/components/app/rules/MMRCalculator";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * Rules page - tournament rules and regulations
 */
export default function RulesPage() {
  const { tournament, theme, isLegacyTournament, getTournamentPath } = useTournament();
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState("general");

  if (!tournament) return null;

  const sections = [
    { id: "general", icon: FileText, title: t("rules.sections.general"), group: t("rules.groups.tournamentInfo") },
    { id: "registration", icon: Users, title: t("rules.sections.registration"), group: t("rules.groups.registrationTeams") },
    { id: "playerRequirements", icon: UserPlus, title: t("rules.sections.playerRequirements"), group: t("rules.groups.players") },
    { id: "scheduling", icon: Calendar, title: t("rules.sections.scheduling"), group: t("rules.groups.tournamentInfo") },
    { id: "matchSettings", icon: Settings, title: t("rules.sections.matchSettings"), group: t("rules.groups.matchRules") },
    { id: "tournamentStructure", icon: Trophy, title: t("rules.sections.tournamentStructure"), group: t("rules.groups.tournamentInfo") },
    { id: "standins", icon: Users, title: t("rules.sections.standins"), group: t("rules.groups.players") },
    { id: "prohibitions", icon: Ban, title: t("rules.sections.prohibitions"), group: t("rules.groups.restrictions") },
    { id: "conduct", icon: Heart, title: t("rules.sections.conduct"), group: t("rules.groups.matchRules") },
    { id: "additional", icon: FileText, title: t("rules.sections.additional"), group: t("rules.groups.additionalFeatures") },
    { id: "digital", icon: Monitor, title: t("rules.sections.digital"), group: t("rules.groups.additionalFeatures") },
    { id: "fantasy", icon: Crown, title: t("rules.sections.fantasy"), group: t("rules.groups.additionalFeatures") },
    { id: "pickem", icon: Award, title: t("rules.sections.pickem"), group: t("rules.groups.additionalFeatures") }
  ];

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ScrollText className="h-8 w-8" style={{ color: theme.primaryColor }} />
        <h1 className="text-3xl font-bold">Regulamin {tournament.name}</h1>
      </div>

      {/* Hero Section */}
      <Card className="shadow-xl text-center relative overflow-hidden h-[200px] md:h-[320px] flex-col justify-center p-6" style={{ borderColor: theme.borderColor }}>
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center opacity-80" 
          style={{ backgroundImage: `url(/backgrounds/rules.png)` }} 
        />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Table of Contents - Sidebar */}
        <Card className="lg:sticky lg:top-6 h-fit" style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ScrollText className="h-5 w-5" />
              {t("rules.tableOfContents")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sections.map((section, index) => {
              const Icon = section.icon;
              const isFirstInGroup = index === 0 || section.group !== sections[index - 1].group;
              
              return (
                <div key={section.id}>
                  {isFirstInGroup && index !== 0 && <Separator className="my-2" />}
                  {isFirstInGroup && (
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 mt-2">
                      {section.group}
                    </p>
                  )}
                  <Button
                    variant={activeSection === section.id ? "secondary" : "ghost"}
                    className="w-full justify-start text-sm"
                    onClick={() => scrollToSection(section.id)}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {section.title}
                    {activeSection === section.id && (
                      <ChevronRight className="h-4 w-4 ml-auto" />
                    )}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Rules Content */}
        <div className="lg:col-span-3 space-y-8">
          {/* General Section */}
          <Card id="general" style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" style={{ color: theme.primaryColor }} />
                {t("rules.sections.general")}
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-invert max-w-none">
              <p>{t("rules.content.general.description")}</p>
              <p><strong>{t("rules.content.general.tournamentName")}:</strong> {tournament.name}</p>
              <p><strong>{t("rules.content.general.status")}:</strong> {tournament.status}</p>
            </CardContent>
          </Card>

          {/* Registration Section */}
          <Card id="registration" style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" style={{ color: theme.primaryColor }} />
                {t("rules.sections.registration")}
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-invert max-w-none">
              <p>{t("rules.content.registration.description")}</p>
              {tournament.type === 'mmr-limited' && (
                <>
                  <p><strong>Limit MMR:</strong> {tournament.mmrCap?.toLocaleString('pl-PL')}</p>
                  <MMRCalculator />
                </>
              )}
            </CardContent>
          </Card>

          {/* Tournament Structure */}
          <Card id="tournamentStructure" style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" style={{ color: theme.primaryColor }} />
                {t("rules.sections.tournamentStructure")}
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-invert max-w-none">
              {tournament.type === 'mmr-limited' ? (
                <>
                  <p>{t("rules.content.tournamentStructure.groupStage")}</p>
                  <p>{t("rules.content.tournamentStructure.playoffs")}</p>
                </>
              ) : (
                <>
                  <p>Rozgrywki ligowe w formacie round-robin.</p>
                  <p>Mecze w formacie BO2 (2 punkty za wygraną, 1 punkt za remis).</p>
                  <p>Awanse i spadki między dywizjami po każdej kolejce.</p>
                  <p>Najlepsze drużyny z Elite grają turniej finałowy.</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Match Settings */}
          <Card id="matchSettings" style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" style={{ color: theme.primaryColor }} />
                {t("rules.sections.matchSettings")}
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-invert max-w-none">
              <p>{t("rules.content.matchSettings.captainsMode")}</p>
              <p>{t("rules.content.matchSettings.lobbySettings")}</p>
            </CardContent>
          </Card>

          {/* Standins */}
          <Card id="standins" style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" style={{ color: theme.primaryColor }} />
                {t("rules.sections.standins")}
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-invert max-w-none">
              {tournament.type === 'mmr-limited' ? (
                <p>{t("rules.content.standins.registeredOnly")}</p>
              ) : (
                <>
                  <p>Standin może być dowolny gracz spoza listy zbanowanych.</p>
                  <p>Wymagana zgoda kapitana drużyny przeciwnej (admin może override'ować odmowę).</p>
                  <p>Ten sam standin może zagrać tylko raz na kolejkę.</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Conduct */}
          <Card id="conduct" style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5" style={{ color: theme.primaryColor }} />
                {t("rules.sections.conduct")}
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-invert max-w-none">
              <p>{t("rules.content.conduct.fairPlay")}</p>
              <p>{t("rules.content.conduct.respect")}</p>
            </CardContent>
          </Card>

          {/* Prohibitions */}
          <Card id="prohibitions" style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ban className="h-5 w-5" style={{ color: theme.primaryColor }} />
                {t("rules.sections.prohibitions")}
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-invert max-w-none">
              <p>{t("rules.content.prohibitions.cheating")}</p>
              <p>{t("rules.content.prohibitions.smurfing")}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
