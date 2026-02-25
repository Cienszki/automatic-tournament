"use client";

import { useTournament, useTournamentType } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Layers, Trophy, ArrowUp, ArrowDown, Minus, Calendar, Info } from 'lucide-react';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { usePDLData } from '@/hooks/usePDLData';
import Link from 'next/link';

/**
 * Divisions page - shows division standings (League tournaments only)
 */
export default function DivisionsPage() {
  const { tournament, theme, getTournamentPath } = useTournament();
  const { isLeague } = useTournamentType();
  const { divisions: divisionsData, loading, error } = usePDLData();

  if (!tournament) return null;

  // This page is only for league tournaments
  if (!isLeague) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold mb-4">Strona niedostępna</h1>
        <p className="text-muted-foreground">
          Ten turniej nie posiada systemu dywizji.
        </p>
      </div>
    );
  }

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Layers className="h-8 w-8" style={{ color: theme.primaryColor }} />
          <h1 className="text-3xl font-bold">Dywizje</h1>
        </div>
        <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardContent className="py-8 text-center text-red-500">
            <p>Błąd ładowania danych: {error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Layers className="h-8 w-8" style={{ color: theme.primaryColor }} />
        <h1 className="text-3xl font-bold">Dywizje</h1>
      </div>

      {/* Legend */}
      <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500/20 border border-green-500 rounded" />
              <span>Strefa awansu</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500/20 border border-red-500 rounded" />
              <span>Strefa spadku</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-500/20 border border-yellow-500 rounded" />
              <span>Turniej finałowy (tylko Elite)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Format Info */}
      <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="h-5 w-5" />
            Format rozgrywek
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p><strong>Format meczu:</strong> BO2 (Best of Two)</p>
          <p><strong>Punktacja:</strong> Wygrana 2-0 = 2 pkt, Remis 1-1 = 1 pkt, Przegrana 0-2 = 0 pkt</p>
          <p><strong>Awanse/Spadki:</strong> Po każdej kolejce, mecze barażowe BO3</p>
        </CardContent>
      </Card>

      {/* Division Tables */}
      {divisionsData.length > 0 ? (
        <div className="space-y-8">
          {divisionsData.map((division) => {
            const standings = division.teams;
            
            // Calculate tier info dynamically from loaded divisions
            const sortedDivisions = [...divisionsData].sort((a, b) => (a.tier || 999) - (b.tier || 999));
            const isElite = division.tier === 1 || sortedDivisions[0]?.id === division.id;
            const isLowest = division.tier === sortedDivisions.length || sortedDivisions[sortedDivisions.length - 1]?.id === division.id;

            return (
              <Card 
                key={division.id} 
                style={{ 
                  backgroundColor: theme.cardColor, 
                  borderColor: division.color || theme.borderColor,
                  borderWidth: '2px'
                }}
                className="hover:shadow-lg transition-shadow"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-4">
                    <Link 
                      href={getTournamentPath(`/divisions/${division.id}`)}
                      className="flex items-center gap-3 group"
                    >
                      <div 
                        className="w-3 h-10 rounded-full group-hover:scale-110 transition-transform flex-shrink-0"
                        style={{ backgroundColor: division.color || theme.primaryColor }}
                      />
                      <CardTitle className="text-xl group-hover:underline m-0" style={{ color: division.color || theme.primaryColor }}>
                        {division.name}
                      </CardTitle>
                    </Link>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        {division.tier && `Tier ${division.tier} • `}{division.matchday || 'Mecze TBD'}
                      </span>
                      <Badge 
                        variant="outline" 
                        style={{ borderColor: division.color, color: division.color }}
                      >
                        {standings.length} drużyn
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {standings.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Drużyna</TableHead>
                          <TableHead className="text-center w-16">M</TableHead>
                          <TableHead className="text-center w-16">W</TableHead>
                          <TableHead className="text-center w-16">R</TableHead>
                          <TableHead className="text-center w-16">P</TableHead>
                          <TableHead className="text-center w-20">Gry</TableHead>
                          <TableHead className="text-center w-20">Pkt</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {standings.map((team, index) => {
                          // Determine row styling based on position
                          const isPromotion = !isElite && index === 0;
                          const isRelegation = !isLowest && index === standings.length - 1;
                          const isPlayoff = isElite && index < 4;

                          let rowStyle = {};
                          if (isPlayoff) {
                            rowStyle = { backgroundColor: 'rgba(234, 179, 8, 0.1)' };
                          } else if (isPromotion) {
                            rowStyle = { backgroundColor: 'rgba(34, 197, 94, 0.1)' };
                          } else if (isRelegation) {
                            rowStyle = { backgroundColor: 'rgba(239, 68, 68, 0.1)' };
                          }

                          return (
                            <TableRow key={team.teamId} style={rowStyle}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  {index + 1}
                                  {isPromotion && <ArrowUp className="h-4 w-4 text-green-500" />}
                                  {isRelegation && <ArrowDown className="h-4 w-4 text-red-500" />}
                                  {isPlayoff && index === 0 && <Trophy className="h-4 w-4 text-yellow-500" />}
                                </div>
                              </TableCell>
                              <TableCell className="font-medium">{team.teamName}</TableCell>
                              <TableCell className="text-center text-muted-foreground">{team.matchesPlayed}</TableCell>
                              <TableCell className="text-center text-green-500">{team.wins}</TableCell>
                              <TableCell className="text-center text-yellow-500">{team.draws}</TableCell>
                              <TableCell className="text-center text-red-500">{team.losses}</TableCell>
                              <TableCell className="text-center text-muted-foreground">
                                {team.gamesWon}-{team.gamesLost}
                              </TableCell>
                              <TableCell className="text-center font-bold" style={{ color: theme.primaryColor }}>
                                {team.points}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      Tabela zostanie uzupełniona po rozpoczęciu sezonu.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardContent className="py-16 text-center">
            <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Dywizje niedostępne</h3>
            <p className="text-muted-foreground">
              Dywizje zostaną ogłoszone przed rozpoczęciem sezonu.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
