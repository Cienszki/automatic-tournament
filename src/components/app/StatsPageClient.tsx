
"use client";

import * as React from "react";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { CategoryDisplayStats, CategoryRankingDetail, TournamentHighlightRecord } from "@/lib/definitions";
import { heroIconMap, heroColorMap, FALLBACK_HERO_COLOR, defaultHeroNames } from "@/lib/hero-data";
import { 
  BarChartHorizontalBig, Trophy, Zap, Swords, Coins, Eye, Bomb, ShieldAlert, Award,
  TrendingDown, Puzzle, Anchor, Flame, Snowflake, MountainSnow, Ghost, Ban, Moon,
  Copy as CopyIconLucide, ShieldOff, Waves, Trees, Bone, CloudLightning, Sparkles, Target,
  Axe as AxeIconLucide, Clock, Activity, ShieldCheck, ChevronsUp, Timer, Skull, ListChecks, Medal, Percent, Ratio, Home,
  Handshake as HandshakeIcon,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface StatsPageClientProps {
  data: {
    singleMatchRecords: CategoryDisplayStats;
    playerAverageLeaders: CategoryDisplayStats;
    tournamentHighlights: TournamentHighlightRecord[];
  }
}

export function StatsPageClient({ data }: StatsPageClientProps) {
  const { singleMatchRecords, playerAverageLeaders, tournamentHighlights } = data;
  const [openAccordionItem, setOpenAccordionItem] = useState<string | undefined>();

  const ICONS: { [key: string]: React.ElementType } = {
    Trophy, Zap, Swords, Coins, Eye, Bomb, ShieldAlert, Award, TrendingDown, Puzzle, Anchor, Flame, Snowflake, MountainSnow, Ghost, Ban, Moon, CopyIconLucide, ShieldOff, Waves, Trees, Bone, CloudLightning, Sparkles, Target, AxeIconLucide, Clock, Activity, ShieldCheck, ChevronsUp, Timer, Skull, ListChecks, Medal, Percent, Ratio, Home, HandshakeIcon, BarChartHorizontalBig
  };

  const AccordionRowContent = ({ categoryData, isSingleMatchCategory }: { categoryData: { id: string, categoryName: string, icon: string, rankings: CategoryRankingDetail[] }, isSingleMatchCategory: boolean }) => {
    const topEntry = categoryData.rankings[0];
    const Icon = ICONS[categoryData.icon];
  
    return (
        // This div's content is effectively the AccordionTrigger's appearance when closed
        <div className={cn(
          "group-data-[state=open]:hidden grid items-center w-full text-sm py-3 px-4",
          "grid-cols-5 md:grid-cols-12" 
        )}>
          <div className={cn(
            "font-medium flex items-center text-accent",
            "col-span-2", 
            isSingleMatchCategory ? "md:col-span-3" : "md:col-span-4" 
          )}>
            <Icon className="h-5 w-5 mr-3 shrink-0 text-accent" />
            <span className="truncate" title={categoryData.categoryName}>{categoryData.categoryName}</span>
          </div>
  
          {topEntry ? (
            <>
              <div className={cn(
                "truncate",
                "col-span-1",
                isSingleMatchCategory ? "md:col-span-2" : "md:col-span-3" 
              )} title={topEntry.player.nickname}>
                {topEntry.player.id && topEntry.teamId ? (
                  <Link href={`/teams/${topEntry.teamId}/players/${topEntry.player.id}`} className="text-primary font-semibold hover:underline">{topEntry.player.nickname}</Link>
                ) : (
                  <span className="text-primary font-semibold">{topEntry.player.nickname || 'N/A'}</span>
                )}
              </div>
              <div className={cn(
                "truncate",
                "col-span-1",
                isSingleMatchCategory ? "md:col-span-2" : "md:col-span-3" 
              )} title={topEntry.teamName}>
                {topEntry.teamId ? (
                  <Link href={`/teams/${topEntry.teamId}`} className="text-accent hover:underline">{topEntry.teamName}</Link>
                ) : (
                  <span className="text-accent">{topEntry.teamName || 'N/A'}</span>
                )}
              </div>
              <div className={cn(
                "font-semibold text-center", 
                "col-span-1", 
                isSingleMatchCategory ? "md:col-span-2" : "md:col-span-2" 
              )}>{topEntry.value}</div>
              
              {isSingleMatchCategory && topEntry.heroName && (
                <>
                  <div className={cn(
                      "truncate flex items-center",
                      "hidden md:block md:col-span-2" 
                    )} title={topEntry.heroName}>
                    {(heroIconMap[topEntry.heroName] || heroIconMap['Default']) && 
                      React.createElement(heroIconMap[topEntry.heroName] || heroIconMap['Default'], { 
                        className: cn("h-4 w-4 mr-1.5 shrink-0"),
                        color: heroColorMap[topEntry.heroName] || FALLBACK_HERO_COLOR
                      })
                    }
                    <span style={{color: heroColorMap[topEntry.heroName] || FALLBACK_HERO_COLOR}}>{topEntry.heroName}</span>
                  </div> 
                  <div className={cn(
                      "hidden md:block md:col-span-1 text-xs text-muted-foreground truncate", 
                      "overflow-hidden text-ellipsis whitespace-nowrap"
                  )} title={topEntry.matchContext}>
                    {topEntry.openDotaMatchUrl ? (
                      <Link href={topEntry.openDotaMatchUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline">
                        {topEntry.matchContext}
                      </Link>
                    ) : (
                      topEntry.matchContext || 'N/A'
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="col-span-full text-muted-foreground italic text-center py-2">No entries for this category.</div>
          )}
        </div>
    );
  };

  const renderRankingDetailsTable = (details: CategoryRankingDetail[], isSingleMatchCategory: boolean) => {
    const headerCells: JSX.Element[] = [
      <TableHead key="rank" className="w-[60px] px-3 py-2">Rank</TableHead>,
      <TableHead key="player" className="w-[180px] px-3 py-2">Player</TableHead>,
      <TableHead key="team" className="w-[180px] px-3 py-2">Team</TableHead>,
      <TableHead key="value" className="w-[100px] px-3 py-2 text-center">Value</TableHead>
    ];

    if (isSingleMatchCategory) {
      headerCells.push(<TableHead key="hero" className="w-[150px] px-3 py-2">Hero</TableHead>);
      headerCells.push(<TableHead key="match" className="w-[250px] px-3 py-2">Match</TableHead>);
    }
    
    return (
      <Table className="mt-2 mb-4 rounded-md">
        <TableHeader>
          <TableRow>
            {headerCells}
          </TableRow>
        </TableHeader>
        <TableBody>
          {details.map((detail) => {
            const heroColorHex = (isSingleMatchCategory && detail.heroName ? (heroColorMap[detail.heroName] || FALLBACK_HERO_COLOR) : FALLBACK_HERO_COLOR);
            const valueColor = (isSingleMatchCategory && detail.heroName && detail.value) ? heroColorHex : 'hsl(var(--primary))';
            
            const HeroIconComponent = isSingleMatchCategory && detail.heroName ? (heroIconMap[detail.heroName] || heroIconMap['Default']) : null;

            const rowCells: JSX.Element[] = [
              <TableCell key="rank" className="font-semibold px-3 py-2">{detail.rank}</TableCell>,
              <TableCell key="player" className="px-3 py-2 w-[180px]">
                {detail.player.id && detail.teamId ? (
                  <Link href={`/teams/${detail.teamId}/players/${detail.player.id}`} className="text-primary font-semibold hover:underline">{detail.player.nickname}</Link>
                ) : (
                  <span className="text-primary font-semibold">{detail.player.nickname || 'N/A'}</span>
                )}
              </TableCell>,
              <TableCell key="team" className="px-3 py-2 w-[180px]">
                {detail.teamId ? (
                  <Link href={`/teams/${detail.teamId}`} className="text-accent hover:underline">{detail.teamName}</Link>
                ) : (
                  <span className="text-accent">{detail.teamName || 'N/A'}</span>
                )}
              </TableCell>,
              <TableCell key="value" style={{color: valueColor}} className="font-semibold px-3 py-2 text-center w-[100px]">{detail.value}</TableCell>
            ];

            if (isSingleMatchCategory) {
              rowCells.push(
                <TableCell key="hero" className="px-3 py-2 w-[150px]">
                  <div className="flex items-center">
                    {HeroIconComponent && <HeroIconComponent color={heroColorHex} className={cn("h-4 w-4 mr-1.5 shrink-0")} />}
                    <span style={{ color: heroColorHex }}>{detail.heroName}</span>
                  </div>
                </TableCell>
              );
              rowCells.push(
                <TableCell key="match" className="text-xs text-muted-foreground px-3 py-2 w-[250px] truncate" title={detail.matchContext || undefined}>
                  {detail.openDotaMatchUrl ? (
                    <Link href={detail.openDotaMatchUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline">
                      {detail.matchContext}
                    </Link>
                  ) : (
                    detail.matchContext || 'N/A'
                  )}
                </TableCell>
              );
            }

            return (
              <TableRow key={`${detail.rank}-${detail.player.nickname}-${detail.teamName}-${detail.value}`} className="text-sm">
                {rowCells}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };


  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <BarChartHorizontalBig className="h-16 w-16 mx-auto text-primary mb-4" />
          <CardTitle className="text-4xl font-bold text-primary">Tournament Statistics</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Deep dive into player performances and tournament records.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-primary flex items-center">
            <Trophy className="h-6 w-6 mr-2" /> Single Match Standouts
          </CardTitle>
          <CardDescription>Top individual performances in a single match. Click a row to see more.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-2 md:px-4">
          <Accordion 
            type="single" 
            collapsible 
            className="w-full"
            value={openAccordionItem}
            onValueChange={setOpenAccordionItem}
          >
            {Object.values(singleMatchRecords).map((categoryData) => {
              const Icon = ICONS[categoryData.icon];
              return (
              <AccordionItem value={categoryData.id} key={categoryData.id} className="border-b last:border-b-0">
                 <Card className="mb-0.5 shadow-none hover:bg-muted/5 transition-colors rounded-md overflow-hidden group">
                    <AccordionTrigger className="p-0 hover:no-underline w-full data-[state=open]:bg-muted/10 group">
                        <AccordionRowContent categoryData={categoryData} isSingleMatchCategory={true} />
                    </AccordionTrigger>
                    <AccordionContent className="p-4 bg-card">
                        <div 
                          className="text-center mb-4 flex flex-col items-center cursor-pointer"
                          onClick={() => setOpenAccordionItem(openAccordionItem === categoryData.id ? undefined : categoryData.id)}
                        >
                            <Icon className="h-8 w-8 text-accent mb-1" />
                            <h3 className="text-xl font-semibold text-primary">{categoryData.categoryName}</h3>
                        </div>
                        {categoryData.rankings.length > 0 ? 
                        renderRankingDetailsTable(categoryData.rankings, true) : 
                        <p className="text-sm text-muted-foreground italic p-4 text-center">No entries for this category.</p>}
                    </AccordionContent>
                 </Card>
              </AccordionItem>
            )})}
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-primary flex items-center">
            <Zap className="h-6 w-6 mr-2" /> Tournament Average Leaders
          </CardTitle>
          <CardDescription>Players leading in average performance. Click a row to see more.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-2 md:px-4">
           <Accordion 
              type="single" 
              collapsible 
              className="w-full"
              value={openAccordionItem}
              onValueChange={setOpenAccordionItem}
            >
            {Object.values(playerAverageLeaders).map((categoryData) => {
              const Icon = ICONS[categoryData.icon];
              return (
                <AccordionItem value={categoryData.id} key={categoryData.id} className="border-b last:border-b-0">
                    <Card className="mb-0.5 shadow-none hover:bg-muted/5 transition-colors rounded-md overflow-hidden group">
                        <AccordionTrigger className="p-0 hover:no-underline w-full data-[state=open]:bg-muted/10 group">
                            <AccordionRowContent categoryData={categoryData} isSingleMatchCategory={false} />
                        </AccordionTrigger>
                        <AccordionContent className="p-4 bg-card">
                           <div 
                             className="text-center mb-4 flex flex-col items-center cursor-pointer"
                             onClick={() => setOpenAccordionItem(openAccordionItem === categoryData.id ? undefined : categoryData.id)}
                           >
                                <Icon className="h-8 w-8 text-accent mb-1" />
                                <h3 className="text-xl font-semibold text-primary">{categoryData.categoryName}</h3>
                           </div>
                           {categoryData.rankings.length > 0 ? 
                           renderRankingDetailsTable(categoryData.rankings, false) :
                           <p className="text-sm text-muted-foreground italic p-4 text-center">No entries for this category.</p>}
                        </AccordionContent>
                    </Card>
                </AccordionItem>
            )})}
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-primary">Overall Tournament Records</CardTitle>
          <CardDescription>Memorable moments and records from the tournament.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-6">
          {tournamentHighlights.map((highlight) => {
            const Icon = ICONS[highlight.icon];
            return (
            <Card key={highlight.id} className="bg-muted/30">
              <CardHeader className="flex flex-row items-center space-x-3 pb-2">
                <Icon className="h-6 w-6 text-accent" />
                <CardTitle className="text-lg">{highlight.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">{highlight.value}</p>
                {highlight.details && <p className="text-xs text-muted-foreground pt-1">{highlight.details}</p>}
              </CardContent>
            </Card>
          )})}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground text-center mt-8">
        Note: All statistics are simulated for demonstration purposes.
      </p>
    </div>
  );
}
