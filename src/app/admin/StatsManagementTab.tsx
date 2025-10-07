'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, BarChart3, RefreshCw, CheckCircle, AlertCircle, TrendingUp, Users, Trophy, Database, RotateCcw, Star, Sparkles } from 'lucide-react';

export function StatsManagementTab() {
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; timestamp?: string } | null>(null);
  const [isUpdatingMatches, setIsUpdatingMatches] = useState(false);
  const [updateResult, setUpdateResult] = useState<{ success: boolean; message: string; results?: any } | null>(null);
  const [isResyncingMatches, setIsResyncingMatches] = useState(false);
  const [resyncResult, setResyncResult] = useState<{ success: boolean; message: string; results?: any } | null>(null);
  const [isRecalculatingFantasy, setIsRecalculatingFantasy] = useState(false);
  const [fantasyResult, setFantasyResult] = useState<{ success: boolean; message: string; usersProcessed?: number; roundsProcessed?: string[]; totalPointsDistributed?: number; totalGamesPlayed?: number } | null>(null);
  const [isRecalculatingFantasyEnhanced, setIsRecalculatingFantasyEnhanced] = useState(false);
  const [fantasyEnhancedResult, setFantasyEnhancedResult] = useState<{ success: boolean; message: string; usersProcessed?: number; playersProcessed?: number; totalGamesAnalyzed?: number } | null>(null);
  const [isRecalculatingUserFantasy, setIsRecalculatingUserFantasy] = useState(false);
  const [userFantasyResult, setUserFantasyResult] = useState<{ success: boolean; message: string; usersProcessed?: number; roundsProcessed?: string[]; totalGamesAnalyzed?: number } | null>(null);

  const handleRecalculateStats = async () => {
    setIsRecalculating(true);
    setResult(null);
    
    try {
      const response = await fetch('/api/stats/recalculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      
      const data = await response.json();
      
      setResult({
        success: data.success,
        message: data.message,
        timestamp: data.timestamp
      });
      
    } catch (error) {
      setResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
      });
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleUpdateAllMatches = async () => {
    setIsUpdatingMatches(true);
    setUpdateResult(null);
    
    try {
      const response = await fetch('/api/admin/updateAllSavedMatches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          updateFantasyScores: true,
          dryRun: false
        })
      });
      
      const data = await response.json();
      
      setUpdateResult({
        success: data.success,
        message: data.message,
        results: data.results
      });
      
    } catch (error) {
      setUpdateResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
      });
    } finally {
      setIsUpdatingMatches(false);
    }
  };

  const handleResyncAllMatches = async () => {
    setIsResyncingMatches(true);
    setResyncResult(null);
    
    try {
      const response = await fetch('/api/admin/resyncAllMatches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          updateFantasyScores: false,
          dryRun: false
        })
      });
      
      const data = await response.json();
      
      setResyncResult({
        success: data.success,
        message: data.message,
        results: data.results
      });
      
    } catch (error) {
      setResyncResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
      });
    } finally {
      setIsResyncingMatches(false);
    }
  };

  const handleRecalculateFantasyScores = async () => {
    setIsRecalculatingFantasy(true);
    setFantasyResult(null);
    
    try {
      const response = await fetch('/api/admin/recalculateFantasyScores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      
      const data = await response.json();
      
      setFantasyResult({
        success: data.success,
        message: data.message,
        usersProcessed: data.usersProcessed,
        roundsProcessed: data.roundsProcessed,
        totalPointsDistributed: data.totalPointsDistributed,
        totalGamesPlayed: data.totalGamesPlayed
      });
      
    } catch (error) {
      setFantasyResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
      });
    } finally {
      setIsRecalculatingFantasy(false);
    }
  };

  const handleRecalculateFantasyScoresEnhanced = async () => {
    setIsRecalculatingFantasyEnhanced(true);
    setFantasyEnhancedResult(null);

    try {
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout

      const response = await fetch('/api/admin/recalculateFantasyScoresEnhanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({}),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Check if response is actually JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Invalid response format. Expected JSON but got: ${contentType}`);
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      setFantasyEnhancedResult({
        success: data.success,
        message: data.message,
        usersProcessed: data.usersProcessed,
        playersProcessed: data.playersProcessed,
        totalGamesAnalyzed: data.totalGamesAnalyzed
      });

    } catch (error) {
      let errorMessage = 'Unknown error occurred';

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Request timed out after 5 minutes. The operation may still be running in the background.';
        } else if (error.message.includes('JSON.parse')) {
          errorMessage = 'Server returned invalid JSON response. Check server logs for details.';
        } else {
          errorMessage = error.message;
        }
      }

      setFantasyEnhancedResult({
        success: false,
        message: `Error: ${errorMessage}`
      });
    } finally {
      setIsRecalculatingFantasyEnhanced(false);
    }
  };

  const handleRecalculateUserFantasy = async () => {
    setIsRecalculatingUserFantasy(true);
    setUserFantasyResult(null);
    
    try {
      const response = await fetch('/api/admin/recalc-user-fantasy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      
      const data = await response.json();
      
      setUserFantasyResult({
        success: data.success,
        message: data.message,
        usersProcessed: data.result?.usersProcessed,
        roundsProcessed: data.result?.roundsProcessed,
        totalGamesAnalyzed: data.result?.totalGamesAnalyzed
      });
      
    } catch (error) {
      setUserFantasyResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
      });
    } finally {
      setIsRecalculatingUserFantasy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Tournament Statistics Management
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Manage and recalculate comprehensive tournament statistics covering all player and team performance metrics.
          </p>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {/* Stats Recalculation Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <RefreshCw className="h-4 w-4" />
              Recalculate All Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                This operation will process all tournament data and update:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• All 71 tournament statistics</li>
                <li>• Player performance records</li>
                <li>• Team achievement records</li>
                <li>• Combat and economic metrics</li>
              </ul>
            </div>

            <Button 
              onClick={handleRecalculateStats}
              disabled={isRecalculating}
              className="w-full"
            >
              {isRecalculating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Recalculate Statistics
                </>
              )}
            </Button>

            {/* Result Display */}
            {result && (
              <Alert className={result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                <div className="flex items-start gap-2">
                  {result.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <AlertDescription className={result.success ? 'text-green-800' : 'text-red-800'}>
                      <div className="font-medium mb-1">
                        {result.success ? 'Success!' : 'Error'}
                      </div>
                      <div className="text-sm">
                        {result.message}
                      </div>
                      {result.timestamp && (
                        <div className="text-xs mt-2 opacity-75">
                          {new Date(result.timestamp).toLocaleString()}
                        </div>
                      )}
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            )}

            {/* Success Instructions */}
            {result?.success && (
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <div className="text-sm text-blue-800 space-y-1">
                  <p className="font-medium">✅ Statistics Updated Successfully</p>
                  <p>Visit the <a href="/stats" className="underline hover:no-underline font-medium">Stats Page</a> to view the results</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Update All Matches Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="h-4 w-4" />
              Update Existing Matches
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Update all saved matches with latest OpenDota data:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Refreshes existing match data</li>
                <li>• Preserves team assignments</li>
                <li>• Updates fantasy scores</li>
                <li>• Non-destructive operation</li>
              </ul>
            </div>

            <Button 
              onClick={handleUpdateAllMatches}
              disabled={isUpdatingMatches}
              className="w-full"
            >
              {isUpdatingMatches ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Database className="mr-2 h-4 w-4" />
                  Update All Matches
                </>
              )}
            </Button>

            {/* Update Result Display */}
            {updateResult && (
              <Alert className={updateResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                <div className="flex items-start gap-2">
                  {updateResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <AlertDescription className={updateResult.success ? 'text-green-800' : 'text-red-800'}>
                      <div className="font-medium mb-1">
                        {updateResult.success ? 'Success!' : 'Error'}
                      </div>
                      <div className="text-sm">
                        {updateResult.message}
                      </div>
                      {updateResult.results && updateResult.success && (
                        <div className="text-xs mt-2 space-y-1">
                          <div>Updated: {updateResult.results.updatedMatches}/{updateResult.results.totalMatches} matches</div>
                          <div>Fantasy updates: {updateResult.results.fantasyScoreUpdates}</div>
                        </div>
                      )}
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Re-sync All Matches Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <RotateCcw className="h-4 w-4" />
              Re-sync with Enhanced Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Re-sync all matches with enhanced OpenDota data:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Adds multikill data (rampages, etc.)</li>
                <li>• Includes roshan kills & tower kills</li>
                <li>• Updates with all new stat fields</li>
                <li>• Identifies manual matches</li>
              </ul>
            </div>

            <Button 
              onClick={handleResyncAllMatches}
              disabled={isResyncingMatches}
              className="w-full"
              variant="outline"
            >
              {isResyncingMatches ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Re-syncing...
                </>
              ) : (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Re-sync All Matches
                </>
              )}
            </Button>

            {/* Re-sync Result Display */}
            {resyncResult && (
              <Alert className={resyncResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                <div className="flex items-start gap-2">
                  {resyncResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <AlertDescription className={resyncResult.success ? 'text-green-800' : 'text-red-800'}>
                      <div className="font-medium mb-1">
                        {resyncResult.success ? 'Success!' : 'Error'}
                      </div>
                      <div className="text-sm">
                        {resyncResult.message}
                      </div>
                      {resyncResult.results && resyncResult.success && (
                        <div className="text-xs mt-2 space-y-1">
                          <div>Re-synced: {resyncResult.results.resyncedGames}/{resyncResult.results.totalGames} games</div>
                          <div>Manual matches found: {resyncResult.results.manualMatches?.length || 0}</div>
                          {resyncResult.results.manualMatches?.length > 0 && (
                            <details className="mt-2">
                              <summary className="cursor-pointer font-medium">Manual Matches List</summary>
                              <div className="mt-1 pl-4 border-l-2 border-green-300">
                                {resyncResult.results.manualMatches.map((match: any, i: number) => (
                                  <div key={i} className="text-xs">
                                    Game {match.gameId}: {match.radiantTeam} vs {match.direTeam}
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                      )}
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Fantasy Score Recalculation Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Star className="h-4 w-4" />
              Recalculate Fantasy Scores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Recalculate all fantasy scores for all users:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Updates all user fantasy scores</li>
                <li>• Respects round-specific lineups</li>
                <li>• Calculates average scores per game</li>
                <li>• Safe to run multiple times</li>
              </ul>
            </div>

            <Button 
              onClick={handleRecalculateFantasyScores}
              disabled={isRecalculatingFantasy}
              className="w-full"
              variant="secondary"
            >
              {isRecalculatingFantasy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recalculating...
                </>
              ) : (
                <>
                  <Star className="mr-2 h-4 w-4" />
                  Recalculate Fantasy Scores
                </>
              )}
            </Button>

            {/* Fantasy Result Display */}
            {fantasyResult && (
              <Alert className={fantasyResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                <div className="flex items-start gap-2">
                  {fantasyResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <AlertDescription className={fantasyResult.success ? 'text-green-800' : 'text-red-800'}>
                      <div className="font-medium mb-1">
                        {fantasyResult.success ? 'Success!' : 'Error'}
                      </div>
                      <div className="text-sm">
                        {fantasyResult.message}
                      </div>
                      {fantasyResult.success && fantasyResult.usersProcessed && (
                        <div className="text-xs mt-2 space-y-1">
                          <div>Users processed: {fantasyResult.usersProcessed}</div>
                          <div>Rounds processed: {fantasyResult.roundsProcessed?.length || 0}</div>
                          <div>Total points distributed: {fantasyResult.totalPointsDistributed?.toLocaleString()}</div>
                          <div>Total games played: {fantasyResult.totalGamesPlayed?.toLocaleString()}</div>
                        </div>
                      )}
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            )}

            {/* Success Instructions */}
            {fantasyResult?.success && (
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <div className="text-sm text-blue-800 space-y-1">
                  <p className="font-medium">✅ Fantasy Scores Updated Successfully</p>
                  <p>Visit the <a href="/fantasy" className="underline hover:no-underline font-medium">Fantasy Page</a> to view updated leaderboards</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Enhanced Fantasy Score Recalculation Card */}
        <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-orange-700">
              <Sparkles className="h-4 w-4" />
              Enhanced Fantasy Recalculation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                <strong className="text-orange-600">Updates leaderboards!</strong> Comprehensive recalculation:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Rebuilds cached leaderboard data</li>
                <li>• Creates optimized collections</li>
                <li>• Fixes leaderboard display issues</li>
                <li>• Respects round-specific lineups</li>
              </ul>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleRecalculateFantasyScoresEnhanced}
                disabled={isRecalculatingFantasyEnhanced}
                className="flex-1 bg-orange-600 hover:bg-orange-700"
              >
                {isRecalculatingFantasyEnhanced ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Full Enhanced
                  </>
                )}
              </Button>

              <Button
                onClick={handleRecalculateUserFantasy}
                disabled={isRecalculatingUserFantasy}
                className="flex-1 bg-orange-500 hover:bg-orange-600"
              >
                {isRecalculatingUserFantasy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Quick Batch
                  </>
                )}
              </Button>
            </div>

            {/* Enhanced Fantasy Result Display */}
            {fantasyEnhancedResult && (
              <Alert className={fantasyEnhancedResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                <div className="flex items-start gap-2">
                  {fantasyEnhancedResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <AlertDescription className={fantasyEnhancedResult.success ? 'text-green-800' : 'text-red-800'}>
                      <div className="font-medium mb-1">
                        {fantasyEnhancedResult.success ? 'Success!' : 'Error'}
                      </div>
                      <div className="text-sm">
                        {fantasyEnhancedResult.message}
                      </div>
                      {fantasyEnhancedResult.success && (
                        <div className="text-xs mt-2 space-y-1">
                          <div>Users processed: {fantasyEnhancedResult.usersProcessed}</div>
                          <div>Players processed: {fantasyEnhancedResult.playersProcessed}</div>
                          <div>Games analyzed: {fantasyEnhancedResult.totalGamesAnalyzed}</div>
                        </div>
                      )}
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            )}

            {/* Enhanced Success Instructions */}
            {fantasyEnhancedResult?.success && (
              <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                <div className="text-sm text-green-800 space-y-1">
                  <p className="font-medium">🎉 Leaderboards Updated!</p>
                  <p>Visit the <a href="/fantasy" className="underline hover:no-underline font-medium">Fantasy Page</a> to see the corrected leaderboards</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* User Fantasy Score Recalculation Card */}
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-blue-700">
              <Users className="h-4 w-4" />
              User Fantasy Leaderboards Fix
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                <strong className="text-blue-600">Fixes match count issue!</strong> Round-aware recalculation:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Updates user scores across all rounds</li>
                <li>• Fixes "0 Mecze" display issue</li>
                <li>• Respects group stage + wildcards</li>
                <li>• Only counts games per round</li>
              </ul>
            </div>

            <Button 
              onClick={handleRecalculateUserFantasy}
              disabled={isRecalculatingUserFantasy}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {isRecalculatingUserFantasy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recalculating...
                </>
              ) : (
                <>
                  <Users className="mr-2 h-4 w-4" />
                  Fix User Leaderboards
                </>
              )}
            </Button>

            {/* User Fantasy Result Display */}
            {userFantasyResult && (
              <Alert className={userFantasyResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                <div className="flex items-start gap-2">
                  {userFantasyResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <AlertDescription className={userFantasyResult.success ? 'text-green-800' : 'text-red-800'}>
                      <div className="font-medium mb-1">
                        {userFantasyResult.success ? 'Success!' : 'Error'}
                      </div>
                      <div className="text-sm">
                        {userFantasyResult.message}
                      </div>
                      {userFantasyResult.success && (
                        <div className="text-xs mt-2 space-y-1">
                          <div>Users processed: {userFantasyResult.usersProcessed}</div>
                          <div>Rounds processed: {userFantasyResult.roundsProcessed?.join(', ')}</div>
                          <div>Total games analyzed: {userFantasyResult.totalGamesAnalyzed}</div>
                        </div>
                      )}
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            )}

            {/* User Fantasy Success Instructions */}
            {userFantasyResult?.success && (
              <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                <div className="text-sm text-green-800 space-y-1">
                  <p className="font-medium">✅ User Leaderboards Fixed!</p>
                  <p>Visit the <a href="/fantasy" className="underline hover:no-underline font-medium">Fantasy Page</a> to see updated match counts</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Statistics Overview - Moved below the action cards */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-4 w-4" />
            Statistics Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Tournament Stats</span>
              </div>
              <span className="text-lg font-bold text-blue-900">22</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-green-100 rounded-lg">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-900">Player Records</span>
              </div>
              <span className="text-lg font-bold text-green-900">32</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-900">Team Records</span>
              </div>
              <span className="text-lg font-bold text-purple-900">17</span>
            </div>
          </div>
          
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total Statistics</span>
              <span className="text-xl font-bold text-primary">71</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Comprehensive tournament analytics
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Performance Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Performance Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
            <div>
              <h4 className="font-medium text-foreground mb-2">Processing Time</h4>
              <ul className="space-y-1">
                <li>• Small tournament: 30-60 seconds</li>
                <li>• Medium tournament: 1-2 minutes</li>
                <li>• Large tournament: 2-5 minutes</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-2">What Gets Updated</h4>
              <ul className="space-y-1">
                <li>• Combat and economic metrics</li>
                <li>• Hero pick/ban analysis</li>
                <li>• Player versatility scores</li>
                <li>• Team coordination metrics</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-2">Safety</h4>
              <ul className="space-y-1">
                <li>• Safe to run multiple times</li>
                <li>• Non-destructive operation</li>
                <li>• Automatic fallback system</li>
                <li>• Results immediately available</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}