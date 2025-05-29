
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { generateMockSingleMatchRecords, generateMockPlayerAverageLeaders, generateMockTournamentHighlights } from "@/lib/mock-data";
import type { CategoryDisplayStats, CategoryRankingDetail, TournamentHighlightRecord } from "@/lib/definitions";
import { BarChartHorizontalBig, Trophy, Zap } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

async function getStatsData(): Promise<{
  singleMatchRecords: CategoryDisplayStats[];
  playerAverageLeaders: CategoryDisplayStats[];
  tournamentHighlights: TournamentHighlightRecord[];
}> {
  return {
    singleMatchRecords: generateMockSingleMatchRecords(),
    playerAverageLeaders: generateMockPlayerAverageLeaders(),
    tournamentHighlights: generateMockTournamentHighlights(),
  };
}

export default async function StatsPage() {
  const { singleMatchRecords, playerAverageLeaders, tournamentHighlights } = await getStatsData();

  const renderRankingDetailsTable = (details: CategoryRankingDetail[], isSingleMatchCategory: boolean) => (
    <Table className="mt-2 mb-4 bg-muted/20 rounded-md">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[60px] px-3 py-2">Rank</TableHead>
          <TableHead className="px-3 py-2">Player</TableHead>
          <TableHead className="px-3 py-2">Team</TableHead>
          <TableHead className="px-3 py-2">{isSingleMatchCategory ? "Value" : "Average Value"}</TableHead>
          {isSingleMatchCategory && <TableHead className="px-3 py-2">Hero</TableHead>}
          {isSingleMatchCategory && <TableHead className="px-3 py-2">Match</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {details.map((detail) => (
          <TableRow key={`${detail.rank}-${detail.playerName}-${detail.teamName}-${detail.value}`} className="text-sm">
            <TableCell className="font-semibold px-3 py-2">{detail.rank}</TableCell>
            <TableCell className="px-3 py-2">
              {detail.playerId && detail.teamId ? (
                <Link href={`/teams/${detail.teamId}/players/${detail.playerId}`} className="hover:text-primary">{detail.playerName}</Link>
              ) : (
                detail.playerName || 'N/A'
              )}
            </TableCell>
            <TableCell className="px-3 py-2">
              {detail.teamId ? (
                <Link href={`/teams/${detail.teamId}`} className="hover:text-primary">{detail.teamName}</Link>
              ) : (
                detail.teamName || 'N/A'
              )}
            </TableCell>
            <TableCell className="font-semibold text-primary px-3 py-2">{detail.value}</TableCell>
            {isSingleMatchCategory && <TableCell className="px-3 py-2">{detail.heroName}</TableCell>}
            {isSingleMatchCategory && (
              <TableCell className="text-xs text-muted-foreground px-3 py-2">
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
        ))}
      </TableBody>
    </Table>
  );

  const AccordionRowContent = ({ categoryData, isSingleMatchCategory }: { categoryData: CategoryDisplayStats, isSingleMatchCategory: boolean }) => {
    const topEntry = categoryData.rankings[0];
    if (!topEntry) return null; // Should not happen if mock data is correct

    return (
      <div className="grid grid-cols-5 md:grid-cols-7 items-center w-full text-sm py-3 px-4">
        {/* Category Name + Icon */}
        <div className="col-span-2 md:col-span-2 font-medium flex items-center">
          <categoryData.icon className="h-5 w-5 mr-3 text-muted-foreground shrink-0" />
          <span className="truncate" title={categoryData.categoryName}>{categoryData.categoryName}</span>
        </div>
        {/* Player */}
        <div className="col-span-1 md:col-span-1 truncate" title={topEntry.playerName}>
          {topEntry.playerId && topEntry.teamId ? (
              <Link href={`/teams/${topEntry.teamId}/players/${topEntry.playerId}`} className="hover:text-primary font-semibold">{topEntry.playerName}</Link>
            ) : (
              <span className="font-semibold">{topEntry.playerName || 'N/A'}</span>
            )}
        </div>
        {/* Team */}
        <div className="col-span-1 md:col-span-1 truncate" title={topEntry.teamName}>
           {topEntry.teamId ? (
              <Link href={`/teams/${topEntry.teamId}`} className="hover:text-primary">{topEntry.teamName}</Link>
            ) : (
              topEntry.teamName || 'N/A'
            )}
        </div>
        {/* Value */}
        <div className="col-span-1 md:col-span-1 font-semibold text-primary text-right md:text-left">{topEntry.value}</div>
        
        {/* Hero (Single Match Only) */}
        {isSingleMatchCategory && (
          <div className="hidden md:table-cell md:col-span-1 truncate" title={topEntry.heroName}>{topEntry.heroName}</div>
        )}
        {/* Match Context (Single Match Only) */}
        {isSingleMatchCategory && (
          <div className="hidden md:table-cell md:col-span-1 text-xs text-muted-foreground truncate">
             {topEntry.openDotaMatchUrl ? (
              <Link href={topEntry.openDotaMatchUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline">
                {topEntry.matchContext}
              </Link>
            ) : (
              topEntry.matchContext || 'N/A'
            )}
          </div>
        )}
      </div>
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
        <CardContent className="px-0 sm:px-2 md:px-4"> {/* Reduced padding for CardContent */}
          <Accordion type="single" collapsible className="w-full">
            {singleMatchRecords.map((categoryData) => (
              <AccordionItem value={categoryData.id} key={categoryData.id} className="border-b last:border-b-0">
                 <Card className="mb-0.5 shadow-none hover:bg-muted/5 transition-colors rounded-md overflow-hidden">
                    <AccordionTrigger className="p-0 hover:no-underline w-full data-[state=open]:bg-muted/10">
                        <AccordionRowContent categoryData={categoryData} isSingleMatchCategory={true} />
                    </AccordionTrigger>
                    <AccordionContent className="p-2 md:p-4">
                        {categoryData.rankings.length > 1 ? 
                        renderRankingDetailsTable(categoryData.rankings.slice(1), true) : 
                        <p className="text-sm text-muted-foreground">No further details.</p>}
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
                    <Card className="mb-0.5 shadow-none hover:bg-muted/5 transition-colors rounded-md overflow-hidden">
                        <AccordionTrigger className="p-0 hover:no-underline w-full data-[state=open]:bg-muted/10">
                            <AccordionRowContent categoryData={categoryData} isSingleMatchCategory={false} />
                        </AccordionTrigger>
                        <AccordionContent className="p-2 md:p-4">
                           {categoryData.rankings.length > 1 ? 
                           renderRankingDetailsTable(categoryData.rankings.slice(1), false) :
                           <p className="text-sm text-muted-foreground">No further details.</p>}
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

export const metadata = {
  title: "Statistics | Tournament Tracker",
  description: "Detailed player and tournament statistics.",
};
