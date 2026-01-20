// src/app/admin/MockDataTab.tsx
// Admin tab for generating mock data for PDL testing

"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Plus, Database, Users, Trophy, Calendar, MessageSquare } from 'lucide-react';
import { useTournament } from '@/context/TournamentContext';
import { useAuth } from '@/context/AuthContext';

interface FormState {
  loading: boolean;
  success: string | null;
  error: string | null;
}

export function MockDataTab() {
  const { tournament } = useTournament();
  const { user } = useAuth();
  const [teamForm, setTeamForm] = useState<FormState>({ loading: false, success: null, error: null });
  const [playerForm, setPlayerForm] = useState<FormState>({ loading: false, success: null, error: null });
  const [matchForm, setMatchForm] = useState<FormState>({ loading: false, success: null, error: null });
  const [gameForm, setGameForm] = useState<FormState>({ loading: false, success: null, error: null });
  const [announcementForm, setAnnouncementForm] = useState<FormState>({ loading: false, success: null, error: null });

  // Add Team Handler
  const handleAddTeam = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTeamForm({ loading: true, success: null, error: null });
    
    if (!user) {
      setTeamForm({ loading: false, success: null, error: 'Not authenticated' });
      return;
    }

    const formData = new FormData(e.currentTarget);
    const teamData = {
      name: formData.get('teamName') as string,
      tag: formData.get('teamTag') as string,
      divisionId: formData.get('divisionId') as string,
      motto: formData.get('motto') as string,
      captainId: `mock-captain-${Date.now()}`,
    };

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/mock-data/add-team', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ tournamentId: tournament?.id || 'pdl-s1', ...teamData }),
      });

      if (!response.ok) throw new Error('Failed to add team');
      
      const result = await response.json();
      setTeamForm({ loading: false, success: `Team "${teamData.name}" added successfully!`, error: null });
      (e.target as HTMLFormElement).reset();
    } catch (error: any) {
      setTeamForm({ loading: false, success: null, error: error.message });
    }
  };

  // Add Player Handler
  const handleAddPlayer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPlayerForm({ loading: true, success: null, error: null });
    
    if (!user) {
      setPlayerForm({ loading: false, success: null, error: 'Not authenticated' });
      return;
    }

    const formData = new FormData(e.currentTarget);
    const playerData = {
      teamId: formData.get('teamId') as string,
      nickname: formData.get('nickname') as string,
      role: formData.get('role') as string,
      mmr: parseInt(formData.get('mmr') as string),
      steamId: formData.get('steamId') as string,
    };

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/mock-data/add-player', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ tournamentId: tournament?.id || 'pdl-s1', ...playerData }),
      });

      if (!response.ok) throw new Error('Failed to add player');
      
      setPlayerForm({ loading: false, success: `Player "${playerData.nickname}" added successfully!`, error: null });
      (e.target as HTMLFormElement).reset();
    } catch (error: any) {
      setPlayerForm({ loading: false, success: null, error: error.message });
    }
  };

  // Add Match Handler
  const handleAddMatch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMatchForm({ loading: true, success: null, error: null });
    
    if (!user) {
      setMatchForm({ loading: false, success: null, error: 'Not authenticated' });
      return;
    }

    const formData = new FormData(e.currentTarget);
    const matchData = {
      teamAId: formData.get('teamAId') as string,
      teamBId: formData.get('teamBId') as string,
      divisionId: formData.get('matchDivisionId') as string,
      round: parseInt(formData.get('round') as string),
      scheduledFor: formData.get('scheduledFor') as string,
      format: formData.get('format') as string,
    };

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/mock-data/add-match', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ tournamentId: tournament?.id || 'pdl-s1', ...matchData }),
      });

      if (!response.ok) throw new Error('Failed to add match');
      
      setMatchForm({ loading: false, success: 'Match created successfully!', error: null });
      (e.target as HTMLFormElement).reset();
    } catch (error: any) {
      setMatchForm({ loading: false, success: null, error: error.message });
    }
  };

  // Add Game Handler
  const handleAddGame = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGameForm({ loading: true, success: null, error: null });
    
    if (!user) {
      setGameForm({ loading: false, success: null, error: 'Not authenticated' });
      return;
    }

    const formData = new FormData(e.currentTarget);
    const gameData = {
      matchId: formData.get('matchId') as string,
      radiantWin: formData.get('radiantWin') === 'true',
      duration: parseInt(formData.get('duration') as string),
      generatePerformances: formData.get('generatePerformances') === 'true',
    };

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/mock-data/add-game', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ tournamentId: tournament?.id || 'pdl-s1', ...gameData }),
      });

      if (!response.ok) throw new Error('Failed to add game');
      
      setGameForm({ loading: false, success: 'Game added with performances successfully!', error: null });
      (e.target as HTMLFormElement).reset();
    } catch (error: any) {
      setGameForm({ loading: false, success: null, error: error.message });
    }
  };

  // Add Announcement Handler
  const handleAddAnnouncement = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAnnouncementForm({ loading: true, success: null, error: null });
    
    if (!user) {
      setAnnouncementForm({ loading: false, success: null, error: 'Not authenticated' });
      return;
    }

    const formData = new FormData(e.currentTarget);
    const announcementData = {
      title: formData.get('announcementTitle') as string,
      content: formData.get('announcementContent') as string,
      type: formData.get('announcementType') as string,
      isPinned: formData.get('isPinned') === 'true',
    };

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/mock-data/add-announcement', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ tournamentId: tournament?.id || 'pdl-s1', ...announcementData }),
      });

      if (!response.ok) throw new Error('Failed to add announcement');
      
      setAnnouncementForm({ loading: false, success: 'Announcement created successfully!', error: null });
      (e.target as HTMLFormElement).reset();
    } catch (error: any) {
      setAnnouncementForm({ loading: false, success: null, error: error.message });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Mock Data Generator
          </CardTitle>
          <CardDescription>
            Add mock data for testing PDL features. Current tournament: {tournament?.name || 'PDL Season 1'}
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="team" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="team">
            <Users className="h-4 w-4 mr-2" />
            Team
          </TabsTrigger>
          <TabsTrigger value="player">
            <Trophy className="h-4 w-4 mr-2" />
            Player
          </TabsTrigger>
          <TabsTrigger value="match">
            <Calendar className="h-4 w-4 mr-2" />
            Match
          </TabsTrigger>
          <TabsTrigger value="game">
            <Database className="h-4 w-4 mr-2" />
            Game
          </TabsTrigger>
          <TabsTrigger value="announcement">
            <MessageSquare className="h-4 w-4 mr-2" />
            Announcement
          </TabsTrigger>
        </TabsList>

        {/* Add Team Tab */}
        <TabsContent value="team">
          <Card>
            <CardHeader>
              <CardTitle>Add Mock Team</CardTitle>
              <CardDescription>Create a new team with mock data</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddTeam} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="teamName">Team Name *</Label>
                    <Input
                      id="teamName"
                      name="teamName"
                      placeholder="Shadow Raiders"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="teamTag">Team Tag *</Label>
                    <Input
                      id="teamTag"
                      name="teamTag"
                      placeholder="SHD"
                      maxLength={5}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="divisionId">Division *</Label>
                  <Select name="divisionId" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select division" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="elite">Elite</SelectItem>
                      <SelectItem value="challenger">Challenger</SelectItem>
                      <SelectItem value="adept">Adept</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="motto">Team Motto</Label>
                  <Input
                    id="motto"
                    name="motto"
                    placeholder="Dominating the league"
                  />
                </div>

                {teamForm.success && (
                  <Alert className="bg-green-50 border-green-200">
                    <AlertDescription className="text-green-800">{teamForm.success}</AlertDescription>
                  </Alert>
                )}
                {teamForm.error && (
                  <Alert variant="destructive">
                    <AlertDescription>{teamForm.error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" disabled={teamForm.loading} className="w-full">
                  {teamForm.loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Plus className="mr-2 h-4 w-4" />
                  Add Team
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Add Player Tab */}
        <TabsContent value="player">
          <Card>
            <CardHeader>
              <CardTitle>Add Mock Player</CardTitle>
              <CardDescription>Add a player to an existing team</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddPlayer} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="teamId">Team ID *</Label>
                  <Input
                    id="teamId"
                    name="teamId"
                    placeholder="elite-team-1"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Format: division-team-number (e.g., elite-team-1)
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nickname">Nickname *</Label>
                    <Input
                      id="nickname"
                      name="nickname"
                      placeholder="Player123"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role *</Label>
                    <Select name="role" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Carry">Carry</SelectItem>
                        <SelectItem value="Mid">Mid</SelectItem>
                        <SelectItem value="Offlane">Offlane</SelectItem>
                        <SelectItem value="Soft Support">Soft Support</SelectItem>
                        <SelectItem value="Hard Support">Hard Support</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="mmr">MMR *</Label>
                    <Input
                      id="mmr"
                      name="mmr"
                      type="number"
                      placeholder="5500"
                      min="1000"
                      max="10000"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="steamId">Steam ID (64-bit) *</Label>
                    <Input
                      id="steamId"
                      name="steamId"
                      placeholder="76561198123456789"
                      pattern="^7656119[0-9]{10}$"
                      required
                    />
                  </div>
                </div>

                {playerForm.success && (
                  <Alert className="bg-green-50 border-green-200">
                    <AlertDescription className="text-green-800">{playerForm.success}</AlertDescription>
                  </Alert>
                )}
                {playerForm.error && (
                  <Alert variant="destructive">
                    <AlertDescription>{playerForm.error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" disabled={playerForm.loading} className="w-full">
                  {playerForm.loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Plus className="mr-2 h-4 w-4" />
                  Add Player
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Add Match Tab */}
        <TabsContent value="match">
          <Card>
            <CardHeader>
              <CardTitle>Add Mock Match</CardTitle>
              <CardDescription>Create a scheduled match between two teams</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddMatch} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="teamAId">Team A ID *</Label>
                    <Input
                      id="teamAId"
                      name="teamAId"
                      placeholder="elite-team-1"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="teamBId">Team B ID *</Label>
                    <Input
                      id="teamBId"
                      name="teamBId"
                      placeholder="elite-team-2"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="matchDivisionId">Division *</Label>
                    <Select name="matchDivisionId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select division" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="elite">Elite</SelectItem>
                        <SelectItem value="challenger">Challenger</SelectItem>
                        <SelectItem value="adept">Adept</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="round">Round *</Label>
                    <Input
                      id="round"
                      name="round"
                      type="number"
                      placeholder="1"
                      min="1"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="format">Format *</Label>
                    <Select name="format" defaultValue="bo2" required>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bo1">BO1</SelectItem>
                        <SelectItem value="bo2">BO2</SelectItem>
                        <SelectItem value="bo3">BO3</SelectItem>
                        <SelectItem value="bo5">BO5</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scheduledFor">Scheduled Date/Time *</Label>
                  <Input
                    id="scheduledFor"
                    name="scheduledFor"
                    type="datetime-local"
                    required
                  />
                </div>

                {matchForm.success && (
                  <Alert className="bg-green-50 border-green-200">
                    <AlertDescription className="text-green-800">{matchForm.success}</AlertDescription>
                  </Alert>
                )}
                {matchForm.error && (
                  <Alert variant="destructive">
                    <AlertDescription>{matchForm.error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" disabled={matchForm.loading} className="w-full">
                  {matchForm.loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Plus className="mr-2 h-4 w-4" />
                  Create Match
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Add Game Tab */}
        <TabsContent value="game">
          <Card>
            <CardHeader>
              <CardTitle>Add Mock Game</CardTitle>
              <CardDescription>Add a completed game to a match with auto-generated performances</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddGame} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="matchId">Match ID *</Label>
                  <Input
                    id="matchId"
                    name="matchId"
                    placeholder="pdl-s1-elite-r1-m1"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Full match ID (e.g., pdl-s1-elite-r1-m1)
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="radiantWin">Winner *</Label>
                    <Select name="radiantWin" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select winner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Radiant (Team A)</SelectItem>
                        <SelectItem value="false">Dire (Team B)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration (seconds) *</Label>
                    <Input
                      id="duration"
                      name="duration"
                      type="number"
                      placeholder="2145"
                      min="600"
                      max="7200"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="generatePerformances">Generate Player Performances</Label>
                  <Select name="generatePerformances" defaultValue="true" required>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes - Auto-generate realistic stats</SelectItem>
                      <SelectItem value="false">No - Game only</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Auto-generated performances will have realistic stats based on player roles
                  </p>
                </div>

                {gameForm.success && (
                  <Alert className="bg-green-50 border-green-200">
                    <AlertDescription className="text-green-800">{gameForm.success}</AlertDescription>
                  </Alert>
                )}
                {gameForm.error && (
                  <Alert variant="destructive">
                    <AlertDescription>{gameForm.error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" disabled={gameForm.loading} className="w-full">
                  {gameForm.loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Plus className="mr-2 h-4 w-4" />
                  Add Game
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Add Announcement Tab */}
        <TabsContent value="announcement">
          <Card>
            <CardHeader>
              <CardTitle>Add Mock Announcement</CardTitle>
              <CardDescription>Create a tournament announcement</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddAnnouncement} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="announcementTitle">Title *</Label>
                  <Input
                    id="announcementTitle"
                    name="announcementTitle"
                    placeholder="Important Update"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="announcementContent">Content *</Label>
                  <Textarea
                    id="announcementContent"
                    name="announcementContent"
                    placeholder="Announcement content..."
                    rows={4}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="announcementType">Type *</Label>
                    <Select name="announcementType" defaultValue="info" required>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="isPinned">Pin Announcement</Label>
                    <Select name="isPinned" defaultValue="false" required>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Yes - Pin to top</SelectItem>
                        <SelectItem value="false">No - Normal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {announcementForm.success && (
                  <Alert className="bg-green-50 border-green-200">
                    <AlertDescription className="text-green-800">{announcementForm.success}</AlertDescription>
                  </Alert>
                )}
                {announcementForm.error && (
                  <Alert variant="destructive">
                    <AlertDescription>{announcementForm.error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" disabled={announcementForm.loading} className="w-full">
                  {announcementForm.loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Plus className="mr-2 h-4 w-4" />
                  Create Announcement
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
