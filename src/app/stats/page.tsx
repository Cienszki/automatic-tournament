
import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
// import { getPlayerStats } from "@/lib/firestore";
// import { heroIconMap, heroColorMap, FALLBACK_HERO_COLOR } from "@/lib/hero-data";
import type { CategoryDisplayStats, CategoryRankingDetail, TournamentHighlightRecord } from "@/lib/definitions";
import { 
  BarChartHorizontalBig, Trophy, Zap, Shield, Sword, Skull, Star, Diamond, TrendingUp, HeartPulse
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const ICONS: { [key: string]: React.ElementType } = {
  Trophy, Shield, Sword, Skull, Star, Diamond, TrendingUp, Zap, BarChartHorizontalBig, HeartPulse
};

const AccordionRowContent = ({ categoryData, isSingleMatchCategory }: { categoryData: { id: string; categoryName: string; icon: string; rankings: CategoryRankingDetail[] }, isSingleMatchCategory: boolean }) => {
  const topEntry = categoryData.rankings[0];
  const Icon = ICONS[categoryData.icon];
  return (
    <div className={cn("grid items-center w-full text-sm py-3 px-4", "grid-cols-5 md:grid-cols-12")}>
        <div className={cn("font-medium flex items-center text-accent col-span-2", isSingleMatchCategory ? "md:col-span-3" : "md:col-span-4")}>
            <Icon className="h-5 w-5 mr-3 shrink-0 text-accent" />
            <span className="truncate" title={categoryData.categoryName}>{categoryData.categoryName}</span>
        </div>
        <div className={cn("truncate col-span-1", isSingleMatchCategory ? "md:col-span-2" : "md:col-span-3")} title={topEntry?.player.nickname}>
            {topEntry?.player.nickname || 'N/A'}
        </div>
        <div className={cn("truncate col-span-1", isSingleMatchCategory ? "md:col-span-2" : "md:col-span-3")} title={topEntry?.teamName}>
            {topEntry?.teamName || 'N/A'}
        </div>
        <div className={cn("font-semibold text-center col-span-1", isSingleMatchCategory ? "md:col-span-2" : "md:col-span-2")}>{topEntry?.value ?? '-'}</div>
        {isSingleMatchCategory && topEntry?.heroName && (
            <div className="truncate hidden md:flex items-center md:col-span-2" title={topEntry.heroName}>
                <span>{topEntry.heroName}</span>
            </div>
        )}
    </div>
  );
};

const renderRankingDetailsTable = (details: CategoryRankingDetail[], isSingleMatchCategory: boolean) => {
    const headerCells = [ "Rank", "Player", "Team", "Value" ];
    if (isSingleMatchCategory) {
        headerCells.push("Hero", "Match");
    }

    return (
        <Table className="mt-2 mb-4">
            <TableHeader><TableRow>{headerCells.map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
                {details.map((detail, i) => (
                    <TableRow key={i}>
                        <TableCell>{detail.rank}</TableCell>
                        <TableCell>{detail.player.nickname}</TableCell>
                        <TableCell>{detail.teamName}</TableCell>
                        <TableCell>{detail.value}</TableCell>
                        {isSingleMatchCategory && <>
                            <TableCell>{detail.heroName}</TableCell>
                            <TableCell>{detail.matchContext}</TableCell>
                        </>}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};

const StatsPage = ({ data }: { data: any }) => {
  const { singleMatchRecords, playerAverageLeaders, tournamentHighlights } = data;

  return (
    <div className="space-y-8">
      <Card className="shadow-xl text-center relative overflow-hidden min-h-[30vh] flex flex-col justify-center p-6">
        <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: `url(/backgrounds/stats.png)` }} />
        <div className="relative z-10">
          <BarChartHorizontalBig className="h-16 w-16 mx-auto text-primary mb-4" />
          <h2 className="text-4xl font-bold text-primary" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>Tournament Statistics</h2>
          <p className="text-lg text-white mt-2" style={{ textShadow: '1px 1px 6px rgba(0,0,0,0.8)' }}>Deep dive into player performances and tournament records.</p>
        </div>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-2xl text-primary flex items-center"><Trophy className="h-6 w-6 mr-2" /> Single Match Standouts</CardTitle></CardHeader>
        <CardContent className="px-0 sm:px-2 md:px-4">
            <Accordion type="single" collapsible className="w-full">
                {/* {Object.values(singleMatchRecords).map((categoryData) => {
                    const Icon = ICONS[categoryData.icon];
                    return (
                        <AccordionItem value={categoryData.id} key={categoryData.id}>
                            <AccordionTrigger className="p-0 hover:no-underline w-full [&[data-state=open]>div]:hidden">
                              <AccordionRowContent categoryData={categoryData} isSingleMatchCategory={true} />
                            </AccordionTrigger>
                            <AccordionContent className="p-4">
                               <div className="text-center mb-4">
                                    <Icon className="h-8 w-8 text-accent mx-auto mb-2" />
                                    <h3 className="text-xl font-semibold text-primary">{categoryData.categoryName}</h3>
                                </div>
                                {renderRankingDetailsTable(categoryData.rankings, true)}
                            </AccordionContent>
                        </AccordionItem>
                    );
                })} */}
            </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-2xl text-primary flex items-center"><Zap className="h-6 w-6 mr-2" /> Tournament Average Leaders</CardTitle></CardHeader>
        <CardContent className="px-0 sm:px-2 md:px-4">
           <Accordion type="single" collapsible className="w-full">
            {/* {Object.values(playerAverageLeaders).map((categoryData) => {
                const Icon = ICONS[categoryData.icon];
                return (
                    <AccordionItem value={categoryData.id} key={categoryData.id}>
                        <AccordionTrigger className="p-0 hover:no-underline w-full [&[data-state=open]>div]:hidden">
                          <AccordionRowContent categoryData={categoryData} isSingleMatchCategory={false} />
                        </AccordionTrigger>
                        <AccordionContent className="p-4">
                            <div className="text-center mb-4">
                                <Icon className="h-8 w-8 text-accent mx-auto mb-2" />
                                <h3 className="text-xl font-semibold text-primary">{categoryData.categoryName}</h3>
                            </div>
                            {renderRankingDetailsTable(categoryData.rankings, false)}
                        </AccordionContent>
                    </AccordionItem>
                );
            })} */}
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-2xl text-primary">Overall Tournament Records</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-6">
            {/* {Object.values(tournamentHighlights).map((highlight) => {
                const Icon = ICONS[highlight.icon];
                return (
                  <Card key={highlight.id} className="bg-muted/30">
                    <CardHeader className="flex flex-row items-center space-x-3 pb-2"><Icon className="h-6 w-6 text-accent" /><CardTitle className="text-lg">{highlight.title}</CardTitle></CardHeader>
                    <CardContent><p className="text-3xl font-bold text-primary">{highlight.value}</p>{highlight.details && <p className="text-xs text-muted-foreground pt-1">{highlight.details}</p>}</CardContent>
                  </Card>
                );
            })} */}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground text-center mt-8">Statistics will be generated from match data after games are played.</p>
    </div>
  );
}

export default async function StatsPageServer() {
  // const data = await getPlayerStats();
  const data = {
    singleMatchRecords: {},
    playerAverageLeaders: {},
    tournamentHighlights: {},
  }
  return <StatsPage data={data} />;
}

export const metadata = {
  title: "Statistics | Tournament Tracker",
  description: "Detailed player and tournament statistics.",
};
