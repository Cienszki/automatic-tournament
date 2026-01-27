"use client";

import React, { useState } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { 
  CalendarDays,
  Save,
  RotateCcw,
  Clock,
  Plus,
  Trash2,
  Edit2,
  Check,
} from 'lucide-react';

interface MatchDay {
  id: string;
  divisionId: string;
  divisionName: string;
  date: string;
  time: string;
  round: number;
}

/**
 * Scheduling Tab - Manage matchday dates per division
 */
export function SchedulingTab() {
  const { tournament, theme } = useTournament();
  
  const [matchdays, setMatchdays] = useState<MatchDay[]>([]);
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [selectedRound, setSelectedRound] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // New matchday form state
  const [newMatchday, setNewMatchday] = useState({
    divisionId: '',
    date: '',
    time: '20:00',
    round: 1,
  });

  const divisions = tournament?.divisions || [];

  const handleSave = async () => {
    setIsSaving(true);
    // TODO: Implement save functionality
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  const addMatchday = () => {
    if (!newMatchday.divisionId || !newMatchday.date) return;
    
    const division = divisions.find(d => d.id === newMatchday.divisionId);
    const matchday: MatchDay = {
      id: `matchday-${Date.now()}`,
      divisionId: newMatchday.divisionId,
      divisionName: division?.name || 'Unknown',
      date: newMatchday.date,
      time: newMatchday.time,
      round: newMatchday.round,
    };
    
    setMatchdays([...matchdays, matchday]);
    setNewMatchday({ divisionId: '', date: '', time: '20:00', round: 1 });
    setShowAddForm(false);
  };

  const removeMatchday = (id: string) => {
    setMatchdays(matchdays.filter(m => m.id !== id));
  };

  const filteredMatchdays = matchdays.filter(m => {
    if (selectedDivision !== 'all' && m.divisionId !== selectedDivision) return false;
    if (selectedRound !== 'all' && m.round !== Number(selectedRound)) return false;
    return true;
  });

  const getDayOfWeek = (dateStr: string) => {
    const days = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
    const date = new Date(dateStr);
    return days[date.getDay()];
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-logik-extended-bold">Harmonogram meczów</h2>
          <p className="text-muted-foreground font-logik">
            Planowanie dat i godzin meczów dla każdej dywizji
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline"
            onClick={() => setShowAddForm(true)}
            className="font-logik"
          >
            <Plus className="h-4 w-4 mr-2" />
            Dodaj dzień meczowy
          </Button>
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
      </div>

      {/* Quick Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/20">
                <CalendarDays className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-logik">Elite</p>
                <p className="font-logik-extended-bold">Czwartki 20:00</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-500/20">
                <CalendarDays className="h-5 w-5 text-gray-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-logik">Challenger</p>
                <p className="font-logik-extended-bold">Środy 20:00</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/20">
                <CalendarDays className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-logik">Adept</p>
                <p className="font-logik-extended-bold">Środy 20:00</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Form Modal */}
      {showAddForm && (
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm border-2 border-primary/30">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
              <Plus className="h-5 w-5" style={{ color: theme.primaryColor }} />
              Nowy dzień meczowy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="font-logik">Dywizja</Label>
                <Select 
                  value={newMatchday.divisionId}
                  onValueChange={(v) => setNewMatchday({ ...newMatchday, divisionId: v })}
                >
                  <SelectTrigger className="font-logik">
                    <SelectValue placeholder="Wybierz dywizję" />
                  </SelectTrigger>
                  <SelectContent>
                    {divisions.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-logik">Data</Label>
                <Input
                  type="date"
                  value={newMatchday.date}
                  onChange={(e) => setNewMatchday({ ...newMatchday, date: e.target.value })}
                  className="font-logik"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-logik">Godzina</Label>
                <Input
                  type="time"
                  value={newMatchday.time}
                  onChange={(e) => setNewMatchday({ ...newMatchday, time: e.target.value })}
                  className="font-logik"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-logik">Runda</Label>
                <Select 
                  value={newMatchday.round.toString()}
                  onValueChange={(v) => setNewMatchday({ ...newMatchday, round: Number(v) })}
                >
                  <SelectTrigger className="font-logik">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(r => (
                      <SelectItem key={r} value={r.toString()}>Runda {r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
              <Button 
                variant="outline" 
                onClick={() => setShowAddForm(false)}
                className="font-logik"
              >
                Anuluj
              </Button>
              <Button 
                onClick={addMatchday}
                className="font-logik"
                style={{ backgroundColor: theme.primaryColor }}
              >
                <Check className="h-4 w-4 mr-2" />
                Dodaj
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="font-logik text-muted-foreground">Dywizja:</Label>
              <Select value={selectedDivision} onValueChange={setSelectedDivision}>
                <SelectTrigger className="w-40 font-logik">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie</SelectItem>
                  {divisions.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="font-logik text-muted-foreground">Runda:</Label>
              <Select value={selectedRound} onValueChange={setSelectedRound}>
                <SelectTrigger className="w-32 font-logik">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie</SelectItem>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(r => (
                    <SelectItem key={r} value={r.toString()}>Runda {r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Matchdays List */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
            <Clock className="h-5 w-5" style={{ color: theme.primaryColor }} />
            Lista dni meczowych
          </CardTitle>
          <CardDescription className="font-logik">
            {filteredMatchdays.length} dni meczowych
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredMatchdays.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground font-logik">
              <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Brak zaplanowanych dni meczowych</p>
              <p className="text-sm mt-2">Kliknij "Dodaj dzień meczowy" aby zaplanować pierwszy termin</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMatchdays.map(matchday => (
                <div 
                  key={matchday.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-border hover:bg-background/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <Badge 
                      variant="outline" 
                      className="font-logik"
                    >
                      {matchday.divisionName}
                    </Badge>
                    <div>
                      <p className="font-logik-extended-bold">
                        {getDayOfWeek(matchday.date)}, {matchday.date}
                      </p>
                      <p className="text-sm text-muted-foreground font-logik">
                        Godzina {matchday.time} • Runda {matchday.round}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeMatchday(matchday.id)}
                    className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
