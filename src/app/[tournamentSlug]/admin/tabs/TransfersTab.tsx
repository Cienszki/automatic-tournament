"use client";

import React, { useState } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { 
  ArrowLeftRight,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Users,
  Calendar,
  Hash,
} from 'lucide-react';

/**
 * Transfers Tab - Transfer window management, transfer limits per round and season
 */
export function TransfersTab() {
  const { tournament, theme } = useTournament();
  
  // Settings state
  const [transferWindowOpen, setTransferWindowOpen] = useState(false);
  const [transfersPerRound, setTransfersPerRound] = useState(2);
  const [transfersPerSeason, setTransfersPerSeason] = useState(6);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-logik-extended-bold">Transfery</h2>
          <p className="text-muted-foreground font-logik">
            Zarządzanie oknem transferowym i limitami transferów
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

      {/* Transfer Window Status */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
            <ArrowLeftRight className="h-5 w-5" style={{ color: theme.primaryColor }} />
            Okno transferowe
          </CardTitle>
          <CardDescription className="font-logik">
            Status i zarządzanie oknem transferowym
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 rounded-xl border border-border">
            <div>
              <p className="font-logik-extended-bold">Okno transferowe</p>
              <p className="text-sm text-muted-foreground font-logik">
                {transferWindowOpen 
                  ? 'Drużyny mogą dokonywać zmian w składzie' 
                  : 'Transfery są zamknięte, zmiany składu niedostępne'}
              </p>
            </div>
            <Switch
              checked={transferWindowOpen}
              onCheckedChange={setTransferWindowOpen}
            />
          </div>

          {transferWindowOpen ? (
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
              <p className="text-sm text-green-500 font-logik flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Okno transferowe jest aktywne. Drużyny mogą dokonywać zmian w składzie.
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <p className="text-sm text-amber-500 font-logik flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Okno transferowe jest zamknięte. Żadne zmiany w składzie nie są możliwe.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transfer Limits */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
            <Hash className="h-5 w-5" style={{ color: theme.primaryColor }} />
            Limity transferów
          </CardTitle>
          <CardDescription className="font-logik">
            Maksymalna liczba transferów dozwolona dla drużyn
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Transfers per Round */}
            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Transfery na rundę</Label>
              <p className="text-sm text-muted-foreground font-logik mb-2">
                Ile transferów może wykonać drużyna między rundami
              </p>
              <Select 
                value={transfersPerRound.toString()} 
                onValueChange={(v) => setTransfersPerRound(Number(v))}
              >
                <SelectTrigger className="font-logik">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 transfer</SelectItem>
                  <SelectItem value="2">2 transfery</SelectItem>
                  <SelectItem value="3">3 transfery</SelectItem>
                  <SelectItem value="5">5 transferów</SelectItem>
                  <SelectItem value="-1">Bez limitu</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Transfers per Season */}
            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Transfery na sezon</Label>
              <p className="text-sm text-muted-foreground font-logik mb-2">
                Łączny limit transferów na cały sezon
              </p>
              <Select 
                value={transfersPerSeason.toString()} 
                onValueChange={(v) => setTransfersPerSeason(Number(v))}
              >
                <SelectTrigger className="font-logik">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 transfery</SelectItem>
                  <SelectItem value="5">5 transferów</SelectItem>
                  <SelectItem value="6">6 transferów</SelectItem>
                  <SelectItem value="10">10 transferów</SelectItem>
                  <SelectItem value="-1">Bez limitu</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Summary */}
          <div className="p-4 rounded-xl border border-border bg-background/50">
            <p className="text-sm font-logik-extended-bold mb-2">Podsumowanie limitów</p>
            <div className="grid grid-cols-2 gap-4 text-sm font-logik">
              <div>
                <span className="text-muted-foreground">Na rundę:</span>
                <span className="ml-2 font-bold">
                  {transfersPerRound === -1 ? '∞' : transfersPerRound}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Na sezon:</span>
                <span className="ml-2 font-bold">
                  {transfersPerSeason === -1 ? '∞' : transfersPerSeason}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Transfers */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
            <Users className="h-5 w-5" style={{ color: theme.primaryColor }} />
            Ostatnie transfery
          </CardTitle>
          <CardDescription className="font-logik">
            Historia transferów w bieżącym sezonie
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground font-logik">
            <ArrowLeftRight className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Brak zarejestrowanych transferów</p>
            <p className="text-sm mt-2">Transfery pojawią się tutaj po dokonaniu zmian w składach</p>
          </div>
        </CardContent>
      </Card>

      {/* Transfer Schedule */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
            <Calendar className="h-5 w-5" style={{ color: theme.primaryColor }} />
            Harmonogram okien transferowych
          </CardTitle>
          <CardDescription className="font-logik">
            Zaplanowane okresy transferowe
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground font-logik">
            <p>Brak zaplanowanych okien transferowych</p>
            <Button variant="outline" className="mt-4 font-logik">
              Zaplanuj okno transferowe
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
