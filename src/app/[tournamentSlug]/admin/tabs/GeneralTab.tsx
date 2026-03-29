"use client";

import React, { useState, useEffect } from 'react';
import { useTournament, useTournamentType } from '@/context/TournamentContext';
import { useAuth } from '@/context/AuthContext';
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
import { FontManagement } from '@/components/admin/FontManagement';
import type { CustomFont } from '@/components/admin/FontManagement';
import {
  uploadTournamentLogo,
  uploadTournamentBackground,
  uploadTournamentFavicon,
} from '@/lib/storage';
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
  Shield,
  UserPlus,
  Search,
  X,
  Loader2,
  Upload,
  Eye,
  Sliders,
  Image as ImageIcon,
} from 'lucide-react';

/**
 * General Tab - Basic tournament settings
 * Tournament name, logos, type, MMR limits, colors, fonts, status, league ID
 */
export function GeneralTab() {
  const { tournament, theme, refetchTournament } = useTournament();
  const { isLeague } = useTournamentType();
  const { user } = useAuth();
  
  // Form state - Basic Info
  const [tournamentName, setTournamentName] = useState(tournament?.name || '');
  const [logoUrl, setLogoUrl] = useState(theme?.logoUrl || '');
  const [inlineLogoUrl, setInlineLogoUrl] = useState(''); // Not in theme yet, will be added later
  const [leagueId, setLeagueId] = useState(tournament?.leagueId?.toString() || '');
  const [twitchUrl, setTwitchUrl] = useState(tournament?.twitchUrl || '');
  const [discordUrl, setDiscordUrl] = useState(tournament?.discordUrl || '');
  const [youtubeUrl, setYoutubeUrl] = useState(tournament?.youtubeUrl || '');
  const [instagramUrl, setInstagramUrl] = useState(tournament?.instagramUrl || '');
  const [tiktokUrl, setTiktokUrl] = useState(tournament?.tiktokUrl || '');

  // Lobby settings
  const [lobbyGameMode, setLobbyGameMode] = useState(tournament?.lobbySettings?.gameMode || 'Captains Mode');
  const [lobbyServer, setLobbyServer] = useState(tournament?.lobbySettings?.server || 'EU West');
  const [lobbyVisibility, setLobbyVisibility] = useState(tournament?.lobbySettings?.visibility || 'Publiczna');
  const [lobbyDotatvDelay, setLobbyDotatvDelay] = useState(tournament?.lobbySettings?.dotatvDelayMinutes ?? 5);
  const [lobbyLatePenaltyGame, setLobbyLatePenaltyGame] = useState(tournament?.lobbySettings?.latePenaltyGameMinutes ?? 15);
  const [lobbyLatePenaltySeries, setLobbyLatePenaltySeries] = useState(tournament?.lobbySettings?.latePenaltySeriesMinutes ?? 30);
  
  // Form state - Type & Status
  const [tournamentType, setTournamentType] = useState<'league' | 'mmr-limited'>(
    tournament?.type === 'league' ? 'league' : 'mmr-limited'
  );
  const [mmrLimit, setMmrLimit] = useState(tournament?.mmrCap || 24000);
  const [status, setStatus] = useState<string>(tournament?.status || 'registration');
  const [isSaving, setIsSaving] = useState(false);

  // Color settings
  const [primaryColor, setPrimaryColor] = useState(theme.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(theme.secondaryColor || '#666666');
  const [accentColor, setAccentColor] = useState(theme.accentColor || '#D4AF37');
  const [glowColor, setGlowColor] = useState(theme.glowColor || '');
  const [headingColor, setHeadingColor] = useState(theme.headingColor || '');
  const [backgroundColor, setBackgroundColor] = useState(theme.backgroundColor || 'hsl(240 17% 6%)');
  const [cardColor, setCardColor] = useState(theme.cardColor || '');
  const [textColor, setTextColor] = useState(theme.textColor || '');
  const [borderColor, setBorderColor] = useState(theme.borderColor || '');

  // Asset URLs
  const [backgroundImageUrl, setBackgroundImageUrl] = useState(theme.backgroundImageUrl || '');
  const [faviconUrl, setFaviconUrl] = useState(theme.faviconUrl || '');

  // Background tuning
  const [backgroundOverlayColor, setBackgroundOverlayColor] = useState(theme.backgroundOverlayColor || 'rgba(0,0,0,0.7)');
  const [backgroundOverlayOpacity, setBackgroundOverlayOpacity] = useState(theme.backgroundOverlayOpacity ?? 90);
  const [backgroundBlur, setBackgroundBlur] = useState(theme.backgroundBlur ?? 0);
  const [backgroundPosition, setBackgroundPosition] = useState(theme.backgroundPosition || 'center center');
  const [backgroundSize, setBackgroundSize] = useState(theme.backgroundSize || 'cover');

  // Card / Navbar style
  const [cardOpacity, setCardOpacity] = useState(theme.cardOpacity ?? 100);
  const [cardBlurVal, setCardBlurVal] = useState(theme.cardBlur ?? 0);
  const [cardBorderRadius, setCardBorderRadius] = useState(theme.cardBorderRadius || '0.75rem');
  const [navbarStyle, setNavbarStyle] = useState<string>(theme.navbarStyle || 'blur');
  const [navbarColor, setNavbarColor] = useState(theme.navbarColor || '');
  const [themeStyle, setThemeStyle] = useState<string>(theme.themeStyle || 'dark');

  // Upload state
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [showAdvancedTheme, setShowAdvancedTheme] = useState(false);

  // Typography settings
  const [headerFont, setHeaderFont] = useState(theme.headerFont || 'logik');
  const [textFont, setTextFont] = useState(theme.textFont || 'logik');
  const [readableFont, setReadableFont] = useState(theme.readableFont || 'geist');
  const [rulesContentFont, setRulesContentFont] = useState(theme.rulesContentFont || 'geist');
  const [customFonts, setCustomFonts] = useState<CustomFont[]>(tournament?.customFonts || []);

  // Admin management state
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [tournamentAdmins, setTournamentAdmins] = useState<any[]>([]);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(true);
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);

  // Load tournament admins
  useEffect(() => {
    loadTournamentAdmins();
  }, [tournament?.id]);

  const loadTournamentAdmins = async () => {
    if (!tournament?.id || !user) return;
    
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/tournament-admins?tournamentId=${tournament.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTournamentAdmins(data.admins || []);
      }
    } catch (error) {
      console.error('Error loading tournament admins:', error);
    } finally {
      setIsLoadingAdmins(false);
    }
  };

  const handleSearchUser = async () => {
    if (!searchEmail || !user) return;
    
    setIsSearching(true);
    setSearchError('');
    setSearchResult(null);
    
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/search-user', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: searchEmail })
      });
      
      const data = await response.json();
      
      if (data.success && data.user) {
        setSearchResult(data.user);
      } else {
        setSearchError(data.error || 'Nie znaleziono użytkownika');
      }
    } catch (error) {
      console.error('Error searching user:', error);
      setSearchError('Błąd podczas wyszukiwania');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddAdmin = async () => {
    if (!searchResult || !tournament?.id || !user) return;
    
    // Check if already admin
    if (tournamentAdmins.some(admin => admin.uid === searchResult.uid)) {
      alert('Ten użytkownik jest już administratorem tego turnieju');
      return;
    }
    
    setIsAddingAdmin(true);
    
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/tournament-admins', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          tournamentId: tournament.id,
          userId: searchResult.uid 
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('Administrator został dodany pomyślnie!');
        setSearchEmail('');
        setSearchResult(null);
        loadTournamentAdmins();
      } else {
        alert(data.error || 'Błąd podczas dodawania administratora');
      }
    } catch (error) {
      console.error('Error adding admin:', error);
      alert('Błąd podczas dodawania administratora');
    } finally {
      setIsAddingAdmin(false);
    }
  };

  const handleRemoveAdmin = async (adminUid: string) => {
    if (!tournament?.id || !user) return;
    
    if (!confirm('Czy na pewno chcesz usunąć tego administratora?')) {
      return;
    }
    
    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/admin/tournament-admins?tournamentId=${tournament.id}&userId=${adminUid}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        alert('Administrator został usunięty');
        loadTournamentAdmins();
      } else {
        alert(data.error || 'Błąd podczas usuwania administratora');
      }
    } catch (error) {
      console.error('Error removing admin:', error);
      alert('Błąd podczas usuwania administratora');
    }
  };

  const handleSave = async () => {
    if (!tournament?.id) return;
    
    setIsSaving(true);
    try {
      const tournamentRef = doc(db, 'tournaments', tournament.id);
      await updateDoc(tournamentRef, {
        name: tournamentName,
        leagueId: leagueId ? Number(leagueId) : null,
        twitchUrl: twitchUrl || null,
        discordUrl: discordUrl || null,
        youtubeUrl: youtubeUrl || null,
        instagramUrl: instagramUrl || null,
        tiktokUrl: tiktokUrl || null,
        lobbySettings: {
          gameMode: lobbyGameMode || 'Captains Mode',
          server: lobbyServer || 'EU West',
          visibility: lobbyVisibility || 'Publiczna',
          dotatvDelayMinutes: Number(lobbyDotatvDelay) || 5,
          latePenaltyGameMinutes: Number(lobbyLatePenaltyGame) || 15,
          latePenaltySeriesMinutes: Number(lobbyLatePenaltySeries) || 30,
        },
        type: tournamentType,
        status: status,
        mmrCap: tournamentType === 'mmr-limited' ? mmrLimit : null,
        'theme.logoUrl': logoUrl || null,
        'theme.primaryColor': primaryColor,
        'theme.secondaryColor': secondaryColor,
        'theme.accentColor': accentColor,
        'theme.glowColor': glowColor || null,
        'theme.headingColor': headingColor || null,
        'theme.backgroundColor': backgroundColor || 'hsl(240 17% 6%)',
        'theme.cardColor': cardColor || 'hsl(240 15% 10%)',
        'theme.textColor': textColor || 'hsl(0 0% 100%)',
        'theme.borderColor': borderColor || 'hsl(240 16% 20%)',
        'theme.backgroundImageUrl': backgroundImageUrl || null,
        'theme.faviconUrl': faviconUrl || null,
        'theme.backgroundOverlayColor': backgroundOverlayColor || null,
        'theme.backgroundOverlayOpacity': backgroundOverlayOpacity,
        'theme.backgroundBlur': backgroundBlur,
        'theme.backgroundPosition': backgroundPosition,
        'theme.backgroundSize': backgroundSize,
        'theme.cardOpacity': cardOpacity,
        'theme.cardBlur': cardBlurVal,
        'theme.cardBorderRadius': cardBorderRadius,
        'theme.navbarStyle': navbarStyle,
        'theme.navbarColor': navbarColor || null,
        'theme.themeStyle': themeStyle,
        'theme.headerFont': headerFont,
        'theme.textFont': textFont,
        'theme.readableFont': readableFont,
        'theme.rulesContentFont': rulesContentFont,
        customFonts: customFonts,
      });
      
      await refetchTournament();
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

          {/* Social Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Twitch URL */}
            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Link do Twitch</Label>
              <Input
                value={twitchUrl}
                onChange={(e) => setTwitchUrl(e.target.value)}
                placeholder="https://www.twitch.tv/pd2ih"
                className="font-logik"
              />
              <p className="text-xs text-muted-foreground font-logik">
                Pełny link do kanału Twitch - zostanie użyty w embedzie, menu i stopce
              </p>
            </div>

            {/* Discord URL */}
            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Link do Discord</Label>
              <Input
                value={discordUrl}
                onChange={(e) => setDiscordUrl(e.target.value)}
                placeholder="https://discord.gg/pd2ih"
                className="font-logik"
              />
              <p className="text-xs text-muted-foreground font-logik">
                Link zaproszenia do serwera Discord - zostanie użyty w menu i stopce
              </p>
            </div>
          </div>

          {/* Additional Social Links */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* YouTube URL */}
            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Link do YouTube</Label>
              <Input
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/@kanał"
                className="font-logik"
              />
              <p className="text-xs text-muted-foreground font-logik">
                Ikona pojawi się w stopce. Pozostaw puste, aby ukryć.
              </p>
            </div>

            {/* Instagram URL */}
            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Link do Instagram</Label>
              <Input
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                placeholder="https://www.instagram.com/profil"
                className="font-logik"
              />
              <p className="text-xs text-muted-foreground font-logik">
                Ikona pojawi się w stopce. Pozostaw puste, aby ukryć.
              </p>
            </div>

            {/* TikTok URL */}
            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Link do TikTok</Label>
              <Input
                value={tiktokUrl}
                onChange={(e) => setTiktokUrl(e.target.value)}
                placeholder="https://www.tiktok.com/@profil"
                className="font-logik"
              />
              <p className="text-xs text-muted-foreground font-logik">
                Ikona pojawi się w stopce. Pozostaw puste, aby ukryć.
              </p>
            </div>
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
                <div className="flex-1 space-y-2">
                  <Input
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="URL logo..."
                    className="font-logik"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={uploadingLogo}
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/png,image/svg+xml,image/webp,image/jpeg';
                        input.onchange = async (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (!file || !tournament?.slug) return;
                          setUploadingLogo(true);
                          try {
                            const url = await uploadTournamentLogo(file, tournament.slug);
                            setLogoUrl(url);
                          } catch (err) {
                            console.error('Logo upload failed:', err);
                          } finally {
                            setUploadingLogo(false);
                          }
                        };
                        input.click();
                      }}
                      className="font-logik"
                    >
                      {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                      Prześlij plik
                    </Button>
                    {logoUrl && (
                      <Button variant="ghost" size="sm" onClick={() => setLogoUrl('')} className="text-destructive">
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
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

          {/* Background Image & Favicon */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Background Image */}
            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Obraz Tła</Label>
              <div className="flex items-start gap-3">
                {backgroundImageUrl ? (
                  <div className="w-24 h-16 rounded-lg border-2 border-border overflow-hidden bg-muted">
                    <img src={backgroundImageUrl} alt="Background" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-24 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/50">
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <Input
                    value={backgroundImageUrl}
                    onChange={(e) => setBackgroundImageUrl(e.target.value)}
                    placeholder="URL obrazu tła..."
                    className="font-logik"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={uploadingBg}
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/png,image/jpeg,image/webp';
                        input.onchange = async (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (!file || !tournament?.slug) return;
                          setUploadingBg(true);
                          try {
                            const url = await uploadTournamentBackground(file, tournament.slug);
                            setBackgroundImageUrl(url);
                          } catch (err) {
                            console.error('Background upload failed:', err);
                          } finally {
                            setUploadingBg(false);
                          }
                        };
                        input.click();
                      }}
                      className="font-logik"
                    >
                      {uploadingBg ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                      Prześlij
                    </Button>
                    {backgroundImageUrl && (
                      <Button variant="ghost" size="sm" onClick={() => setBackgroundImageUrl('')} className="text-destructive">
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Favicon */}
            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Favicon</Label>
              <div className="flex items-start gap-3">
                {faviconUrl ? (
                  <div className="w-10 h-10 rounded-lg border-2 border-border overflow-hidden bg-muted">
                    <img src={faviconUrl} alt="Favicon" className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/50">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <Input
                    value={faviconUrl}
                    onChange={(e) => setFaviconUrl(e.target.value)}
                    placeholder="URL favicon..."
                    className="font-logik"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={uploadingFavicon}
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/png,image/x-icon,image/svg+xml';
                        input.onchange = async (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (!file || !tournament?.slug) return;
                          setUploadingFavicon(true);
                          try {
                            const url = await uploadTournamentFavicon(file, tournament.slug);
                            setFaviconUrl(url);
                          } catch (err) {
                            console.error('Favicon upload failed:', err);
                          } finally {
                            setUploadingFavicon(false);
                          }
                        };
                        input.click();
                      }}
                      className="font-logik"
                    >
                      {uploadingFavicon ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                      Prześlij
                    </Button>
                    {faviconUrl && (
                      <Button variant="ghost" size="sm" onClick={() => setFaviconUrl('')} className="text-destructive">
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground font-logik">
                Ikona w karcie przeglądarki. 32x32 lub 64x64 px.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lobby Settings */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
            <Shield className="h-5 w-5" style={{ color: theme.primaryColor }} />
            Ustawienia Lobby
          </CardTitle>
          <CardDescription className="font-logik">
            Parametry widoczne graczom w panelu kapitana przy tworzeniu lobby
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Tryb Gry</Label>
              <Input
                value={lobbyGameMode}
                onChange={(e) => setLobbyGameMode(e.target.value)}
                placeholder="Captains Mode"
                className="font-logik"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Serwer</Label>
              <Input
                value={lobbyServer}
                onChange={(e) => setLobbyServer(e.target.value)}
                placeholder="EU West"
                className="font-logik"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Widoczność</Label>
              <Input
                value={lobbyVisibility}
                onChange={(e) => setLobbyVisibility(e.target.value)}
                placeholder="Publiczna"
                className="font-logik"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Opóźnienie DotaTV (minuty)</Label>
              <Input
                type="number"
                min={0}
                value={lobbyDotatvDelay}
                onChange={(e) => setLobbyDotatvDelay(Number(e.target.value))}
                className="font-logik"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Kara za spóźnienie – gra (min)</Label>
              <Input
                type="number"
                min={0}
                value={lobbyLatePenaltyGame}
                onChange={(e) => setLobbyLatePenaltyGame(Number(e.target.value))}
                className="font-logik"
              />
              <p className="text-xs text-muted-foreground font-logik">Spóźnienie, po którym oddawana jest gra</p>
            </div>
            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Kara za spóźnienie – seria (min)</Label>
              <Input
                type="number"
                min={0}
                value={lobbyLatePenaltySeries}
                onChange={(e) => setLobbyLatePenaltySeries(Number(e.target.value))}
                className="font-logik"
              />
              <p className="text-xs text-muted-foreground font-logik">Spóźnienie, po którym oddawana jest cała seria</p>
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
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-12 h-12 rounded-xl border-2 border-border cursor-pointer hover:scale-105 transition-transform"
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
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-12 h-12 rounded-xl border-2 border-border cursor-pointer hover:scale-105 transition-transform"
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
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-12 h-12 rounded-xl border-2 border-border cursor-pointer hover:scale-105 transition-transform"
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

            {/* Glow Color */}
            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Kolor glow / highlight</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={glowColor || '#000000'}
                  onChange={(e) => setGlowColor(e.target.value)}
                  className="w-12 h-12 rounded-xl border-2 border-border cursor-pointer hover:scale-105 transition-transform"
                />
                <Input
                  type="text"
                  value={glowColor}
                  onChange={(e) => setGlowColor(e.target.value)}
                  className="font-mono text-sm"
                  placeholder="Opcjonalne"
                />
              </div>
            </div>

            {/* Heading Color */}
            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Kolor nagłówków</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={headingColor || '#ffffff'}
                  onChange={(e) => setHeadingColor(e.target.value)}
                  className="w-12 h-12 rounded-xl border-2 border-border cursor-pointer hover:scale-105 transition-transform"
                />
                <Input
                  type="text"
                  value={headingColor}
                  onChange={(e) => setHeadingColor(e.target.value)}
                  className="font-mono text-sm"
                  placeholder="Domyślny (kolor tekstu)"
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

      {/* Background Tuning */}
      {backgroundImageUrl && (
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
              <Eye className="h-5 w-5" style={{ color: theme.primaryColor }} />
              Ustawienia Tła
            </CardTitle>
            <CardDescription className="font-logik">
              Dostosowanie widoczności i stylu obrazu tła
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="font-logik-extended-bold">
                  Przezroczystość nakładki ({backgroundOverlayOpacity}%)
                </Label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={backgroundOverlayOpacity}
                  onChange={(e) => setBackgroundOverlayOpacity(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <p className="text-xs text-muted-foreground font-logik">
                  Wyższe = ciemniejsze tło, lepiej czytelny tekst
                </p>
              </div>

              <div className="space-y-2">
                <Label className="font-logik-extended-bold">
                  Rozmycie tła ({backgroundBlur}px)
                </Label>
                <input
                  type="range"
                  min={0}
                  max={20}
                  value={backgroundBlur}
                  onChange={(e) => setBackgroundBlur(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="space-y-2">
                <Label className="font-logik-extended-bold">Pozycja tła</Label>
                <Select value={backgroundPosition} onValueChange={setBackgroundPosition}>
                  <SelectTrigger className="font-logik">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="center center">Środek</SelectItem>
                    <SelectItem value="center top">Góra</SelectItem>
                    <SelectItem value="center bottom">Dół</SelectItem>
                    <SelectItem value="left center">Lewo</SelectItem>
                    <SelectItem value="right center">Prawo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="font-logik-extended-bold">Rozmiar tła</Label>
                <Select value={backgroundSize} onValueChange={setBackgroundSize}>
                  <SelectTrigger className="font-logik">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cover">Wypełnij (cover)</SelectItem>
                    <SelectItem value="contain">Dopasuj (contain)</SelectItem>
                    <SelectItem value="auto">Oryginał (auto)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="font-logik-extended-bold">Kolor nakładki</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={backgroundOverlayColor?.startsWith('rgba') ? '#000000' : (backgroundOverlayColor || '#000000')}
                    onChange={(e) => setBackgroundOverlayColor(e.target.value)}
                    className="w-12 h-12 rounded-xl border-2 border-border cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={backgroundOverlayColor}
                    onChange={(e) => setBackgroundOverlayColor(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Live mini-preview */}
            <div className="relative overflow-hidden rounded-lg h-32 border border-border">
              <div
                className="absolute inset-0 bg-no-repeat"
                style={{
                  backgroundImage: `url(${backgroundImageUrl})`,
                  backgroundSize: backgroundSize,
                  backgroundPosition: backgroundPosition,
                  filter: backgroundBlur ? `blur(${backgroundBlur}px)` : undefined,
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  backgroundColor: backgroundOverlayColor,
                  opacity: backgroundOverlayOpacity / 100,
                }}
              />
              <div className="relative z-10 flex items-center justify-center h-full">
                <p className="text-white text-sm font-medium drop-shadow-lg">Podgląd tła</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Advanced Theme Options */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <button
            onClick={() => setShowAdvancedTheme(!showAdvancedTheme)}
            className="w-full flex items-center justify-between"
          >
            <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
              <Sliders className="h-5 w-5" style={{ color: theme.primaryColor }} />
              Zaawansowane ustawienia motywu
            </CardTitle>
            <span className="text-xs text-muted-foreground font-logik">
              {showAdvancedTheme ? 'Zwiń' : 'Rozwiń'}
            </span>
          </button>
        </CardHeader>
        {showAdvancedTheme && (
          <CardContent className="space-y-6">
            {/* Surface Colors */}
            <div>
              <Label className="font-logik-extended-bold text-base mb-4 block">Kolory powierzchni</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {([
                  [backgroundColor, setBackgroundColor, 'Kolor tła strony'] as const,
                  [cardColor, setCardColor, 'Kolor kart'] as const,
                  [textColor, setTextColor, 'Kolor tekstu'] as const,
                  [borderColor, setBorderColor, 'Kolor obramowań'] as const,
                  [navbarColor, setNavbarColor, 'Kolor nawigacji'] as const,
                ]).map(([val, setter, label], i) => (
                  <div key={i} className="space-y-2">
                    <Label className="font-logik-extended-bold">{label}</Label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={(val as string)?.startsWith('hsl') ? '#0d0e1a' : ((val as string) || '#000000')}
                        onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                        className="w-12 h-10 rounded-lg border-2 border-border cursor-pointer"
                      />
                      <Input
                        type="text"
                        value={val as string}
                        onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                        placeholder="Domyślny"
                        className="font-mono text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Card Style */}
            <div>
              <Label className="font-logik-extended-bold text-base mb-4 block">Styl kart</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="font-logik-extended-bold">
                    Przezroczystość ({cardOpacity}%)
                  </Label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={cardOpacity}
                    onChange={(e) => setCardOpacity(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-logik-extended-bold">
                    Rozmycie ({cardBlurVal}px)
                  </Label>
                  <input
                    type="range"
                    min={0}
                    max={20}
                    value={cardBlurVal}
                    onChange={(e) => setCardBlurVal(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-logik-extended-bold">Zaokrąglenie</Label>
                  <Select value={cardBorderRadius} onValueChange={setCardBorderRadius}>
                    <SelectTrigger className="font-logik">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Kwadratowe</SelectItem>
                      <SelectItem value="0.375rem">Delikatne</SelectItem>
                      <SelectItem value="0.75rem">Standardowe</SelectItem>
                      <SelectItem value="1rem">Duże</SelectItem>
                      <SelectItem value="1.5rem">Bardzo duże</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Navbar & Theme Mode */}
            <div>
              <Label className="font-logik-extended-bold text-base mb-4 block">Nawigacja i motyw</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="font-logik-extended-bold">Styl nawigacji</Label>
                  <Select value={navbarStyle} onValueChange={setNavbarStyle}>
                    <SelectTrigger className="font-logik">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solid">Solidny (nieprzezroczysty)</SelectItem>
                      <SelectItem value="transparent">Przezroczysty</SelectItem>
                      <SelectItem value="blur">Rozmycie (glassmorphism)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-logik-extended-bold">Motyw</Label>
                  <Select value={themeStyle} onValueChange={setThemeStyle}>
                    <SelectTrigger className="font-logik">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dark">Ciemny</SelectItem>
                      <SelectItem value="light">Jasny</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        )}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Czcionka nagłówków</Label>
              <Select value={headerFont} onValueChange={setHeaderFont}>
                <SelectTrigger className="font-logik">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="logik">Logik Extended Bold</SelectItem>
                  <SelectItem value="geist">Geist Sans</SelectItem>
                  <SelectItem value="inter">Inter</SelectItem>
                  {customFonts.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs text-muted-foreground font-logik-extended-bold uppercase">
                        Niestandardowe
                      </div>
                      {customFonts.map(font => (
                        <SelectItem key={font.id} value={font.id}>
                          {font.family}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              <p className="text-2xl font-logik-extended-bold mt-2">Przykładowy nagłówek</p>
            </div>

            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Czcionka tekstu</Label>
              <Select value={textFont} onValueChange={setTextFont}>
                <SelectTrigger className="font-logik">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="logik">Logik</SelectItem>
                  <SelectItem value="geist">Geist Sans</SelectItem>
                  <SelectItem value="inter">Inter</SelectItem>
                  {customFonts.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs text-muted-foreground font-logik-extended-bold uppercase">
                        Niestandardowe
                      </div>
                      {customFonts.map(font => (
                        <SelectItem key={font.id} value={font.id}>
                          {font.family}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              <p className="text-base font-logik mt-2">Przykładowy tekst akapitu z różnymi słowami.</p>
            </div>

            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Czcionka czytelna</Label>
              <Select value={readableFont} onValueChange={setReadableFont}>
                <SelectTrigger className="font-logik">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="geist">Geist Sans (zalecane)</SelectItem>
                  <SelectItem value="inter">Inter</SelectItem>
                  <SelectItem value="logik">Logik</SelectItem>
                  {customFonts.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs text-muted-foreground font-logik-extended-bold uppercase">
                        Niestandardowe
                      </div>
                      {customFonts.map(font => (
                        <SelectItem key={font.id} value={font.id}>
                          {font.family}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              <p className="text-base font-logik-readable mt-2">Przykładowy tekst długiego akapitu dla lepszej czytelności treści.</p>
            </div>

            <div className="space-y-2">
              <Label className="font-logik-extended-bold">Czcionka treści regulaminu</Label>
              <Select value={rulesContentFont} onValueChange={setRulesContentFont}>
                <SelectTrigger className="font-logik">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="geist">Geist Sans (zalecane)</SelectItem>
                  <SelectItem value="inter">Inter</SelectItem>
                  <SelectItem value="logik">Logik</SelectItem>
                  {customFonts.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs text-muted-foreground font-logik-extended-bold uppercase">
                        Niestandardowe
                      </div>
                      {customFonts.map(font => (
                        <SelectItem key={font.id} value={font.id}>
                          {font.family}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              <p className="text-base font-logik-readable mt-2">Liga składa się początkowo z 3 dywizji z podziałem na Elite, Challenger, Adept.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Font Management */}
      <FontManagement
        customFonts={customFonts}
        onAddFont={(font: CustomFont) => setCustomFonts([...customFonts, font])}
        onRemoveFont={(fontId: string) => setCustomFonts(customFonts.filter(f => f.id !== fontId))}
        primaryColor={theme.primaryColor}
        tournamentSlug={tournament?.slug}
      />

      {/* Admin Management */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
            <Shield className="h-5 w-5" style={{ color: theme.primaryColor }} />
            Zarządzanie administratorami
          </CardTitle>
          <CardDescription className="font-logik">
            Dodaj lub usuń administratorów turnieju
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Search for user */}
          <div className="space-y-4">
            <Label className="font-logik-extended-bold">Dodaj administratora</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Wprowadź adres email użytkownika"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchUser()}
                className="font-logik flex-1"
              />
              <Button 
                onClick={handleSearchUser} 
                disabled={isSearching || !searchEmail}
                variant="outline"
                className="font-logik"
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Search result */}
            {searchResult && (
              <div className="p-4 rounded-lg border border-border bg-background/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {searchResult.photoURL && (
                    <img 
                      src={searchResult.photoURL} 
                      alt={searchResult.displayName || searchResult.email}
                      className="w-10 h-10 rounded-full"
                    />
                  )}
                  <div>
                    <p className="font-logik-extended-bold">{searchResult.displayName || searchResult.email}</p>
                    <p className="text-sm text-muted-foreground font-logik">{searchResult.email}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleAddAdmin} 
                    disabled={isAddingAdmin}
                    size="sm"
                    style={{ backgroundColor: theme.primaryColor }}
                    className="font-logik"
                  >
                    {isAddingAdmin ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4 mr-1" />
                    )}
                    Dodaj
                  </Button>
                  <Button 
                    onClick={() => setSearchResult(null)} 
                    variant="ghost"
                    size="sm"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Search error */}
            {searchError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                <p className="text-sm text-red-500 font-logik">{searchError}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Current admins */}
          <div className="space-y-4">
            <Label className="font-logik-extended-bold">Obecni administratorzy</Label>
            
            {isLoadingAdmins ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: theme.primaryColor }} />
              </div>
            ) : tournamentAdmins.length === 0 ? (
              <div className="p-4 rounded-lg border border-dashed border-border text-center">
                <p className="text-sm text-muted-foreground font-logik">
                  Brak administratorów turnieju. Tylko super administratorzy mają dostęp.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {tournamentAdmins.map((admin) => (
                  <div 
                    key={admin.uid}
                    className="p-4 rounded-lg border border-border bg-background/50 flex items-center justify-between hover:bg-background/80 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {admin.photoURL && (
                        <img 
                          src={admin.photoURL} 
                          alt={admin.displayName || admin.email}
                          className="w-10 h-10 rounded-full"
                        />
                      )}
                      <div>
                        <p className="font-logik-extended-bold">{admin.displayName || admin.email}</p>
                        <p className="text-sm text-muted-foreground font-logik">{admin.email}</p>
                      </div>
                    </div>
                    <Button 
                      onClick={() => handleRemoveAdmin(admin.uid)} 
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <AlertCircle className="h-5 w-5 text-blue-500" />
            <p className="text-sm text-blue-500 font-logik">
              Administratorzy turnieju mają pełny dostęp do panelu admina tylko dla tego turnieju.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
