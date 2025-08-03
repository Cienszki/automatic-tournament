"use client";

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trophy, Users, Calendar, Settings2 } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import type { Match } from '@/lib/definitions';
import { getAllMatches } from '@/lib/firestore';

export function MatchManagementTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [matches, setMatches] = React.useState<Match[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [updatingMatchId, setUpdatingMatchId] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchMatches() {
      try {
        const allMatches = await getAllMatches();
        setMatches(allMatches.sort((a, b) => {
          // Sort by group_id first, then by playoff_round
          if (a.group_id && b.group_id) {
            return a.group_id.localeCompare(b.group_id);
          }
          if (a.group_id && !b.group_id) return -1;
          if (!a.group_id && b.group_id) return 1;
          if (a.playoff_round && b.playoff_round) {
            return a.playoff_round - b.playoff_round;
          }
          return 0;
        }));
      } catch (error) {
        console.error('Error fetching matches:', error);
        toast({
          title: "Error",
          description: "Failed to load matches.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }
    fetchMatches();
  }, [toast]);

  const updateMatchFormat = async (matchId: string, format: 'bo1' | 'bo2' | 'bo3' | 'bo5') => {
    if (!user) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to perform this action.",
        variant: "destructive",
      });
      return;
    }

    setUpdatingMatchId(matchId);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/updateMatchFormat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ matchId, seriesFormat: format }),
      });

      const result = await response.json();
      if (result.success) {
        setMatches(prevMatches => 
          prevMatches.map(m => 
            m.id === matchId 
              ? { ...m, series_format: format } 
              : m
          )
        );
        toast({
          title: "Success!",
          description: `Match format updated to ${format.toUpperCase()}.`,
        });
      } else {
        throw new Error(result.message || 'Failed to update match format');
      }
    } catch (error) {
      console.error("Failed to update match format:", error);
      toast({
        title: "Error",
        description: "Could not update the match format. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingMatchId(null);
    }
  };

  const setGroupStageFormats = async () => {
    if (!user) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to perform this action.",
        variant: "destructive",
      });
      return;
    }

    try {
      const token = await user.getIdToken();
      const groupMatches = matches.filter(m => m.group_id);
      
      for (const match of groupMatches) {
        if (match.series_format !== 'bo2') {
          await updateMatchFormat(match.id, 'bo2');
        }
      }

      toast({
        title: "Success!",
        description: `Set ${groupMatches.length} group stage matches to BO2 format.`,
      });
    } catch (error) {
      console.error("Failed to set group stage formats:", error);
      toast({
        title: "Error",
        description: "Could not update group stage formats. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getMatchTypeDisplay = (match: Match) => {
    if (match.group_id) {
      return (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <span>Group {match.group_id.replace(/-/g, ' ').replace(/\w/g, l => l.toUpperCase())}</span>
        </div>
      );
    } else if (match.playoff_round) {
      return (
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4" />
          <span>Playoffs Round {match.playoff_round}</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          <span>Exhibition</span>
        </div>
      );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default">Completed</Badge>;
      case 'live':
        return <Badge variant="destructive">Live</Badge>;
      default:
        return <Badge variant="outline">Scheduled</Badge>;
    }
  };

  const getFormatDisplay = (format?: string) => {
    if (!format) return <Badge variant="outline">Not Set</Badge>;
    
    const formatUpper = format.toUpperCase();
    const variant = format === 'bo2' ? 'secondary' : format === 'bo3' ? 'default' : 'destructive';
    return <Badge variant={variant}>{formatUpper}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading matches...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Match Format Management
          </CardTitle>
          <CardDescription>
            Set series formats for tournament matches. Group stage matches should be BO2, while playoff matches can be BO3 or BO5.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <Button onClick={setGroupStageFormats} variant="outline">
              <Users className="h-4 w-4 mr-2" />
              Set All Group Matches to BO2
            </Button>
          </div>

          {matches.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Match Type</TableHead>
                  <TableHead>Teams</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Current Format</TableHead>
                  <TableHead>Set Format</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map(match => (
                  <TableRow key={match.id}>
                    <TableCell>
                      {getMatchTypeDisplay(match)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{match.teamA?.name || 'TBD'}</div>
                        <div className="text-sm text-muted-foreground">vs</div>
                        <div className="font-medium">{match.teamB?.name || 'TBD'}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(match.status)}
                    </TableCell>
                    <TableCell>
                      <div className="text-center">
                        <span className="font-mono">
                          {match.teamA?.score || 0} - {match.teamB?.score || 0}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getFormatDisplay(match.series_format)}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={match.series_format || ''}
                        onValueChange={(value) => updateMatchFormat(match.id, value as any)}
                        disabled={updatingMatchId === match.id}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue placeholder="Format" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bo1">BO1</SelectItem>
                          <SelectItem value="bo2">BO2</SelectItem>
                          <SelectItem value="bo3">BO3</SelectItem>
                          <SelectItem value="bo5">BO5</SelectItem>
                        </SelectContent>
                      </Select>
                      {updatingMatchId === match.id && (
                        <Loader2 className="h-4 w-4 animate-spin ml-2" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-muted-foreground py-10">
              <Calendar className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-4">No matches found.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Format Guidelines & Scoring</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">BO2</Badge>
                <span>Best of 2 - Used for group stage matches. Can end in draws (1-1).</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default">BO3</Badge>
                <span>Best of 3 - First to win 2 games. Common for playoff matches.</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="destructive">BO5</Badge>
                <span>Best of 5 - First to win 3 games. Used for finals and important matches.</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">BO1</Badge>
                <span>Best of 1 - Single game only. Quick elimination format.</span>
              </div>
            </div>
            
            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3">Group Stage Scoring (BO2 matches):</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Win 2-0:</span>
                  <span className="font-mono">2 points</span>
                </div>
                <div className="flex justify-between">
                  <span>Draw 1-1:</span>
                  <span className="font-mono">1 point each</span>
                </div>
                <div className="flex justify-between">
                  <span>Loss 0-2:</span>
                  <span className="font-mono">0 points</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Points are awarded based on individual games won, not matches won.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
