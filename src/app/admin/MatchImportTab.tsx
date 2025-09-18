"use client";

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, RefreshCw, AlertCircle, CheckCircle2, XCircle, FileText } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MakeAdminButton } from '@/components/dev/MakeAdminButton';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAllTeams, getAllMatches } from '@/lib/firestore';
import type { Team, Match } from '@/lib/definitions';

export function MatchImportTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [manualMatchIds, setManualMatchIds] = React.useState('');
  const [isManualImporting, setIsManualImporting] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [lastImportResult, setLastImportResult] = React.useState<any>(null);
  
  // Parsed replay upload state
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [matches, setMatches] = React.useState<Match[]>([]);
  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [selectedMatchId, setSelectedMatchId] = React.useState('');
  const [gameId, setGameId] = React.useState('');
  const [radiantTeamId, setRadiantTeamId] = React.useState('');
  const [direTeamId, setDireTeamId] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [isUploading, setIsUploading] = React.useState(false);

  // Load teams and matches data
  React.useEffect(() => {
    async function loadData() {
      try {
        setIsLoadingData(true);
        const [teamsData, matchesData] = await Promise.all([
          getAllTeams(),
          getAllMatches()
        ]);
        setTeams(teamsData);
        setMatches(matchesData);
      } catch (error) {
        console.error('Error loading teams and matches:', error);
        toast({
          title: "Error",
          description: "Failed to load teams and matches data.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingData(false);
      }
    }
    loadData();
  }, [toast]);

  const parseMatchIds = (input: string) => {
    return input
      .split(/[,\s\n]+/)
      .map(id => id.trim())
      .filter(id => id.length > 0);
  };

  const validateMatchIds = (matchIds: string[]) => {
    const invalidIds = matchIds.filter(id => isNaN(Number(id)) || Number(id) <= 0);
    return {
      valid: invalidIds.length === 0,
      invalidIds,
      validCount: matchIds.length - invalidIds.length
    };
  };

  const handleManualImport = async () => {
    if (!manualMatchIds.trim()) {
      toast({
        title: "Error",
        description: "Please enter match IDs",
        variant: "destructive"
      });
      return;
    }

    if (!user) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to perform this action.",
        variant: "destructive",
      });
      return;
    }

    setIsManualImporting(true);
    setLastImportResult(null);
    
    try {
      const matchIds = parseMatchIds(manualMatchIds);
      
      if (matchIds.length === 0) {
        throw new Error("No valid match IDs found");
      }

      const validation = validateMatchIds(matchIds);
      if (!validation.valid) {
        throw new Error(`Invalid match IDs: ${validation.invalidIds.join(', ')}`);
      }

      const token = await user.getIdToken();
      const response = await fetch('/api/admin-import-manual-matches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ matchIds }),
      });

      const result = await response.json();
      setLastImportResult(result);
      
      if (result.success) {
        toast({
          title: "Import Complete!",
          description: result.message,
        });
        setManualMatchIds('');
      } else {
        let errorMsg = result.error || result.message || 'Failed to import matches';
        if (response.status === 403) {
          errorMsg = 'Admin access required. Please use the "Make Me Admin" button in development mode.';
        } else if (response.status === 401) {
          errorMsg = 'Authentication failed. Please log in again.';
        }
        throw new Error(errorMsg);
      }
    } catch (err: any) {
      toast({
        title: "Manual Import Failed",
        description: err.message || 'An error occurred during import',
        variant: "destructive"
      });
    }
    setIsManualImporting(false);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setLastImportResult(null);
    
    try {
      const res = await fetch('/api/admin-sync-matches', { method: 'POST' });
      const result = await res.json();
      setLastImportResult(result);
      
      toast({ 
        title: result.success ? "Sync Complete!" : "Sync Failed", 
        description: result.message, 
        variant: result.success ? "default" : "destructive" 
      });
    } catch (err) {
      toast({ 
        title: "Sync Failed", 
        description: "Network error occurred", 
        variant: "destructive" 
      });
    }
    setIsSyncing(false);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/json') {
      setSelectedFile(file);
      // Try to extract game ID from filename if it follows pattern like "8430102930_opendota.json"
      const match = file.name.match(/^(\d+)_?/);
      if (match) {
        setGameId(match[1]);
      }
    } else {
      toast({
        title: "Invalid File",
        description: "Please select a JSON file.",
        variant: "destructive"
      });
      event.target.value = '';
    }
  };

  const handleParsedReplayUpload = async () => {
    if (!selectedFile || !selectedMatchId || !gameId || !radiantTeamId || !direTeamId) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields and select a JSON file.",
        variant: "destructive"
      });
      return;
    }

    if (!user) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to perform this action.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsUploading(true);
      
      // Read and parse the JSON file
      const fileContent = await selectedFile.text();
      const matchData = JSON.parse(fileContent);
      
      // Prepare the upload request
      const uploadData = {
        matchData,
        matchId: selectedMatchId,
        gameId,
        radiantTeamId,
        direTeamId,
        description: description.trim() || undefined
      };
      
      console.log('Uploading parsed replay:', {
        gameId,
        matchId: selectedMatchId,
        radiantTeam: teams.find(t => t.id === radiantTeamId)?.name,
        direTeam: teams.find(t => t.id === direTeamId)?.name
      });
      
      const response = await fetch('/api/admin/uploadParsedReplay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(uploadData)
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        toast({
          title: "Upload Successful",
          description: result.message,
          variant: "default"
        });
        
        // Reset form
        setSelectedFile(null);
        setSelectedMatchId('');
        setGameId('');
        setRadiantTeamId('');
        setDireTeamId('');
        setDescription('');
        if (document.getElementById('file-input')) {
          (document.getElementById('file-input') as HTMLInputElement).value = '';
        }
        
      } else {
        throw new Error(result.message || 'Upload failed');
      }
      
    } catch (error: any) {
      console.error('Parsed replay upload failed:', error);
      toast({
        title: "Upload Failed",
        description: error.message || 'An unexpected error occurred',
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const parsedMatchIds = parseMatchIds(manualMatchIds);
  const validation = validateMatchIds(parsedMatchIds);

  return (
    <div className="space-y-6">
      {/* Development Admin Helper */}
      <MakeAdminButton />
      
      {/* Manual Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Manual Match Import
          </CardTitle>
          <CardDescription>
            Import matches manually when STRATZ API is unavailable. Provide a list of match IDs to process them through your existing match saving algorithm.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Match IDs</label>
            <Textarea
              value={manualMatchIds}
              onChange={(e) => setManualMatchIds(e.target.value)}
              placeholder="Enter match IDs separated by commas, spaces, or new lines:&#10;&#10;Example:&#10;7123456789, 7123456790&#10;7123456791&#10;7123456792"
              className="min-h-[120px] font-mono text-sm"
              disabled={isManualImporting}
            />
            
            {/* Validation Info */}
            {manualMatchIds.trim() && (
              <div className="flex items-center gap-2 text-sm">
                {validation.valid ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-green-600">
                      {validation.validCount} valid match ID{validation.validCount !== 1 ? 's' : ''} found
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-red-600">
                      {validation.invalidIds.length} invalid ID{validation.invalidIds.length !== 1 ? 's' : ''}: {validation.invalidIds.join(', ')}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This will check if matches haven't been saved already, match teams and players between tournament and the match data, and save the matches updating all scores and statistics.
            </AlertDescription>
          </Alert>

          <Button 
            onClick={handleManualImport} 
            disabled={isManualImporting || !manualMatchIds.trim() || !validation.valid}
            className="w-full"
            size="lg"
          >
            {isManualImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing {validation.validCount} match{validation.validCount !== 1 ? 'es' : ''}...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Import {validation.validCount || 0} Match{validation.validCount !== 1 ? 'es' : ''}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* STRATZ API Sync */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            STRATZ API Sync
          </CardTitle>
          <CardDescription>
            Automatically fetch and import new matches from STRATZ API for the configured league.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleSync} 
            disabled={isSyncing}
            variant="outline"
            size="lg"
            className="w-full"
          >
            {isSyncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing from STRATZ...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync All New Matches from STRATZ
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Parsed Replay Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Upload Parsed Replay
          </CardTitle>
          <CardDescription>
            Upload a parsed replay JSON file with manual team assignments. Useful for replays that can't be automatically matched or imported from OpenDota.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingData ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading teams and matches...
            </div>
          ) : (
            <>
              {/* File Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Parsed Replay JSON File</label>
                <Input
                  id="file-input"
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  disabled={isUploading}
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {selectedFile.name}
                  </p>
                )}
              </div>

              {/* Match Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Tournament Match</label>
                <Select value={selectedMatchId} onValueChange={setSelectedMatchId} disabled={isUploading}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a tournament match" />
                  </SelectTrigger>
                  <SelectContent>
                    {matches.filter(match => match.teamA && match.teamB).map((match) => (
                      <SelectItem key={match.id} value={match.id}>
                        {match.teamA.name} vs {match.teamB.name} ({match.group_id || match.playoff_round || 'Round ?'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Game ID */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Game ID</label>
                <Input
                  type="text"
                  value={gameId}
                  onChange={(e) => setGameId(e.target.value)}
                  placeholder="Enter game ID (e.g., 8430102930)"
                  disabled={isUploading}
                />
              </div>

              {/* Team Assignments */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Radiant Team</label>
                  <Select value={radiantTeamId} onValueChange={setRadiantTeamId} disabled={isUploading}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Radiant team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Dire Team</label>
                  <Select value={direTeamId} onValueChange={setDireTeamId} disabled={isUploading}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Dire team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Optional Description */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Description (Optional)</label>
                <Input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description or notes"
                  disabled={isUploading}
                />
              </div>

              {/* Upload Button */}
              <Button
                onClick={handleParsedReplayUpload}
                disabled={isUploading || !selectedFile || !selectedMatchId || !gameId || !radiantTeamId || !direTeamId}
                variant="default"
                size="lg"
                className="w-full"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading and Processing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Parsed Replay
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Last Import Result */}
      {lastImportResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Last Import Result
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {lastImportResult.success ? (
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Success
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    Failed
                  </Badge>
                )}
              </div>
              
              <p className="text-sm">{lastImportResult.message}</p>
              
              {lastImportResult.success && (
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div className="text-center p-2 bg-green-50 rounded">
                    <div className="font-medium text-green-700">{lastImportResult.importedCount || 0}</div>
                    <div className="text-green-600">Imported</div>
                  </div>
                  <div className="text-center p-2 bg-yellow-50 rounded">
                    <div className="font-medium text-yellow-700">{lastImportResult.skippedCount || 0}</div>
                    <div className="text-yellow-600">Skipped</div>
                  </div>
                  <div className="text-center p-2 bg-blue-50 rounded">
                    <div className="font-medium text-blue-700">{lastImportResult.alreadyProcessedCount || 0}</div>
                    <div className="text-blue-600">Already Processed</div>
                  </div>
                  <div className="text-center p-2 bg-red-50 rounded">
                    <div className="font-medium text-red-700">{lastImportResult.failedCount || 0}</div>
                    <div className="text-red-600">Failed</div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
