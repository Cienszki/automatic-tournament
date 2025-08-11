"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, AlertCircle, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { getMatchesForTeam, getVerifiedStandins, createStandinRequest } from "@/lib/firestore";
import type { Team, Match, Standin, Player } from "@/lib/definitions";
import { formatNumber } from "@/lib/utils";
import { format } from "date-fns";

interface StandinRequestModalProps {
  team: Team;
  trigger: React.ReactNode;
}

const TEAM_MMR_CAP = 24000;

export function StandinRequestModal({ team, trigger }: StandinRequestModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'match' | 'players' | 'standins'>('match');
  const [matches, setMatches] = useState<Match[]>([]);
  const [standins, setStandins] = useState<Standin[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Selection state
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [unavailablePlayers, setUnavailablePlayers] = useState<string[]>([]);
  const [selectedStandins, setSelectedStandins] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, team.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [teamMatches, verifiedStandins] = await Promise.all([
        getMatchesForTeam(team.id),
        getVerifiedStandins()
      ]);
      
      // Filter to upcoming matches or matches that could still need standins
      const upcomingMatches = teamMatches.filter(match => 
        match.status !== 'completed' || 
        new Date(match.dateTime || match.defaultMatchTime) > new Date()
      );
      
      setMatches(upcomingMatches);
      setStandins(verifiedStandins);
    } catch (error) {
      console.error('Error loading standin request data:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się załadować danych.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePlayerToggle = (playerId: string) => {
    setUnavailablePlayers(prev => 
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
    // Reset standin selection when player selection changes
    setSelectedStandins([]);
  };

  const handleStandinToggle = (standinId: string) => {
    setSelectedStandins(prev => 
      prev.includes(standinId)
        ? prev.filter(id => id !== standinId)
        : [...prev, standinId]
    );
  };

  const calculateTeamMMR = () => {
    if (!team.players) return 0;
    
    // Get MMR of available players (not unavailable)
    const availablePlayersMMR = team.players
      .filter(player => !unavailablePlayers.includes(player.id))
      .reduce((sum, player) => sum + player.mmr, 0);
    
    // Add MMR of selected standins
    const standinsMMR = standins
      .filter(standin => selectedStandins.includes(standin.id))
      .reduce((sum, standin) => sum + standin.mmr, 0);
    
    return availablePlayersMMR + standinsMMR;
  };

  const getEligibleStandins = () => {
    if (!team.players || unavailablePlayers.length === 0) return [];
    
    const availablePlayersMMR = team.players
      .filter(player => !unavailablePlayers.includes(player.id))
      .reduce((sum, player) => sum + player.mmr, 0);
    
    const maxStandinMMR = TEAM_MMR_CAP - availablePlayersMMR;
    
    return standins.filter(standin => {
      // Check if adding this standin would exceed the cap
      const currentStandinsMMR = standins
        .filter(s => selectedStandins.includes(s.id))
        .reduce((sum, s) => sum + s.mmr, 0);
      
      return standin.mmr <= (maxStandinMMR - currentStandinsMMR);
    });
  };

  const canProceedToStandins = () => {
    return unavailablePlayers.length > 0 && unavailablePlayers.length <= 2;
  };

  const canSubmitRequest = () => {
    return selectedStandins.length === unavailablePlayers.length && 
           calculateTeamMMR() <= TEAM_MMR_CAP;
  };

  const handleSubmit = async () => {
    if (!selectedMatch || !team || !canSubmitRequest()) return;
    
    setSubmitting(true);
    try {
      await createStandinRequest(
        selectedMatch.id,
        team.id,
        team.captainId,
        unavailablePlayers,
        selectedStandins
      );
      
      toast({
        title: t('standins.success'),
        description: t('standins.standinsAssigned')
      });
      
      // Reset form and close modal
      setStep('match');
      setSelectedMatch(null);
      setUnavailablePlayers([]);
      setSelectedStandins([]);
      setOpen(false);
      
    } catch (error) {
      console.error('Error submitting standin request:', error);
      toast({
        title: t('standins.error'),
        description: t('standins.standinRequestFailed'),
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setStep('match');
    setSelectedMatch(null);
    setUnavailablePlayers([]);
    setSelectedStandins([]);
    setOpen(false);
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t('standins.requestStandinTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center py-8">
            <div className="text-muted-foreground">{t('standins.loading')}</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) resetAndClose();
      else setOpen(newOpen);
    }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('standins.requestStandinTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('standins.requestStandinDescription')}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Match Selection */}
        {step === 'match' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t('standins.chooseMatch')}</h3>
            {matches.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('standins.noUpcomingMatches')}
              </div>
            ) : (
              <div className="space-y-3">
                {matches.map((match) => {
                  const opponent = match.teamA.id === team.id ? match.teamB : match.teamA;
                  const matchDate = new Date(match.dateTime || match.defaultMatchTime);
                  
                  return (
                    <Card 
                      key={match.id} 
                      className={`cursor-pointer transition-colors ${
                        selectedMatch?.id === match.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedMatch(match)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Calendar className="h-4 w-4 text-primary" />
                            <span className="font-medium">vs {opponent.name}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {format(matchDate, 'dd.MM.yyyy HH:mm')}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t('standins.cancel')}
              </Button>
              <Button 
                onClick={() => setStep('players')} 
                disabled={!selectedMatch}
              >
                {t('standins.next')}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Player Selection */}
        {step === 'players' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t('standins.selectUnavailablePlayersTitle')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('standins.selectUnavailablePlayersDescription')}
            </p>
            
            <div className="space-y-3">
              {team.players?.map((player) => (
                <div key={player.id} className="flex items-center space-x-3 p-3 border rounded-md">
                  <Checkbox
                    id={player.id}
                    checked={unavailablePlayers.includes(player.id)}
                    onCheckedChange={() => handlePlayerToggle(player.id)}
                    disabled={unavailablePlayers.length >= 2 && !unavailablePlayers.includes(player.id)}
                  />
                  <Label htmlFor={player.id} className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{player.nickname}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{player.role}</Badge>
                        <span className="text-sm text-muted-foreground">{formatNumber(player.mmr)} MMR</span>
                      </div>
                    </div>
                  </Label>
                </div>
              ))}
            </div>
            
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setStep('match')}>
                {t('standins.backButton')}
              </Button>
              <Button 
                onClick={() => setStep('standins')} 
                disabled={!canProceedToStandins()}
              >
                {t('standins.next')}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Standin Selection */}
        {step === 'standins' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">
                {t('standins.chooseStandins')} ({selectedStandins.length}/{unavailablePlayers.length})
              </h3>
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <span>
                  {t('standins.totalMMR')}: {formatNumber(calculateTeamMMR())} / {formatNumber(TEAM_MMR_CAP)}
                  {calculateTeamMMR() > TEAM_MMR_CAP && (
                    <span className="text-red-500 ml-2">{t('standins.mmrExceeded')}</span>
                  )}
                </span>
              </div>
            </div>
            
            {getEligibleStandins().length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('standins.noEligibleStandins')}
              </div>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {getEligibleStandins().map((standin) => (
                  <div key={standin.id} className="flex items-center space-x-3 p-3 border rounded-md">
                    <Checkbox
                      id={standin.id}
                      checked={selectedStandins.includes(standin.id)}
                      onCheckedChange={() => handleStandinToggle(standin.id)}
                      disabled={selectedStandins.length >= unavailablePlayers.length && !selectedStandins.includes(standin.id)}
                    />
                    <Label htmlFor={standin.id} className="flex-1 cursor-pointer">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{standin.nickname}</span>
                          <span className="text-sm text-muted-foreground">{formatNumber(standin.mmr)} MMR</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {standin.roles.map((role) => (
                            <Badge key={role} variant="secondary" className="text-xs">
                              {role}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {standin.description}
                        </p>
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setStep('players')}>
                {t('standins.backButton')}
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={!canSubmitRequest() || submitting}
              >
                {submitting ? t('standins.sendingRequest') : t('standins.sendRequest')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
