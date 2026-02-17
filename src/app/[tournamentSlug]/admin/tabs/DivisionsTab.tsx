"use client";

import React, { useState, useEffect } from 'react';
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
  Layers,
  Plus,
  Trash2,
  GripVertical,
  Save,
  RotateCcw,
  Users,
  Palette,
  ChevronUp,
  ChevronDown,
  Edit2,
  Check,
  X,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { collection, getDocs, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getAllDivisionThemes, getDivisionTheme, type DivisionTheme } from '@/lib/division-themes';
import { uploadBytes, ref as storageRef, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

interface Division {
  id: string;
  name: string;
  tier: number;
  color: string;
  teamsCount: number;
  medalUrl?: string;
  theme?: string;
}

interface Team {
  id: string;
  name: string;
  tag: string;
  divisionId?: string;
}

/**
 * Divisions Tab - Manage divisions, teams, colors
 */
export function DivisionsTab() {
  const { tournament, theme } = useTournament();
  
  // Initialize empty divisions - will load from database
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [isLoadingDivisions, setIsLoadingDivisions] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch divisions from database
  useEffect(() => {
    const loadDivisions = async () => {
      if (!tournament?.id) {
        console.log('[DivisionsTab] No tournament ID');
        return;
      }

      try {
        console.log('[DivisionsTab] Loading divisions for tournament:', tournament.id);
        setIsLoadingDivisions(true);
        const divisionsRef = collection(db, 'tournaments', tournament.id, 'divisions');
        const divisionsSnapshot = await getDocs(divisionsRef);

        console.log('[DivisionsTab] Found divisions:', divisionsSnapshot.docs.length);

        const divisionsData: Division[] = divisionsSnapshot.docs.map((divDoc) => {
          const divData = divDoc.data();
          console.log('[DivisionsTab] Division:', divDoc.id, divData);
          return {
            id: divDoc.id,
            name: divData.name || divDoc.id,
            tier: divData.tier || 0,
            color: divData.color || '#666666',
            teamsCount: 0, // Will be updated when teams load
            medalUrl: divData.medalUrl,
            theme: divData.theme,
          };
        });

        // Sort by tier
        divisionsData.sort((a, b) => a.tier - b.tier);
        console.log('[DivisionsTab] Setting divisions:', divisionsData);
        setDivisions(divisionsData);
      } catch (err) {
        console.error('Error loading divisions:', err);
      } finally {
        setIsLoadingDivisions(false);
      }
    };

    loadDivisions();
  }, [tournament?.id]);

  // Fetch teams from database
  useEffect(() => {
    const loadTeams = async () => {
      if (!tournament?.id) return;

      try {
        setIsLoadingTeams(true);
        const teamsRef = collection(db, 'tournaments', tournament.id, 'teams');
        const teamsSnapshot = await getDocs(teamsRef);

        const teamsData: Team[] = teamsSnapshot.docs.map((teamDoc) => {
          const teamData = teamDoc.data();
          return {
            id: teamDoc.id,
            name: teamData.name || teamDoc.id,
            tag: teamData.tag || '',
            divisionId: teamData.divisionId,
          };
        });
        
        // Check for orphaned team assignments (teams assigned to non-existent divisions)
        const validDivisionIds = new Set(divisions.map(d => d.id));
        const orphanedTeams = teamsData.filter(
          t => t.divisionId && !validDivisionIds.has(t.divisionId)
        );
        
        if (orphanedTeams.length > 0) {
          console.warn(`Found ${orphanedTeams.length} teams with invalid division assignments:`, orphanedTeams);
          
          // Automatically unassign orphaned teams
          const cleanupPromises = orphanedTeams.map(team => {
            const teamRef = doc(db, 'tournaments', tournament.id, 'teams', team.id);
            return updateDoc(teamRef, { divisionId: null });
          });
          
          await Promise.all(cleanupPromises);
          
          // Update local state
          teamsData.forEach(team => {
            if (team.divisionId && !validDivisionIds.has(team.divisionId)) {
              team.divisionId = undefined;
            }
          });
          
          alert(`Znaleziono ${orphanedTeams.length} drużyn przypisanych do nieistniejących dywizji. Zostały automatycznie odłączone.`);
        }

        setTeams(teamsData);

        // Update division team counts only if divisions are loaded
        if (divisions.length > 0) {
          const updatedDivisions = divisions.map(div => ({
            ...div,
            teamsCount: teamsData.filter(t => t.divisionId === div.id).length,
          }));
          setDivisions(updatedDivisions);
        }
      } catch (err) {
        console.error('Error loading teams:', err);
      } finally {
        setIsLoadingTeams(false);
      }
    };

    if (divisions.length > 0) {
      loadTeams();
    }
  }, [tournament?.id, divisions.length]);

  const handleSave = async () => {
    if (!tournament?.id) return;
    
    setIsSaving(true);
    try {
      // Save all divisions to Firestore
      for (const division of divisions) {
        const divisionRef = doc(db, 'tournaments', tournament.id, 'divisions', division.id);
        await setDoc(divisionRef, {
          name: division.name,
          tier: division.tier,
          color: division.color,
          medalUrl: division.medalUrl || null,
          theme: division.theme || null,
        }, { merge: true });
      }
      
      alert('Dywizje zapisane pomyślnie!');
    } catch (error) {
      console.error('Error saving divisions:', error);
      alert('Błąd podczas zapisywania dywizji');
    } finally {
      setIsSaving(false);
    }
  };

  const addDivision = async () => {
    if (!tournament?.id) return;
    
    const newDivisionId = `division-${Date.now()}`;
    const newDivision: Division = {
      id: newDivisionId,
      name: `Dywizja ${divisions.length + 1}`,
      tier: divisions.length + 1,
      color: '#666666',
      teamsCount: 0,
    };
    
    try {
      // Add to Firestore immediately
      const divisionRef = doc(db, 'tournaments', tournament.id, 'divisions', newDivisionId);
      await setDoc(divisionRef, {
        name: newDivision.name,
        tier: newDivision.tier,
        color: newDivision.color,
        medalUrl: null,
        theme: null,
      });
      
      setDivisions([...divisions, newDivision]);
      setEditingId(newDivision.id);
    } catch (error) {
      console.error('Error adding division:', error);
      alert('Błąd podczas dodawania dywizji');
    }
  };

  const removeDivision = async (id: string) => {
    if (!tournament?.id) return;
    
    // Check if there are teams in this division
    const teamsInDivision = teams.filter(t => t.divisionId === id);
    
    if (teamsInDivision.length > 0) {
      const confirmDelete = confirm(
        `Ta dywizja zawiera ${teamsInDivision.length} drużyn(y). Czy na pewno chcesz ją usunąć? Drużyny zostaną odłączone od dywizji.`
      );
      if (!confirmDelete) return;
    }
    
    try {
      // First, unassign all teams from this division
      const updatePromises = teamsInDivision.map(team => {
        const teamRef = doc(db, 'tournaments', tournament.id, 'teams', team.id);
        return updateDoc(teamRef, { divisionId: null });
      });
      await Promise.all(updatePromises);
      
      // Update local teams state
      setTeams(teams.map(t => 
        t.divisionId === id ? { ...t, divisionId: undefined } : t
      ));
      
      // Delete from Firestore
      const divisionRef = doc(db, 'tournaments', tournament.id, 'divisions', id);
      await deleteDoc(divisionRef);
      
      setDivisions(divisions.filter(d => d.id !== id));
      
      alert(`Dywizja usunięta. ${teamsInDivision.length} drużyn(y) zostało odłączonych.`);
    } catch (error) {
      console.error('Error removing division:', error);
      alert('Błąd podczas usuwania dywizji');
    }
  };

  const updateDivision = async (id: string, updates: Partial<Division>) => {
    if (!tournament?.id) return;
    
    try {
      // Update in Firestore
      const divisionRef = doc(db, 'tournaments', tournament.id, 'divisions', id);
      await updateDoc(divisionRef, {
        ...updates,
      });
      
      setDivisions(divisions.map(d => 
        d.id === id ? { ...d, ...updates } : d
      ));
    } catch (error) {
      console.error('Error updating division:', error);
      alert('Błąd podczas aktualizacji dywizji');
    }
  };

  const moveDivision = (id: string, direction: 'up' | 'down') => {
    const index = divisions.findIndex(d => d.id === id);
    if (direction === 'up' && index > 0) {
      const newDivisions = [...divisions];
      [newDivisions[index], newDivisions[index - 1]] = [newDivisions[index - 1], newDivisions[index]];
      // Update tiers
      newDivisions.forEach((d, i) => d.tier = i + 1);
      setDivisions(newDivisions);
    } else if (direction === 'down' && index < divisions.length - 1) {
      const newDivisions = [...divisions];
      [newDivisions[index], newDivisions[index + 1]] = [newDivisions[index + 1], newDivisions[index]];
      newDivisions.forEach((d, i) => d.tier = i + 1);
      setDivisions(newDivisions);
    }
  };

  const assignTeamToDivision = async (teamId: string, divisionId: string) => {
    if (!tournament?.id) return;

    try {
      // Handle unassignment
      const teamRef = doc(db, 'tournaments', tournament.id, 'teams', teamId);
      
      if (divisionId === 'unassigned') {
        // Remove division assignment
        await updateDoc(teamRef, { divisionId: null });
        
        // Update local state
        setTeams(teams.map(t => 
          t.id === teamId ? { ...t, divisionId: undefined } : t
        ));
      } else {
        // Assign to division
        await updateDoc(teamRef, { divisionId });
        
        // Update local state
        setTeams(teams.map(t => 
          t.id === teamId ? { ...t, divisionId } : t
        ));
      }

      // Update division counts
      const updatedDivisions = divisions.map(div => ({
        ...div,
        teamsCount: teams.filter(t => {
          if (t.id === teamId) {
            return divisionId !== 'unassigned' && div.id === divisionId;
          }
          return t.divisionId === div.id;
        }).length,
      }));
      setDivisions(updatedDivisions);
    } catch (err) {
      console.error('Error assigning team:', err);
    }
  };

  const handleMedalUpload = async (divisionId: string, file: File) => {
    if (!tournament?.id) return;
    
    try {
      // Upload to Firebase Storage
      const medalRef = storageRef(storage, `tournaments/${tournament.id}/divisions/${divisionId}/medal.png`);
      await uploadBytes(medalRef, file);
      const downloadURL = await getDownloadURL(medalRef);
      
      // Update division with medal URL
      await updateDivision(divisionId, { medalUrl: downloadURL });
      
      alert('Medal uploaded successfully!');
    } catch (error) {
      console.error('Error uploading medal:', error);
      alert('Błąd podczas uploadu medalu');
    }
  };

  const unassignedTeams = teams.filter(t => !t.divisionId);
  const getTeamsInDivision = (divisionId: string) => 
    teams.filter(t => t.divisionId === divisionId);

  const tierColors = [
    { tier: 1, label: 'Elite', defaultColor: '#D4AF37' },
    { tier: 2, label: 'Challenger', defaultColor: '#C0C0C0' },
    { tier: 3, label: 'Adept', defaultColor: '#CD7F32' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-logik-extended-bold">Zarządzanie dywizjami</h2>
          <p className="text-muted-foreground font-logik">
            Tworzenie, edycja i organizacja dywizji
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline"
            onClick={addDivision}
            className="font-logik"
          >
            <Plus className="h-4 w-4 mr-2" />
            Dodaj dywizję
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

      {/* Divisions List */}
      <div className="space-y-4">
        {isLoadingDivisions ? (
          <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
            <CardContent className="py-12 text-center">
              <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin mb-4" />
              <p className="text-lg font-logik-extended-bold mb-2">Ładowanie dywizji...</p>
            </CardContent>
          </Card>
        ) : divisions.length === 0 ? (
          <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
            <CardContent className="py-12 text-center">
              <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-logik-extended-bold mb-2">Brak dywizji</p>
              <p className="text-muted-foreground font-logik mb-4">
                Dodaj pierwszą dywizję aby rozpocząć konfigurację ligi
              </p>
              <Button onClick={addDivision} className="font-logik">
                <Plus className="h-4 w-4 mr-2" />
                Dodaj dywizję
              </Button>
            </CardContent>
          </Card>
        ) : (
          divisions.map((division, index) => (
            <Card 
              key={division.id} 
              className="border-0 shadow-lg bg-card/50 backdrop-blur-sm overflow-hidden"
            >
              <div 
                className="h-1"
                style={{ backgroundColor: division.color }}
              />
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  {/* Drag Handle */}
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveDivision(division.id, 'up')}
                      disabled={index === 0}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveDivision(division.id, 'down')}
                      disabled={index === divisions.length - 1}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Tier Badge */}
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center font-logik-extended-bold text-lg text-white"
                    style={{ backgroundColor: division.color }}
                  >
                    {division.tier}
                  </div>

                  {/* Division Info */}
                  <div className="flex-1">
                    {editingId === division.id ? (
                      <div className="space-y-3">
                        {/* Name Input */}
                        <Input
                          value={division.name}
                          onChange={(e) => updateDivision(division.id, { name: e.target.value })}
                          className="font-logik max-w-[300px]"
                          placeholder="Nazwa dywizji"
                          autoFocus
                        />
                        
                        {/* Theme Picker */}
                        <div className="flex items-center gap-3">
                          <Label className="font-logik text-sm">Motyw:</Label>
                          <Select
                            value={division.theme || 'custom'}
                            onValueChange={(value) => {
                              if (value === 'custom') {
                                updateDivision(division.id, { theme: undefined });
                              } else {
                                const theme = getDivisionTheme(value);
                                updateDivision(division.id, { 
                                  theme: value,
                                  color: theme?.primaryColor || division.color
                                });
                              }
                            }}
                          >
                            <SelectTrigger className="w-[250px] font-logik">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="custom">Własny kolor</SelectItem>
                              {getAllDivisionThemes().map((theme) => (
                                <SelectItem key={theme.id} value={theme.id}>
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-4 h-4 rounded" 
                                      style={{ background: theme.gradient || theme.primaryColor }}
                                    />
                                    {theme.displayName}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          {/* Show color picker only if custom */}
                          {!division.theme && (
                            <Input
                              type="color"
                              value={division.color}
                              onChange={(e) => updateDivision(division.id, { color: e.target.value })}
                              className="w-12 h-10 p-1 cursor-pointer"
                            />
                          )}
                        </div>

                        {/* Medal Upload */}
                        <div className="flex items-center gap-3">
                          <Label className="font-logik text-sm">Medal:</Label>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleMedalUpload(division.id, file);
                            }}
                            className="w-[250px] font-logik text-sm"
                          />
                          {division.medalUrl && (
                            <img 
                              src={division.medalUrl} 
                              alt="Medal" 
                              className="h-8 w-8 object-contain"
                            />
                          )}
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(null)}
                          className="text-green-500"
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Gotowe
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <h3 className="font-logik-extended-bold text-lg">{division.name}</h3>
                        {division.medalUrl && (
                          <img 
                            src={division.medalUrl} 
                            alt={`${division.name} medal`}
                            className="h-6 w-6 object-contain"
                          />
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingId(division.id)}
                          className="h-8 w-8"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground font-logik">
                      Tier {division.tier} • {division.teamsCount} drużyn
                      {division.theme && (
                        <span className="ml-2">• {getDivisionTheme(division.theme)?.displayName}</span>
                      )}
                    </p>
                  </div>

                  {/* Teams Count */}
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="outline" className="font-logik">
                      {division.teamsCount} drużyn
                    </Badge>
                  </div>

                  {/* Actions */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeDivision(division.id)}
                    className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Team Assignment */}
      {divisions.length > 0 && (
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
              <Users className="h-5 w-5" style={{ color: theme.primaryColor }} />
              Przypisywanie drużyn
            </CardTitle>
            <CardDescription className="font-logik">
              Przypisz drużyny do dywizji
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingTeams ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: theme.primaryColor }} />
              </div>
            ) : teams.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground font-logik">
                <p>Brak drużyn w turnieju.</p>
                <p className="text-sm mt-2">
                  Drużyny muszą zostać zarejestrowane w zakładce "Drużyny".
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Unassigned Teams */}
                {unassignedTeams.length > 0 && (
                  <div className="p-4 rounded-xl border-2 border-dashed border-amber-500/30 bg-amber-500/5">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="h-4 w-4 text-amber-500" />
                      <p className="font-logik-extended-bold text-amber-500">
                        Nieprzypisane drużyny ({unassignedTeams.length})
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {unassignedTeams.map(team => (
                        <div 
                          key={team.id}
                          className="p-3 rounded-lg bg-background border border-border flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center font-logik-extended-bold text-xs">
                              {team.tag}
                            </div>
                            <span className="font-logik text-sm truncate">{team.name}</span>
                          </div>
                          <Select
                            value=""
                            onValueChange={(divId) => assignTeamToDivision(team.id, divId)}
                          >
                            <SelectTrigger className="w-[140px] h-8 text-xs font-logik">
                              <SelectValue placeholder="Przypisz..." />
                            </SelectTrigger>
                            <SelectContent>
                              {divisions.map(div => (
                                <SelectItem key={div.id} value={div.id} className="text-xs">
                                  {div.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Teams by Division */}
                <div className="space-y-4">
                  {divisions.map(division => {
                    const divisionTeams = getTeamsInDivision(division.id);
                    
                    return (
                      <div key={division.id} className="p-4 rounded-xl border border-border bg-background/50">
                        <div className="flex items-center gap-3 mb-3">
                          <div 
                            className="w-10 h-10 rounded-lg flex items-center justify-center font-logik-extended-bold text-white"
                            style={{ backgroundColor: division.color }}
                          >
                            {division.tier}
                          </div>
                          <div className="flex-1">
                            <p className="font-logik-extended-bold">{division.name}</p>
                            <p className="text-xs text-muted-foreground font-logik">
                              {divisionTeams.length} {divisionTeams.length === 1 ? 'drużyna' : 'drużyn'}
                            </p>
                          </div>
                        </div>

                        {divisionTeams.length === 0 ? (
                          <div className="py-6 text-center text-sm text-muted-foreground font-logik">
                            Brak drużyn w tej dywizji
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {divisionTeams.map(team => (
                              <div 
                                key={team.id}
                                className="p-3 rounded-lg bg-card border border-border flex items-center justify-between gap-3"
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <div className="w-8 h-8 rounded bg-muted flex items-center justify-center font-logik-extended-bold text-xs">
                                    {team.tag}
                                  </div>
                                  <span className="font-logik text-sm truncate">{team.name}</span>
                                </div>
                                <Select
                                  value={team.divisionId}
                                  onValueChange={(divId) => assignTeamToDivision(team.id, divId)}
                                >
                                  <SelectTrigger className="w-[140px] h-8 text-xs font-logik">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="unassigned" className="text-xs text-amber-500">
                                      Cofnij przypisanie
                                    </SelectItem>
                                    {divisions.map(div => (
                                      <SelectItem key={div.id} value={div.id} className="text-xs">
                                        {div.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
