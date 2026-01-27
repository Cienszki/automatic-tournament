"use client";

import React, { useState } from 'react';
import { useTournament, useTournamentType } from '@/context/TournamentContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  Settings,
  Palette,
  Type,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Play,
  Pause,
  Trophy,
} from 'lucide-react';

/**
 * General Tab - Basic tournament settings
 * Tournament name, logos, type, MMR limits, colors, fonts, status, league ID
 */
export function GeneralTab() {
  const { tournament, theme } = useTournament();
  const { isLeague } = useTournamentType();
  
  // Form state - Basic Info
  const [tournamentName, setTournamentName] = useState(tournament?.name || '');
  const [logoUrl, setLogoUrl] = useState(theme?.logoUrl || '');
  const [inlineLogoUrl, setInlineLogoUrl] = useState(''); // Not in theme yet, will be added later
  const [leagueId, setLeagueId] = useState(tournament?.leagueId?.toString() || '');
  const [twitchChannel, setTwitchChannel] = useState(tournament?.twitchChannel || '');
  
  // Form state - Type & Status
  const [tournamentType, setTournamentType] = useState<'league' | 'mmr-limited'>(
    tournament?.type === 'league' ? 'league' : 'mmr-limited'
  );
  const [mmrLimit, setMmrLimit] = useState(tournament?.mmrCap || 24000);
  const [status, setStatus] = useState<string>(tournament?.status || 'registration');
  const [isSaving, setIsSaving] = useState(false);

  // Color settings (placeholders)
  const [primaryColor, setPrimaryColor] = useState(theme.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(theme.secondaryColor || '#666666');
  const [accentColor, setAccentColor] = useState(theme.accentColor || '#D4AF37');

  const handleSave = async () => {
    if (!tournament?.id) return;
    
    setIsSaving(true);
    try {
      const tournamentRef = doc(db, 'tournaments', tournament.id);
      await updateDoc(tournamentRef, {
        name: tournamentName,
        leagueId: leagueId ? Number(leagueId) : null,
        twitchChannel: twitchChannel || null,
        type: tournamentType,
        status: status,
        mmrCap: tournamentType === 'mmr-limited' ? mmrLimit : null,
        'theme.logoUrl': logoUrl || null,
        'theme.primaryColor': primaryColor,
        'theme.secondaryColor': secondaryColor,
        'theme.accentColor': accentColor,
      });
      
      alert('Zmiany zapisane pomyślnie!');
    } catch (error) {
      console.error('Error saving tournament settings:', error);
      alert('Błąd podczas zapisywania zmian');
    } finally {
      setIsSaving(false);
    }
  };

  type TournamentStatus = 'registration' | 'active' | 'completed';
  
  const statusOptions: { value: TournamentStatus; label: string; icon: typeof Clock; color: string }[] = [
    { value: 'registration', label: 'Rejestracja otwarta', icon: Clock, color: 'bg-blue-500' },
    { value: 'active', label: 'W trakcie', icon: Play, color: 'bg-green-500' },
    { value: 'completed', label: 'Zakończony', icon: Trophy, color: 'bg-gray-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-logik-extended-bold">Ustawienia ogólne</h2>
          <p className="text-muted-foreground font-logik">
            Podstawowe ustawienia turnieju
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

      {/* Basic Info */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
            <Settings className="h-5 w-5" style={{ color: theme.primaryColor }} />
            Informacje podstawowe
          </CardTitle>
          <CardDescription className="font-logik">
            Nazwa, logo i identyfikator turnieju
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tournament Name */}
            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Nazwa turnieju</Label>
              <Input
                value={tournamentName}
                onChange={(e) => setTournamentName(e.target.value)}
                placeholder="np. Polish Dota League Season 1"
                className="font-logik"
              />
            </div>

            {/* League ID */}
            <div className="space-y-2">
              <Label className="font-logik-extended-bold">League ID (Valve)</Label>
              <Input
                value={leagueId}
                onChange={(e) => setLeagueId(e.target.value)}
                placeholder="np. 19206"
                className="font-logik"
              />
              <p className="text-xs text-muted-foreground font-logik">
                ID ligi z DotaTV do importu meczów
              </p>
            </div>
          </div>

          {/* Twitch Channel */}
          <div className="space-y-2">
            <Label className="font-logik-extended-bold">Kanał Twitch</Label>
            <Input
              value={twitchChannel}
              onChange={(e) => setTwitchChannel(e.target.value)}
              placeholder="np. polishdotaleague"
              className="font-logik"
            />
            <p className="text-xs text-muted-foreground font-logik">
              Nazwa kanału Twitch do embedu na stronie głównej i linku w menu
            </p>
          </div>

          {/* Logos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Main Logo */}
            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Logo główne</Label>
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  <div className="w-16 h-16 rounded-xl border-2 border-border overflow-hidden bg-muted">
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/50">
                    <Palette className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <Input
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="URL logo..."
                    className="font-logik"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground font-logik">
                Wyświetlane na stronie głównej turnieju
              </p>
            </div>

            {/* Inline Logo (Home Button) */}
            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Logo nawigacyjne (home button)</Label>
              <div className="flex items-center gap-3">
                {inlineLogoUrl ? (
                  <div className="h-10 px-2 rounded-lg border-2 border-border overflow-hidden bg-muted flex items-center">
                    <img src={inlineLogoUrl} alt="Inline Logo" className="h-6 object-contain" />
                  </div>
                ) : (
                  <div className="h-10 w-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/50">
                    <Type className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <Input
                    value={inlineLogoUrl}
                    onChange={(e) => setInlineLogoUrl(e.target.value)}
                    placeholder="URL logo nawigacyjnego..."
                    className="font-logik"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground font-logik">
                Małe logo w navbarze, kliknięcie = powrót na stronę główną
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tournament Status */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
            <Clock className="h-5 w-5" style={{ color: theme.primaryColor }} />
            Status turnieju
          </CardTitle>
          <CardDescription className="font-logik">
            Aktualny status i faza turnieju
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setStatus(option.value)}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200",
                  "hover:scale-[1.02] hover:shadow-md",
                  status === option.value 
                    ? "border-primary bg-primary/10" 
                    : "border-border hover:border-primary/50"
                )}
                style={{
                  borderColor: status === option.value ? theme.primaryColor : undefined,
                  backgroundColor: status === option.value ? `${theme.primaryColor}15` : undefined,
                }}
              >
                <div className={cn("p-2 rounded-lg", option.color)}>
                  <option.icon className="h-5 w-5 text-white" />
                </div>
                <div className="text-left">
                  <p className="font-logik-extended-bold">{option.label}</p>
                  <p className="text-xs text-muted-foreground font-logik">
                    {option.value === 'registration' && 'Drużyny mogą się rejestrować'}
                    {option.value === 'active' && 'Mecze są rozgrywane'}
                    {option.value === 'completed' && 'Turniej zakończony'}
                  </p>
                </div>
                {status === option.value && (
                  <CheckCircle2 className="h-5 w-5 ml-auto" style={{ color: theme.primaryColor }} />
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tournament Type */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
            <Trophy className="h-5 w-5" style={{ color: theme.primaryColor }} />
            Typ turnieju
          </CardTitle>
          <CardDescription className="font-logik">
            Wybierz format rozgrywek
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setTournamentType('league')}
              className={cn(
                "flex flex-col items-start gap-2 p-6 rounded-xl border-2 transition-all duration-200",
                "hover:scale-[1.02] hover:shadow-md text-left",
                tournamentType === 'league' 
                  ? "border-primary bg-primary/10" 
                  : "border-border hover:border-primary/50"
              )}
              style={{
                borderColor: tournamentType === 'league' ? theme.primaryColor : undefined,
                backgroundColor: tournamentType === 'league' ? `${theme.primaryColor}15` : undefined,
              }}
            >
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="font-logik">Liga</Badge>
                {tournamentType === 'league' && (
                  <CheckCircle2 className="h-5 w-5" style={{ color: theme.primaryColor }} />
                )}
              </div>
              <h3 className="font-logik-extended-bold text-lg">Liga profesjonalna</h3>
              <p className="text-sm text-muted-foreground font-logik">
                Wielodywizyjny format z awansami i spadkami. Rozgrywki ligowe z playoffami na koniec sezonu.
              </p>
            </button>

            <button
              onClick={() => setTournamentType('mmr-limited')}
              className={cn(
                "flex flex-col items-start gap-2 p-6 rounded-xl border-2 transition-all duration-200",
                "hover:scale-[1.02] hover:shadow-md text-left",
                tournamentType === 'mmr-limited' 
                  ? "border-primary bg-primary/10" 
                  : "border-border hover:border-primary/50"
              )}
              style={{
                borderColor: tournamentType === 'mmr-limited' ? theme.primaryColor : undefined,
                backgroundColor: tournamentType === 'mmr-limited' ? `${theme.primaryColor}15` : undefined,
              }}
            >
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="font-logik">MMR</Badge>
                {tournamentType === 'mmr-limited' && (
                  <CheckCircle2 className="h-5 w-5" style={{ color: theme.primaryColor }} />
                )}
              </div>
              <h3 className="font-logik-extended-bold text-lg">Turniej z limitem MMR</h3>
              <p className="text-sm text-muted-foreground font-logik">
                Turniej casualowy z ograniczeniem całkowitego MMR drużyny. Faza grupowa + playoffy.
              </p>
            </button>
          </div>

          {/* MMR Limit (only for mmr-limited) */}
          {tournamentType === 'mmr-limited' && (
            <div className="pt-4 border-t border-border">
              <Label className="font-logik-extended-bold">Limit MMR drużyny</Label>
              <p className="text-sm text-muted-foreground font-logik mb-3">
                Maksymalna suma MMR wszystkich graczy w drużynie
              </p>
              <div className="flex items-center gap-4">
                <Input
                  type="number"
                  value={mmrLimit}
                  onChange={(e) => setMmrLimit(Number(e.target.value))}
                  className="w-40 font-logik"
                />
                <span className="text-muted-foreground font-logik">
                  = średnio {Math.round(mmrLimit / 5)} MMR na gracza
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Branding & Colors */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
            <Palette className="h-5 w-5" style={{ color: theme.primaryColor }} />
            Branding i kolory
          </CardTitle>
          <CardDescription className="font-logik">
            Personalizacja wyglądu turnieju
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Primary Color */}
            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Kolor główny</Label>
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-xl border-2 border-border cursor-pointer hover:scale-105 transition-transform"
                  style={{ backgroundColor: primaryColor }}
                />
                <Input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="font-mono text-sm"
                  placeholder="#cf2648"
                />
              </div>
            </div>

            {/* Secondary Color */}
            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Kolor drugorzędny</Label>
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-xl border-2 border-border cursor-pointer hover:scale-105 transition-transform"
                  style={{ backgroundColor: secondaryColor }}
                />
                <Input
                  type="text"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="font-mono text-sm"
                  placeholder="#666666"
                />
              </div>
            </div>

            {/* Accent Color */}
            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Kolor akcentowy</Label>
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-xl border-2 border-border cursor-pointer hover:scale-105 transition-transform"
                  style={{ backgroundColor: accentColor }}
                />
                <Input
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="font-mono text-sm"
                  placeholder="#D4AF37"
                />
              </div>
            </div>
          </div>

          {/* Color Preview */}
          <div className="p-4 rounded-xl border border-border bg-background/50">
            <p className="text-sm text-muted-foreground font-logik mb-3">Podgląd kolorów</p>
            <div className="flex items-center gap-3">
              <Button style={{ backgroundColor: primaryColor }} className="font-logik">
                Przycisk główny
              </Button>
              <Button variant="outline" style={{ borderColor: primaryColor, color: primaryColor }} className="font-logik">
                Przycisk outline
              </Button>
              <Badge style={{ backgroundColor: accentColor, color: '#000' }}>
                Badge akcentowy
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <p className="text-sm text-amber-500 font-logik">
              Zmiany kolorów wymagają przeładowania strony aby zostały w pełni zastosowane.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Typography */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
            <Type className="h-5 w-5" style={{ color: theme.primaryColor }} />
            Typografia
          </CardTitle>
          <CardDescription className="font-logik">
            Czcionki używane w turnieju
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Czcionka nagłówków</Label>
              <Select defaultValue="logik">
                <SelectTrigger className="font-logik">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="logik">Logik Extended Bold</SelectItem>
                  <SelectItem value="geist">Geist Sans</SelectItem>
                  <SelectItem value="inter">Inter</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-2xl font-logik-extended-bold mt-2">Przykładowy nagłówek</p>
            </div>

            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Czcionka tekstu</Label>
              <Select defaultValue="logik">
                <SelectTrigger className="font-logik">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="logik">Logik</SelectItem>
                  <SelectItem value="geist">Geist Sans</SelectItem>
                  <SelectItem value="inter">Inter</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-base font-logik mt-2">Przykładowy tekst akapitu z różnymi słowami.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
