
import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { generateMockSingleMatchRecords, generateMockPlayerAverageLeaders, generateMockTournamentHighlights, heroColorMap, defaultHeroNames } from "@/lib/mock-data"; // Added heroColorMap
import type { CategoryDisplayStats, CategoryRankingDetail, TournamentHighlightRecord } from "@/lib/definitions";
import { 
  BarChartHorizontalBig, Trophy, Zap, Swords, HeartHandshake as HandshakeIcon, Coins, Eye, Bomb, ShieldAlert, DollarSign, Award,
  TrendingDown, Puzzle, Anchor, Flame, Snowflake, MountainSnow, Ghost, Ban, Moon,
  Copy as CopyIconLucide, ShieldOff, Waves, Trees, Bone, CloudLightning, Sparkles, Target,
  Axe as AxeIconLucide, Clock, Activity, ShieldCheck, ChevronsUp, Timer, Skull, ListChecks, Medal, Percent, Ratio, Home
} from "lucide-react";
import type { Icon as LucideIconType } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

async function getStatsData(): Promise<{
  singleMatchRecords: CategoryDisplayStats[];
  playerAverageLeaders: CategoryDisplayStats[];
  tournamentHighlights: TournamentHighlightRecord[];
}> {
  return new Promise((resolve) => {
    setTimeout(() => { 
      resolve({
        singleMatchRecords: generateMockSingleMatchRecords(),
        playerAverageLeaders: generateMockPlayerAverageLeaders(),
        tournamentHighlights: generateMockTournamentHighlights(),
      });
    }, 500);
  });
}

const heroIconMap: Record<string, LucideIconType> = {
  'Invoker': Sparkles,
  'Pudge': Anchor,
  'Juggernaut': Swords, 
  'Lion': Zap, 
  'Shadow Fiend': Ghost,
  'Anti-Mage': Ban,
  'Phantom Assassin': Swords,
  'Earthshaker': MountainSnow,
  'Lina': Flame,
  'Crystal Maiden': Snowflake,
  'Axe': AxeIconLucide,
  'Drow Ranger': Target,
  'Mirana': Moon,
  'Rubick': CopyIconLucide,
  'Templar Assassin': ShieldOff,
  'Slark': Waves,
  'Sven': ShieldAlert,
  'Tiny': Trees,
  'Witch Doctor': Bone,
  'Zeus': CloudLightning,
  'Windranger': Puzzle, 
  'Storm Spirit': Puzzle, 
  'Faceless Void': Puzzle, 
  'Spectre': Puzzle, 
  'Bristleback': Puzzle, 
  'Default': Puzzle,
};

const AccordionRowContent = ({ categoryData, isSingleMatchCategory }: { categoryData: CategoryDisplayStats, isSingleMatchCategory: boolean }) => {
  const topEntry = categoryData.rankings[0];

  return (
    <>
      {/* View for when accordion is CLOSED */}
      <div className={cn(
        "group-data-[state=open]:hidden grid items-center w-full text-sm py-3 px-4",
        "grid-cols-5 md:grid-cols-12" 
      )}>
        {/* Category Name + Icon */}
        <div className={cn(
          "font-medium flex items-center text-accent",
          "col-span-2", 
          isSingleMatchCategory ? "md:col-span-3" : "md:col-span-4" 
        )}>
          <categoryData.icon className="h-5 w-5 mr-3 shrink-0" />
          <span className="truncate" title={categoryData.categoryName}>{categoryData.categoryName}</span>
        </div>

        {topEntry ? (
          <>
            {/* Player */}
            <div className={cn(
              "truncate",
              "col-span-1",
              isSingleMatchCategory ? "md:col-span-2" : "md:col-span-3" 
            )} title={topEntry.playerName}>
              {topEntry.playerId && topEntry.teamId ? (
                <Link href={`/teams/${topEntry.teamId}/players/${topEntry.playerId}`} className="text-primary font-semibold hover:underline">{topEntry.playerName}</Link>
              ) : (
                <span className="text-primary font-semibold">{topEntry.playerName || 'N/A'}</span>
              )}
            </div>
            {/* Team */}
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
            {/* Value */}
            <div className={cn(
              "font-semibold text-primary text-right", 
              "col-span-1", 
              isSingleMatchCategory ? "md:col-span-2" : "md:col-span-2" 
            )}>{topEntry.value}</div>
            
            {isSingleMatchCategory && topEntry.heroName && (
              <>
                <div className={cn(
                    "truncate flex items-center",
                    "hidden md:block md:col-span-1"
                  )} title={topEntry.heroName}>
                  {(heroIconMap[topEntry.heroName] || heroIconMap['Default']) && 
                    React.createElement(heroIconMap[topEntry.heroName] || heroIconMap['Default'], { className: cn("h-4 w-4 mr-1 inline-block shrink-0", heroColorMap[topEntry.heroName] || 'text-primary') })
                  }
                  <span className={cn(heroColorMap[topEntry.heroName] || 'text-primary')}>{topEntry.heroName}</span>
                </div> 
                <div className="hidden md:block md:col-span-2 text-xs text-muted-foreground truncate" title={topEntry.matchContext}>
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
             {!isSingleMatchCategory && ( 
              <div className="hidden md:block md:col-span-3"></div>
            )}
          </>
        ) : (
          <div className="col-span-full text-muted-foreground italic text-center py-2">No entries for this category.</div>
        )}
      </div>
    </>
  );
};


const StatsPage = ({ data }: { data: Awaited<ReturnType<typeof getStatsData>> }) => {
  const { singleMatchRecords, playerAverageLeaders, tournamentHighlights } = data;

  const renderRankingDetailsTable = (details: CategoryRankingDetail[], isSingleMatchCategory: boolean) => (
    <Table className="mt-2 mb-4 rounded-md">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[60px] px-3 py-2">Rank</TableHead>
          <TableHead className="w-[180px] px-3 py-2">Player</TableHead>
          <TableHead className="w-[180px] px-3 py-2">Team</TableHead>
          <TableHead className="w-[80px] px-3 py-2 text-primary">Value</TableHead>
          {isSingleMatchCategory && <TableHead className="w-[150px] px-3 py-2">Hero</TableHead>}
          {isSingleMatchCategory && <TableHead className="w-[250px] px-3 py-2">Match</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {details.map((detail) => {
          const HeroIconComponent = isSingleMatchCategory && detail.heroName ? (heroIconMap[detail.heroName] || heroIconMap['Default']) : null;
          const heroColor = isSingleMatchCategory && detail.heroName ? (heroColorMap[detail.heroName] || 'text-primary') : 'text-primary';
          return (
            <TableRow key={`${detail.rank}-${detail.playerName}-${detail.teamName}-${detail.value}`} className="text-sm">
              <TableCell className="font-semibold px-3 py-2">{detail.rank}</TableCell>
              <TableCell className="px-3 py-2">
                {detail.playerId && detail.teamId ? (
                  <Link href={`/teams/${detail.teamId}/players/${detail.playerId}`} className="text-primary hover:underline">{detail.playerName}</Link>
                ) : (
                  <span className="text-primary">{detail.playerName || 'N/A'}</span>
                )}
              </TableCell>
              <TableCell className="px-3 py-2">
                {detail.teamId ? (
                  <Link href={`/teams/${detail.teamId}`} className="text-accent hover:underline">{detail.teamName}</Link>
                ) : (
                  <span className="text-accent">{detail.teamName || 'N/A'}</span>
                )}
              </TableCell>
              <TableCell className="font-semibold text-primary px-3 py-2">{detail.value}</TableCell>
              {isSingleMatchCategory && (
                <TableCell className="px-3 py-2">
                  <div className="flex items-center">
                    {HeroIconComponent && <HeroIconComponent className={cn("h-4 w-4 mr-1.5 shrink-0", heroColor)} />}
                    <span className={heroColor}>{detail.heroName}</span>
                  </div>
                </TableCell>
              )}
              {isSingleMatchCategory && (
                <TableCell className="text-xs text-muted-foreground px-3 py-2 truncate" title={detail.matchContext}>
                  {detail.openDotaMatchUrl ? (
                    <Link href={detail.openDotaMatchUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline">
                      {detail.matchContext}
                    </Link>
                  ) : (
                    detail.matchContext || 'N/A'
                  )}
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );


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
          <Accordion type="single" collapsible className="w-full">
            {singleMatchRecords.map((categoryData) => (
              <AccordionItem value={categoryData.id} key={categoryData.id} className="border-b last:border-b-0">
                 <Card className="mb-0.5 shadow-none hover:bg-muted/5 transition-colors rounded-md overflow-hidden group">
                    <AccordionTrigger className="p-0 hover:no-underline w-full data-[state=open]:bg-muted/10">
                        <AccordionRowContent categoryData={categoryData} isSingleMatchCategory={true} />
                    </AccordionTrigger>
                    <AccordionContent className="p-4 bg-card">
                        <div className="text-center mb-4">
                            <categoryData.icon className="h-8 w-8 mx-auto text-accent mb-1" />
                            <h3 className="text-xl font-semibold text-primary">{categoryData.categoryName}</h3>
                        </div>
                        {categoryData.rankings.length > 0 ? 
                        renderRankingDetailsTable(categoryData.rankings, true) : 
                        <p className="text-sm text-muted-foreground italic p-4 text-center">No entries for this category.</p>}
                    </AccordionContent>
                 </Card>
              </AccordionItem>
            ))}
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
           <Accordion type="single" collapsible className="w-full">
            {playerAverageLeaders.map((categoryData) => (
                <AccordionItem value={categoryData.id} key={categoryData.id} className="border-b last:border-b-0">
                    <Card className="mb-0.5 shadow-none hover:bg-muted/5 transition-colors rounded-md overflow-hidden group">
                        <AccordionTrigger className="p-0 hover:no-underline w-full data-[state=open]:bg-muted/10">
                            <AccordionRowContent categoryData={categoryData} isSingleMatchCategory={false} />
                        </AccordionTrigger>
                        <AccordionContent className="p-4 bg-card">
                           <div className="text-center mb-4">
                                <categoryData.icon className="h-8 w-8 mx-auto text-accent mb-1" />
                                <h3 className="text-xl font-semibold text-primary">{categoryData.categoryName}</h3>
                           </div>
                           {categoryData.rankings.length > 0 ? 
                           renderRankingDetailsTable(categoryData.rankings, false) :
                           <p className="text-sm text-muted-foreground italic p-4 text-center">No entries for this category.</p>}
                        </AccordionContent>
                    </Card>
                </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-primary">Overall Tournament Records</CardTitle>
          <CardDescription>Memorable moments and records from the tournament.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-6">
          {tournamentHighlights.map((highlight) => (
            <Card key={highlight.id} className="bg-muted/30">
              <CardHeader className="flex flex-row items-center space-x-3 pb-2">
                <highlight.icon className="h-6 w-6 text-accent" />
                <CardTitle className="text-lg">{highlight.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">{highlight.value}</p>
                {highlight.details && <p className="text-xs text-muted-foreground pt-1">{highlight.details}</p>}
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground text-center mt-8">
        Note: All statistics are simulated for demonstration purposes.
      </p>
    </div>
  );
}

export default async function StatsPageServer() {
  const data = await getStatsData();
  return <StatsPage data={data} />;
}

export const metadata = {
  title: "Statistics | Tournament Tracker",
  description: "Detailed player and tournament statistics.",
};
