"use client";

import React, { useState } from 'react';
import { useTournament, useTournamentType } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { 
  Building2,
  Save,
  RotateCcw,
  Trophy,
  ArrowUpDown,
  CalendarDays,
  Users,
  Repeat,
  GitBranch,
} from 'lucide-react';

/**
 * Tournament Structure Tab - Configure rounds, matches, playoffs, promotion/relegation
 */
export function TournamentStructureTab() {
  const { tournament, theme } = useTournament();
  const { isLeague } = useTournamentType();
  
  // Form state
  const [roundsCount, setRoundsCount] = useState(tournament?.roundsPerSeason || 2);
  const [matchesPerTeamPerRound, setMatchesPerTeamPerRound] = useState(1);
  const [hasPlayoffs, setHasPlayoffs] = useState(true);
  const [hasPromotionRelegation, setHasPromotionRelegation] = useState<boolean>(tournament?.promotionRelegationEnabled ?? true);
  const [teamsPromoted, setTeamsPromoted] = useState(1);
  const [teamsRelegated, setTeamsRelegated] = useState(1);
  const [defaultMatchFormat, setDefaultMatchFormat] = useState<string>(tournament?.defaultMatchFormat || 'bo2');
  const [playoffFormat, setPlayoffFormat] = useState('bo3');
  const [finalsFormat, setFinalsFormat] = useState('bo5');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    // TODO: Implement save functionality
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-logik-extended-bold">Struktura turnieju</h2>
          <p className="text-muted-foreground font-logik">
            Konfiguracja rund, meczów i playoffów
          </p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={isSaving}
          className="font-logik"
          style={{ backgroundColor: theme.primaryColor }}
        >
          {isSaving ? (
            <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Zapisz zmiany
        </Button>
      </div>

      {/* Rounds Configuration */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
            <Repeat className="h-5 w-5" style={{ color: theme.primaryColor }} />
            Rundy i mecze
          </CardTitle>
          <CardDescription className="font-logik">
            Ile rund i meczów w sezonie
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Liczba rund w sezonie</Label>
              <p className="text-sm text-muted-foreground font-logik mb-2">
                Ile razy każda drużyna gra z każdą inną
              </p>
              <Select 
                value={roundsCount.toString()} 
                onValueChange={(v) => setRoundsCount(Number(v))}
              >
                <SelectTrigger className="font-logik">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 runda</SelectItem>
                  <SelectItem value="2">2 rundy (każdy z każdym 2x)</SelectItem>
                  <SelectItem value="3">3 rundy</SelectItem>
                  <SelectItem value="4">4 rundy</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Spotkania na rundę</Label>
              <p className="text-sm text-muted-foreground font-logik mb-2">
                Ile razy każda drużyna gra z każdą inną w rundzie
              </p>
              <Select 
                value={matchesPerTeamPerRound.toString()} 
                onValueChange={(v) => setMatchesPerTeamPerRound(Number(v))}
              >
                <SelectTrigger className="font-logik">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1x (każdy z każdym raz)</SelectItem>
                  <SelectItem value="2">2x (każdy z każdym dwa razy)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Domyślny format meczu</Label>
              <p className="text-sm text-muted-foreground font-logik mb-2">
                Format meczów ligowych
              </p>
              <Select 
                value={defaultMatchFormat} 
                onValueChange={setDefaultMatchFormat}
              >
                <SelectTrigger className="font-logik">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bo1">BO1</SelectItem>
                  <SelectItem value="bo2">BO2</SelectItem>
                  <SelectItem value="bo3">BO3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Season Overview */}
          <div className="p-4 rounded-xl border border-border bg-background/50">
            <p className="text-sm font-logik-extended-bold mb-2">Podsumowanie sezonu</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm font-logik">
              <div>
                <span className="text-muted-foreground">Rundy:</span>
                <span className="ml-2 font-bold">{roundsCount}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Kolejki/rundę:</span>
                <span className="ml-2 font-bold">~{Math.ceil((tournament?.divisions?.length || 3) * 4 / roundsCount)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Format:</span>
                <span className="ml-2 font-bold uppercase">{defaultMatchFormat}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Czas trwania:</span>
                <span className="ml-2 font-bold">~{roundsCount * 4} tyg.</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Playoffs Configuration */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
            <Trophy className="h-5 w-5" style={{ color: theme.primaryColor }} />
            Finały playoffowe
          </CardTitle>
          <CardDescription className="font-logik">
            Turniej finałowy na koniec sezonu
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 rounded-xl border border-border">
            <div>
              <p className="font-logik-extended-bold">Włącz playoffy</p>
              <p className="text-sm text-muted-foreground font-logik">
                Turniej finałowy dla najlepszych drużyn z dywizji Elite
              </p>
            </div>
            <Switch
              checked={hasPlayoffs}
              onCheckedChange={setHasPlayoffs}
            />
          </div>

          {hasPlayoffs && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-border">
              <div className="space-y-2">
                <Label className="font-logik-extended-bold">Liczba drużyn</Label>
                <Select defaultValue="4">
                  <SelectTrigger className="font-logik">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">Top 4</SelectItem>
                    <SelectItem value="6">Top 6</SelectItem>
                    <SelectItem value="8">Top 8</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="font-logik-extended-bold">Format meczów playoff</Label>
                <Select 
                  value={playoffFormat} 
                  onValueChange={setPlayoffFormat}
                >
                  <SelectTrigger className="font-logik">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bo1">BO1</SelectItem>
                    <SelectItem value="bo3">BO3</SelectItem>
                    <SelectItem value="bo5">BO5</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="font-logik-extended-bold">Format wielkiego finału</Label>
                <Select 
                  value={finalsFormat} 
                  onValueChange={setFinalsFormat}
                >
                  <SelectTrigger className="font-logik">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bo3">BO3</SelectItem>
                    <SelectItem value="bo5">BO5</SelectItem>
                    <SelectItem value="bo7">BO7</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Promotion/Relegation */}
      {isLeague && (
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
              <ArrowUpDown className="h-5 w-5" style={{ color: theme.primaryColor }} />
              Awanse i spadki
            </CardTitle>
            <CardDescription className="font-logik">
              Promocja i relegacja między dywizjami
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-xl border border-border">
              <div>
                <p className="font-logik-extended-bold">Włącz awanse/spadki</p>
                <p className="text-sm text-muted-foreground font-logik">
                  Drużyny mogą awansować lub spaść po każdej rundzie
                </p>
              </div>
              <Switch
                checked={hasPromotionRelegation}
                onCheckedChange={setHasPromotionRelegation}
              />
            </div>

            {hasPromotionRelegation && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-border">
                <div className="space-y-2">
                  <Label className="font-logik-extended-bold">Drużyny awansujące</Label>
                  <p className="text-sm text-muted-foreground font-logik mb-2">
                    Ile drużyn awansuje z niższej dywizji
                  </p>
                  <Select 
                    value={teamsPromoted.toString()} 
                    onValueChange={(v) => setTeamsPromoted(Number(v))}
                  >
                    <SelectTrigger className="font-logik">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 drużyna</SelectItem>
                      <SelectItem value="2">2 drużyny</SelectItem>
                      <SelectItem value="3">3 drużyny</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="font-logik-extended-bold">Drużyny spadające</Label>
                  <p className="text-sm text-muted-foreground font-logik mb-2">
                    Ile drużyn spada z wyższej dywizji
                  </p>
                  <Select 
                    value={teamsRelegated.toString()} 
                    onValueChange={(v) => setTeamsRelegated(Number(v))}
                  >
                    <SelectTrigger className="font-logik">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 drużyna</SelectItem>
                      <SelectItem value="2">2 drużyny</SelectItem>
                      <SelectItem value="3">3 drużyny</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="font-logik-extended-bold">Format meczów barażowych</Label>
                  <p className="text-sm text-muted-foreground font-logik mb-2">
                    Format meczów o awans/spadek
                  </p>
                  <Select defaultValue="bo3">
                    <SelectTrigger className="font-logik">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Bez meczu (automatyczny awans/spadek)</SelectItem>
                      <SelectItem value="bo1">BO1</SelectItem>
                      <SelectItem value="bo3">BO3</SelectItem>
                      <SelectItem value="bo5">BO5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
