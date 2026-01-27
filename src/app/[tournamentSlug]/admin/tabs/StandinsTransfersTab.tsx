"use client";

import React, { useState } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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
  UserPlus,
  UserMinus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react';

interface StandinRequest {
  id: string;
  teamName: string;
  standinName: string;
  originalPlayer: string;
  matchName: string;
  matchDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'denied';
  requestedAt: string;
}

/**
 * Standins & Transfers Tab - Manage transfer limits and standin approval workflow
 */
export function StandinsTransfersTab() {
  const { tournament, theme } = useTournament();
  
  // Settings state
  const [standinsPerRound, setStandinsPerRound] = useState(1);
  const [requireOpponentApproval, setRequireOpponentApproval] = useState(true);
  const [transferWindowOpen, setTransferWindowOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Mock standin requests
  const [requests, setRequests] = useState<StandinRequest[]>([
    {
      id: '1',
      teamName: 'Team Liquid',
      standinName: 'miracle-',
      originalPlayer: 'matu',
      matchName: 'TL vs OG',
      matchDate: '2025-02-25',
      reason: 'Choroba gracza',
      status: 'pending',
      requestedAt: '2025-02-23 14:30',
    },
  ]);

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  const updateRequestStatus = (requestId: string, status: StandinRequest['status']) => {
    setRequests(requests.map(r => 
      r.id === requestId ? { ...r, status } : r
    ));
  };

  const getStatusBadge = (status: StandinRequest['status']) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-green-500/20 text-green-500 border-green-500/30 font-logik">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Zatwierdzony
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 font-logik">
            <Clock className="h-3 w-3 mr-1" />
            Oczekuje
          </Badge>
        );
      case 'denied':
        return (
          <Badge className="bg-red-500/20 text-red-500 border-red-500/30 font-logik">
            <XCircle className="h-3 w-3 mr-1" />
            Odrzucony
          </Badge>
        );
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-logik-extended-bold">Zastępstwa i transfery</h2>
          <p className="text-muted-foreground font-logik">
            Zarządzanie limitami i zatwierdzanie próśb o zastępstwa
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

      {/* Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Standin Rules */}
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
              <UserPlus className="h-5 w-5" style={{ color: theme.primaryColor }} />
              Zasady zastępstw
            </CardTitle>
            <CardDescription className="font-logik">
              Limity i wymagania dla standinów
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Limit zastępstw na rundę</Label>
              <p className="text-sm text-muted-foreground font-logik mb-2">
                Ile razy ten sam standin może zagrać w jednej rundzie
              </p>
              <Select 
                value={standinsPerRound.toString()} 
                onValueChange={(v) => setStandinsPerRound(Number(v))}
              >
                <SelectTrigger className="font-logik">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 mecz na rundę</SelectItem>
                  <SelectItem value="2">2 mecze na rundę</SelectItem>
                  <SelectItem value="-1">Bez limitu</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border border-border">
              <div>
                <p className="font-logik-extended-bold">Zgoda przeciwnika</p>
                <p className="text-sm text-muted-foreground font-logik">
                  Kapitan przeciwnej drużyny musi zatwierdzić standina
                </p>
              </div>
              <Switch
                checked={requireOpponentApproval}
                onCheckedChange={setRequireOpponentApproval}
              />
            </div>
          </CardContent>
        </Card>

        {/* Transfer Window */}
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
              <ArrowLeftRight className="h-5 w-5" style={{ color: theme.primaryColor }} />
              Okno transferowe
            </CardTitle>
            <CardDescription className="font-logik">
              Zarządzanie transferami graczy
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-xl border border-border">
              <div>
                <p className="font-logik-extended-bold">Okno transferowe</p>
                <p className="text-sm text-muted-foreground font-logik">
                  {transferWindowOpen 
                    ? 'Transfery są otwarte' 
                    : 'Transfery są zamknięte'}
                </p>
              </div>
              <Switch
                checked={transferWindowOpen}
                onCheckedChange={setTransferWindowOpen}
              />
            </div>

            {transferWindowOpen && (
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                <p className="text-sm text-green-500 font-logik flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Okno transferowe jest aktywne. Drużyny mogą dokonywać zmian w składzie.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending Requests */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
                <Clock className="h-5 w-5" style={{ color: theme.primaryColor }} />
                Prośby o zastępstwo
                {pendingCount > 0 && (
                  <Badge className="ml-2 bg-yellow-500 text-black font-logik">
                    {pendingCount} oczekujących
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="font-logik">
                Zatwierdzanie i odrzucanie próśb o standinów
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground font-logik">
              <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Brak aktywnych próśb o zastępstwo</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map(request => (
                <div 
                  key={request.id}
                  className={cn(
                    "p-4 rounded-xl border transition-colors",
                    request.status === 'pending' 
                      ? "border-yellow-500/30 bg-yellow-500/5" 
                      : "border-border"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <p className="font-logik-extended-bold">{request.teamName}</p>
                        {getStatusBadge(request.status)}
                      </div>
                      <div className="text-sm font-logik space-y-1">
                        <p>
                          <span className="text-muted-foreground">Standin:</span>{' '}
                          <span className="font-bold">{request.standinName}</span>
                          <span className="text-muted-foreground"> za </span>
                          <span className="font-bold">{request.originalPlayer}</span>
                        </p>
                        <p>
                          <span className="text-muted-foreground">Mecz:</span>{' '}
                          {request.matchName} ({request.matchDate})
                        </p>
                        <p className="flex items-start gap-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <span className="text-muted-foreground italic">"{request.reason}"</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Zgłoszono: {request.requestedAt}
                        </p>
                      </div>
                    </div>

                    {request.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => updateRequestStatus(request.id, 'approved')}
                          className="font-logik bg-green-500 hover:bg-green-600"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Zatwierdź
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateRequestStatus(request.id, 'denied')}
                          className="font-logik text-red-500 border-red-500/30 hover:bg-red-500/10"
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Odrzuć
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin Override */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Interwencja admina
          </CardTitle>
          <CardDescription className="font-logik">
            Nadpisz decyzję kapitana lub wymuś zastępstwo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
            <p className="text-sm text-amber-500 font-logik mb-4">
              Użyj tej funkcji tylko w sytuacjach wymagających interwencji administratora.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-logik">Drużyna</Label>
                <Select>
                  <SelectTrigger className="font-logik">
                    <SelectValue placeholder="Wybierz drużynę" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tl">Team Liquid</SelectItem>
                    <SelectItem value="og">OG Esports</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-logik">Standin</Label>
                <Input placeholder="Nazwa standina" className="font-logik" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Label className="font-logik">Powód interwencji</Label>
              <Textarea 
                placeholder="Opisz powód nadpisania decyzji..."
                className="font-logik resize-none"
                rows={3}
              />
            </div>
            <Button 
              className="mt-4 font-logik bg-amber-500 hover:bg-amber-600 text-black"
            >
              Wymuś zastępstwo
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
