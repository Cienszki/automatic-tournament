"use client";

import React, { useState, useEffect } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LayoutGrid,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Users,
  ChevronUp,
  ChevronDown,
  Edit2,
  Check,
  Loader2,
} from 'lucide-react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getGroups, saveGroup, deleteGroup as deleteGroupApi, type GroupDoc } from '@/lib/api/groups';

interface Team {
  id: string;
  name: string;
  tag: string;
  groupId?: string;
}

/**
 * GroupsTab — Manage groups for MMR-limited tournaments.
 * Admin can create, rename, reorder and delete groups,
 * then assign teams to them.
 */
export function GroupsTab() {
  const { tournament, theme } = useTournament();

  const [groups, setGroups] = useState<GroupDoc[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ── Load groups ──────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      if (!tournament?.id) return;
      setIsLoadingGroups(true);
      try {
        const data = await getGroups(tournament.id);
        setGroups(data);
      } catch (err) {
        console.error('Error loading groups:', err);
      } finally {
        setIsLoadingGroups(false);
      }
    };
    load();
  }, [tournament?.id]);

  // ── Load teams ───────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      if (!tournament?.id || groups.length === 0) return;
      setIsLoadingTeams(true);
      try {
        const teamsRef = collection(db, 'tournaments', tournament.id, 'teams');
        const snap = await getDocs(teamsRef);
        const data: Team[] = snap.docs.map((d) => {
          const td = d.data();
          return {
            id: d.id,
            name: td.name || d.id,
            tag: td.tag || '',
            groupId: td.groupId,
          };
        });

        // Orphan cleanup — teams assigned to non-existent groups
        const validIds = new Set(groups.map((g) => g.id));
        const orphans = data.filter((t) => t.groupId && !validIds.has(t.groupId));
        if (orphans.length > 0) {
          await Promise.all(
            orphans.map((t) =>
              updateDoc(doc(db, 'tournaments', tournament.id, 'teams', t.id), { groupId: null }),
            ),
          );
          data.forEach((t) => {
            if (t.groupId && !validIds.has(t.groupId)) t.groupId = undefined;
          });
        }

        setTeams(data);
      } catch (err) {
        console.error('Error loading teams:', err);
      } finally {
        setIsLoadingTeams(false);
      }
    };
    load();
  }, [tournament?.id, groups.length]);

  // ── CRUD helpers ─────────────────────────────────────
  const addGroup = async () => {
    if (!tournament?.id) return;
    const newId = `group-${Date.now()}`;
    const newGroup: GroupDoc = {
      id: newId,
      name: `Grupa ${String.fromCharCode(65 + groups.length)}`, // A, B, C…
      order: groups.length + 1,
    };
    try {
      await saveGroup(tournament.id, newGroup);
      setGroups([...groups, newGroup]);
      setEditingId(newId);
    } catch (err) {
      console.error('Error adding group:', err);
    }
  };

  const removeGroup = async (id: string) => {
    if (!tournament?.id) return;
    const teamsInGroup = teams.filter((t) => t.groupId === id);
    if (teamsInGroup.length > 0) {
      const ok = confirm(
        `Ta grupa zawiera ${teamsInGroup.length} drużyn(y). Czy na pewno chcesz ją usunąć? Drużyny zostaną odłączone.`,
      );
      if (!ok) return;
    }
    try {
      // Unassign teams
      await Promise.all(
        teamsInGroup.map((t) =>
          updateDoc(doc(db, 'tournaments', tournament.id, 'teams', t.id), { groupId: null }),
        ),
      );
      setTeams(teams.map((t) => (t.groupId === id ? { ...t, groupId: undefined } : t)));
      // Delete group document
      await deleteGroupApi(tournament.id, id);
      const remaining = groups.filter((g) => g.id !== id);
      remaining.forEach((g, i) => (g.order = i + 1));
      setGroups(remaining);
    } catch (err) {
      console.error('Error removing group:', err);
    }
  };

  const updateGroupName = (id: string, name: string) => {
    setGroups(groups.map((g) => (g.id === id ? { ...g, name } : g)));
  };

  const moveGroup = (id: string, direction: 'up' | 'down') => {
    const idx = groups.findIndex((g) => g.id === id);
    if (direction === 'up' && idx > 0) {
      const next = [...groups];
      [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
      next.forEach((g, i) => (g.order = i + 1));
      setGroups(next);
    } else if (direction === 'down' && idx < groups.length - 1) {
      const next = [...groups];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      next.forEach((g, i) => (g.order = i + 1));
      setGroups(next);
    }
  };

  const assignTeam = async (teamId: string, groupId: string) => {
    if (!tournament?.id) return;
    try {
      const teamRef = doc(db, 'tournaments', tournament.id, 'teams', teamId);
      if (groupId === 'unassigned') {
        await updateDoc(teamRef, { groupId: null });
        setTeams(teams.map((t) => (t.id === teamId ? { ...t, groupId: undefined } : t)));
      } else {
        await updateDoc(teamRef, { groupId });
        setTeams(teams.map((t) => (t.id === teamId ? { ...t, groupId } : t)));
      }
    } catch (err) {
      console.error('Error assigning team:', err);
    }
  };

  const handleSave = async () => {
    if (!tournament?.id) return;
    setIsSaving(true);
    try {
      await Promise.all(groups.map((g) => saveGroup(tournament.id, g)));
      alert('Grupy zapisane pomyślnie!');
    } catch (err) {
      console.error('Error saving groups:', err);
      alert('Błąd podczas zapisywania grup');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Derived data ─────────────────────────────────────
  const unassignedTeams = teams.filter((t) => !t.groupId);
  const getTeamsInGroup = (groupId: string) => teams.filter((t) => t.groupId === groupId);

  // ── Render ───────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-logik-extended-bold">Zarządzanie grupami</h2>
          <p className="text-muted-foreground font-logik">
            Tworzenie, edycja i organizacja grup fazy grupowej
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={addGroup} className="font-logik">
            <Plus className="h-4 w-4 mr-2" />
            Dodaj grupę
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

      {/* Groups list */}
      <div className="space-y-4">
        {isLoadingGroups ? (
          <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
            <CardContent className="py-12 text-center">
              <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin mb-4" />
              <p className="text-lg font-logik-extended-bold mb-2">Ładowanie grup...</p>
            </CardContent>
          </Card>
        ) : groups.length === 0 ? (
          <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
            <CardContent className="py-12 text-center">
              <LayoutGrid className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-logik-extended-bold mb-2">Brak grup</p>
              <p className="text-muted-foreground font-logik mb-4">
                Dodaj pierwszą grupę aby rozpocząć konfigurację fazy grupowej
              </p>
              <Button onClick={addGroup} className="font-logik">
                <Plus className="h-4 w-4 mr-2" />
                Dodaj grupę
              </Button>
            </CardContent>
          </Card>
        ) : (
          groups.map((group, index) => (
            <Card
              key={group.id}
              className="border-0 shadow-lg bg-card/50 backdrop-blur-sm overflow-hidden"
            >
              <div className="h-1" style={{ backgroundColor: theme.primaryColor }} />
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  {/* Reorder */}
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveGroup(group.id, 'up')}
                      disabled={index === 0}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveGroup(group.id, 'down')}
                      disabled={index === groups.length - 1}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Order badge */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center font-logik-extended-bold text-lg text-white"
                    style={{ backgroundColor: theme.primaryColor }}
                  >
                    {group.order}
                  </div>

                  {/* Name */}
                  <div className="flex-1">
                    {editingId === group.id ? (
                      <div className="flex items-center gap-3">
                        <Input
                          value={group.name}
                          onChange={(e) => updateGroupName(group.id, e.target.value)}
                          className="font-logik max-w-[300px]"
                          placeholder="Nazwa grupy"
                          autoFocus
                        />
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
                        <h3 className="font-logik-extended-bold text-lg">{group.name}</h3>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingId(group.id)}
                          className="h-8 w-8"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground font-logik">
                      {getTeamsInGroup(group.id).length} drużyn
                    </p>
                  </div>

                  {/* Teams count badge */}
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="outline" className="font-logik">
                      {getTeamsInGroup(group.id).length} drużyn
                    </Badge>
                  </div>

                  {/* Delete */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeGroup(group.id)}
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

      {/* Team assignment */}
      {groups.length > 0 && (
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
              <Users className="h-5 w-5" style={{ color: theme.primaryColor }} />
              Przypisywanie drużyn
            </CardTitle>
            <CardDescription className="font-logik">
              Przypisz drużyny do grup fazy grupowej
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
                  Drużyny muszą zostać zarejestrowane w zakładce &quot;Drużyny&quot;.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Unassigned teams */}
                {unassignedTeams.length > 0 && (
                  <div className="p-4 rounded-xl border-2 border-dashed border-amber-500/30 bg-amber-500/5">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="h-4 w-4 text-amber-500" />
                      <p className="font-logik-extended-bold text-amber-500">
                        Nieprzypisane drużyny ({unassignedTeams.length})
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {unassignedTeams.map((team) => (
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
                          <Select value="" onValueChange={(gId) => assignTeam(team.id, gId)}>
                            <SelectTrigger className="w-[140px] h-8 text-xs font-logik">
                              <SelectValue placeholder="Przypisz..." />
                            </SelectTrigger>
                            <SelectContent>
                              {groups.map((g) => (
                                <SelectItem key={g.id} value={g.id} className="text-xs">
                                  {g.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Teams by group */}
                <div className="space-y-4">
                  {groups.map((group) => {
                    const groupTeams = getTeamsInGroup(group.id);
                    return (
                      <div
                        key={group.id}
                        className="p-4 rounded-xl border border-border bg-background/50"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center font-logik-extended-bold text-white"
                            style={{ backgroundColor: theme.primaryColor }}
                          >
                            {group.order}
                          </div>
                          <div className="flex-1">
                            <p className="font-logik-extended-bold">{group.name}</p>
                            <p className="text-xs text-muted-foreground font-logik">
                              {groupTeams.length} {groupTeams.length === 1 ? 'drużyna' : 'drużyn'}
                            </p>
                          </div>
                        </div>

                        {groupTeams.length === 0 ? (
                          <div className="py-6 text-center text-sm text-muted-foreground font-logik">
                            Brak drużyn w tej grupie
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {groupTeams.map((team) => (
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
                                  value={team.groupId}
                                  onValueChange={(gId) => assignTeam(team.id, gId)}
                                >
                                  <SelectTrigger className="w-[140px] h-8 text-xs font-logik">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem
                                      value="unassigned"
                                      className="text-xs text-amber-500"
                                    >
                                      Cofnij przypisanie
                                    </SelectItem>
                                    {groups.map((g) => (
                                      <SelectItem key={g.id} value={g.id} className="text-xs">
                                        {g.name}
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
