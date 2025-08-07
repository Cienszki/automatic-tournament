
"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  ChevronRight,
  ExternalLink
} from "lucide-react";
import Link from "next/link";
import { MMRCalculator } from "@/components/app/rules/MMRCalculator";
import { useTranslation } from "@/hooks/useTranslation";

export default function RulesPage() {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState("general");
  
  const sections = [
    // Tournament Information
    { id: "general", icon: FileText, title: t("rules.sections.general"), group: t("rules.groups.tournamentInfo") },
    
    // Registration & Teams
    { id: "registration", icon: Users, title: t("rules.sections.registration"), group: t("rules.groups.registrationTeams") },
    
    // Players
    { id: "playerRequirements", icon: UserPlus, title: t("rules.sections.playerRequirements"), group: t("rules.groups.players") },
    
    // Tournament Information (continued)
    { id: "scheduling", icon: Calendar, title: t("rules.sections.scheduling"), group: t("rules.groups.tournamentInfo") },
    
    // Match Rules
    { id: "matchSettings", icon: Settings, title: t("rules.sections.matchSettings"), group: t("rules.groups.matchRules") },
    { id: "tournamentStructure", icon: Trophy, title: t("rules.sections.tournamentStructure"), group: t("rules.groups.tournamentInfo") },
    
    // Players (continued)
    { id: "standins", icon: Users, title: t("rules.sections.standins"), group: t("rules.groups.players") },
    
    // Restrictions
    { id: "prohibitions", icon: Ban, title: t("rules.sections.prohibitions"), group: t("rules.groups.restrictions") },
    
    // Match Rules (continued)
    { id: "conduct", icon: Heart, title: t("rules.sections.conduct"), group: t("rules.groups.matchRules") },
    
    // Additional Features
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
      {/* Hero Section */}
      <Card className="shadow-xl text-center relative overflow-hidden h-[320px] fhd:h-[320px] 2k:h-[500px] flex-col justify-center p-6">
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center opacity-80" 
          style={{ backgroundImage: `url(/backgrounds/rules.png)` }} 
        />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Table of Contents - Sidebar */}
        <Card className="lg:sticky lg:top-6 h-fit">
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
                  {isFirstInGroup && (
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1 mt-3 first:mt-0">
                      {section.group}
                    </h4>
                  )}
                  <Button
                    variant={activeSection === section.id ? "default" : "ghost"}
                    size="sm"
                    className="w-full justify-start text-left"
                    onClick={() => scrollToSection(section.id)}
                  >
                    <Icon className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="truncate">{section.title}</span>
                    <ChevronRight className="h-3 w-3 ml-auto flex-shrink-0" />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-8">
          
          {/* Section 1: General Information */}
          <Card id="general">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <FileText className="h-6 w-6 text-primary" />
                {t("rules.general.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold">{t("rules.general.administrator")}</h4>
                  <p className="text-sm text-muted-foreground">{t("rules.general.administratorName")}</p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">{t("rules.general.registrationPeriod")}</h4>
                  <Badge variant="outline">{t("rules.general.registrationDates")}</Badge>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">{t("rules.general.organizers")}</h4>
                  <p className="text-sm text-muted-foreground">{t("rules.general.organizersList")}</p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">{t("rules.general.officialCommunication")}</h4>
                  <Badge variant="outline" className="border-primary/30 text-primary">{t("rules.general.discordServer")}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Team Registration */}
          <Card id="registration">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Users className="h-6 w-6 text-primary" />
                {t("rules.registration.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Captain Duties */}
              <div>
                <h3 className="text-lg font-semibold mb-3">{t("rules.registration.captainDuties.title")}</h3>
                <p className="text-sm text-muted-foreground mb-3">{t("rules.registration.captainDuties.description")}</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <span className="text-sm">{t("rules.registration.captainDuties.communication")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <span className="text-sm">{t("rules.registration.captainDuties.teamRegistration")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <span className="text-sm">{t("rules.registration.captainDuties.informationSharing")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <span className="text-sm">{t("rules.registration.captainDuties.accountRequirements")}</span>
                  </li>
                </ul>
              </div>

              <Separator />

              {/* Captain Change */}
              <div>
                <h3 className="text-lg font-semibold mb-3">{t("rules.registration.captainChange.title")}</h3>
                <p className="text-sm">{t("rules.registration.captainChange.description")}</p>
              </div>

              <Separator />

              {/* Team Composition */}
              <div>
                <h3 className="text-lg font-semibold mb-3">{t("rules.registration.teamComposition.title")}</h3>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <Users className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <span className="text-sm">{t("rules.registration.teamComposition.players")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Settings className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <span className="text-sm">{t("rules.registration.teamComposition.teamName")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Ban className="h-4 w-4 mt-0.5 text-red-500 flex-shrink-0" />
                    <span className="text-sm">{t("rules.registration.teamComposition.noRosterChanges")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Shield className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <span className="text-sm">{t("rules.registration.teamComposition.accountRestriction")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Settings className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <span className="text-sm">{t("rules.registration.teamComposition.leagueSettings")}</span>
                  </li>
                </ul>
              </div>

              <MMRCalculator />
            </CardContent>
          </Card>

          {/* Section 3: Player Requirements */}
          <Card id="playerRequirements">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <UserPlus className="h-6 w-6 text-primary" />
                {t("rules.playerRequirements.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <ChevronRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                  <span className="text-sm">{t("rules.playerRequirements.minimum50Games")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                  <span className="text-sm">{t("rules.playerRequirements.noVacBans")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                  <span className="text-sm">{t("rules.playerRequirements.activeAccount")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                  <span className="text-sm">{t("rules.playerRequirements.oneAccountPerPlayer")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                  <span className="text-sm">{t("rules.playerRequirements.smurfEvidence")}</span>
                </li>
              </ul>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-semibold">MMR Requirements</h4>
                <p className="text-sm text-muted-foreground">{t("rules.playerRequirements.mmrLimit")}</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <span className="text-sm">{t("rules.playerRequirements.minimumMMR")}</span>
                  </li>
                </ul>
                <Badge variant="outline" className="text-xs">{t("rules.playerRequirements.calculation")}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Scheduling */}
          <Card id="scheduling">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Calendar className="h-6 w-6 text-primary" />
                {t("rules.scheduling.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="list-decimal pl-5 space-y-2">
                <li className="text-sm">{t("rules.scheduling.step1")}</li>
                <li className="text-sm">{t("rules.scheduling.step2")}</li>
                <li className="text-sm">{t("rules.scheduling.step3")}</li>
                <li className="text-sm">{t("rules.scheduling.step4")}</li>
                <li className="text-sm">{t("rules.scheduling.step5")}</li>
                <li className="text-sm">{t("rules.scheduling.step6")}</li>
              </ol>
              <Separator />
              <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                  {t("rules.scheduling.captainResponsibility")}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Section 5: Match Settings */}
          <Card id="matchSettings">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Settings className="h-6 w-6 text-primary" />
                {t("rules.matchSettings.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Game Configuration */}
              <div className="space-y-3">
                <h4 className="font-semibold text-lg flex items-center gap-2">
                  <Gamepad2 className="h-5 w-5 text-primary" />
                  {t("rules.matchSettings.gameConfig.title")}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-accent/10 border border-accent/20 p-3 rounded-lg">
                    <Badge variant="outline" className="mb-2 border-accent/30">
                      🎮 Tryb
                    </Badge>
                    <p className="text-sm font-medium text-foreground">Captains Mode</p>
                  </div>
                  <div className="bg-accent/10 border border-accent/20 p-3 rounded-lg">
                    <Badge variant="outline" className="mb-2 border-accent/30">
                      🏆 Format
                    </Badge>
                    <p className="text-sm font-medium text-foreground">{t("rules.matchSettings.gameConfig.matchFormat")}</p>
                  </div>
                  <div className="bg-accent/10 border border-accent/20 p-3 rounded-lg">
                    <Badge variant="outline" className="mb-2 border-accent/30">
                      🌍 Serwer
                    </Badge>
                    <p className="text-sm font-medium text-foreground">{t("rules.matchSettings.gameConfig.server")}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Lobby Settings */}
              <div className="space-y-3">
                <h4 className="font-semibold text-lg flex items-center gap-2">
                  <Monitor className="h-5 w-5 text-primary" />
                  {t("rules.matchSettings.lobbySettings.title")}
                </h4>
                <div className="space-y-3">
                  <div className="bg-card border border-border p-4 rounded-lg">
                    <h5 className="font-medium text-foreground mb-2">📝 Nazwa gry</h5>
                    <code className="text-sm bg-muted px-2 py-1 rounded border text-foreground">
                      [Nazwa Drużyny 1] vs [Nazwa Drużyny 2]
                    </code>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-card border border-border p-3 rounded-lg">
                      <h5 className="font-medium text-foreground mb-1">👁️ Widoczność</h5>
                      <p className="text-sm text-muted-foreground">Public (Publiczne)</p>
                    </div>
                    <div className="bg-card border border-border p-3 rounded-lg">
                      <h5 className="font-medium text-foreground mb-1">🏆 Liga</h5>
                      <p className="text-sm text-muted-foreground">Letnia Batalia</p>
                    </div>
                  </div>
                  <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-lg">
                    <p className="text-sm font-medium text-destructive-foreground">
                      ⚠️ {t("rules.matchSettings.lobbySettings.teamNames")}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Game Rules */}
              <div className="space-y-3">
                <h4 className="font-semibold text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  {t("rules.matchSettings.gameRules.title")}
                </h4>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <Badge variant="outline" className="mt-0.5">🎲</Badge>
                    <span className="text-sm">{t("rules.matchSettings.gameRules.picks")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Badge variant="outline" className="mt-0.5">🏳️</Badge>
                    <span className="text-sm">{t("rules.matchSettings.gameRules.surrender")}</span>
                  </li>
                </ul>
              </div>
              
            </CardContent>
          </Card>

          {/* Section 6: Tournament Structure */}
          <Card id="tournamentStructure">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Trophy className="h-6 w-6 text-primary" />
                {t("rules.tournamentStructure.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg text-center">
                  <Badge variant="outline" className="mb-2 border-primary/30">
                    📊 Grupy
                  </Badge>
                  <p className="text-sm text-foreground">{t("rules.matchSettings.tournamentStructure.groupStage")}</p>
                  <p className="text-xs text-primary font-semibold mt-2">{t("rules.matchSettings.tournamentStructure.groupStageDates")}</p>
                </div>
                <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg text-center">
                  <Badge variant="outline" className="mb-2 border-primary/30">
                    🏆 Playoff
                  </Badge>
                  <p className="text-sm text-foreground">{t("rules.matchSettings.tournamentStructure.playoffs")}</p>
                  <p className="text-xs text-primary font-semibold mt-2">{t("rules.matchSettings.tournamentStructure.playoffDates")}</p>
                </div>
                <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg text-center">
                  <Badge variant="outline" className="mb-2 border-primary/30">
                    ⏸️ Przerwa
                  </Badge>
                  <p className="text-sm text-foreground">{t("rules.matchSettings.tournamentStructure.internationalBreak")}</p>
                  <p className="text-xs text-primary font-semibold mt-2">{t("rules.matchSettings.tournamentStructure.breakDates")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 7: Stand-ins */}
          <Card id="standins">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Users className="h-6 w-6 text-primary" />
                {t("rules.standins.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <p className="text-sm">{t("rules.standins.description")}</p>
                <h4 className="font-semibold">{t("rules.standins.requirements.title")}</h4>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <span className="text-sm">{t("rules.standins.requirements.notInOtherTeam")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <span className="text-sm">{t("rules.standins.requirements.mmrLimit")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <span className="text-sm">{t("rules.standins.requirements.accountRequirements")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <span className="text-sm">{t("rules.standins.requirements.registration")}</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Section 8: Prohibitions */}
          <Card id="prohibitions">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Ban className="h-6 w-6 text-red-500" />
                {t("rules.prohibitions.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-semibold text-red-600">{t("rules.prohibitions.strictlyForbidden")}</h4>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <Ban className="h-4 w-4 mt-0.5 text-red-500 flex-shrink-0" />
                    <span className="text-sm">{t("rules.prohibitions.cheating")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Ban className="h-4 w-4 mt-0.5 text-red-500 flex-shrink-0" />
                    <span className="text-sm">{t("rules.prohibitions.smurf")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Ban className="h-4 w-4 mt-0.5 text-red-500 flex-shrink-0" />
                    <span className="text-sm">{t("rules.prohibitions.matchFixing")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Ban className="h-4 w-4 mt-0.5 text-red-500 flex-shrink-0" />
                    <span className="text-sm">{t("rules.prohibitions.harassment")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Ban className="h-4 w-4 mt-0.5 text-red-500 flex-shrink-0" />
                    <span className="text-sm">{t("rules.prohibitions.multipleAccounts")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Ban className="h-4 w-4 mt-0.5 text-red-500 flex-shrink-0" />
                    <span className="text-sm">{t("rules.prohibitions.coaching")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Ban className="h-4 w-4 mt-0.5 text-red-500 flex-shrink-0" />
                    <span className="text-sm">{t("rules.prohibitions.bugsExploits")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Ban className="h-4 w-4 mt-0.5 text-red-500 flex-shrink-0" />
                    <span className="text-sm">{t("rules.prohibitions.rankedRules")}</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Section 9: Conduct */}
          <Card id="conduct">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Heart className="h-6 w-6 text-primary" />
                {t("rules.conduct.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <p className="text-sm">{t("rules.conduct.description")}</p>
                <h4 className="font-semibold">{t("rules.conduct.expectations.title")}</h4>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <Heart className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <span className="text-sm">{t("rules.conduct.expectations.respect")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Heart className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <span className="text-sm">{t("rules.conduct.expectations.fairPlay")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Heart className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <span className="text-sm">{t("rules.conduct.expectations.punctuality")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Heart className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <span className="text-sm">{t("rules.conduct.expectations.communication")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Heart className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <span className="text-sm">{t("rules.conduct.expectations.allChannels")}</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Section 10: Additional Provisions */}
          <Card id="additional">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <FileText className="h-6 w-6 text-primary" />
                {t("rules.additional.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-semibold">{t("rules.additional.penalties.title")}</h4>
                <p className="text-sm text-muted-foreground">{t("rules.additional.penalties.description")}</p>
                <h4 className="font-semibold">{t("rules.additional.disputes.title")}</h4>
                <p className="text-sm text-muted-foreground">{t("rules.additional.disputes.description")}</p>
                <h4 className="font-semibold">{t("rules.additional.updates.title")}</h4>
                <p className="text-sm text-muted-foreground">{t("rules.additional.updates.description")}</p>
              </div>
            </CardContent>
          </Card>

          {/* Section 11: Digital Platform Rules */}
          <Card id="digital">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Monitor className="h-6 w-6 text-primary" />
                {t("rules.digital.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-semibold">{t("rules.digital.websiteUsage.title")}</h4>
                <p className="text-sm text-muted-foreground">{t("rules.digital.websiteUsage.description")}</p>
                <h4 className="font-semibold">{t("rules.digital.dataProtection.title")}</h4>
                <p className="text-sm text-muted-foreground">{t("rules.digital.dataProtection.description")}</p>
                <h4 className="font-semibold">{t("rules.digital.technicalIssues.title")}</h4>
                <p className="text-sm text-muted-foreground">{t("rules.digital.technicalIssues.description")}</p>
              </div>
            </CardContent>
          </Card>

          {/* Section 12: Fantasy League */}
          <Card id="fantasy">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Crown className="h-6 w-6 text-primary" />
                {t("rules.fantasy.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <p className="text-sm">{t("rules.fantasy.description")}</p>
                <h4 className="font-semibold">{t("rules.fantasy.rules.title")}</h4>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <Crown className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <span className="text-sm">{t("rules.fantasy.rules.teamSelection")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Crown className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <span className="text-sm">{t("rules.fantasy.rules.scoring")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Crown className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <span className="text-sm">{t("rules.fantasy.rules.updates")}</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Section 13: Pick'em Challenge */}
          <Card id="pickem">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Award className="h-6 w-6 text-primary" />
                {t("rules.pickem.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <p className="text-sm">{t("rules.pickem.description")}</p>
                <h4 className="font-semibold">{t("rules.pickem.rules.title")}</h4>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <Award className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <span className="text-sm">{t("rules.pickem.rules.predictions")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Award className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <span className="text-sm">{t("rules.pickem.rules.points")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Award className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <span className="text-sm">{t("rules.pickem.rules.deadlines")}</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
