"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, RotateCcw } from 'lucide-react';

interface PlayerStats {
  role: string;
  kills: number;
  deaths: number;
  assists: number;
  duration: number;
  gpm: number;
  xpm: number;
  lastHits: number;
  denies: number;
  netWorth: number;
  heroDamage: number;
  towerDamage: number;
  heroHealing: number;
  obsPlaced: number;
  senPlaced: number;
  courierKills: number;
  observerKills: number;
  sentryKills: number;
  teamWon: boolean;
  firstBlood: boolean;
}

const FantasyScoreCalculator = () => {
  const [stats, setStats] = useState<PlayerStats>({
    role: 'Mid',
    kills: 10,
    deaths: 3,
    assists: 8,
    duration: 40,
    gpm: 500,
    xpm: 600,
    lastHits: 200,
    denies: 10,
    netWorth: 20000,
    heroDamage: 25000,
    towerDamage: 3000,
    heroHealing: 5000,
    obsPlaced: 5,
    senPlaced: 3,
    courierKills: 0,
    observerKills: 2,
    sentryKills: 1,
    teamWon: true,
    firstBlood: false
  });

  const [calculatedScore, setCalculatedScore] = useState<number>(0);
  const [breakdown, setBreakdown] = useState<Array<{step: string, points: number, description: string}>>([]);

  const calculateFantasyScore = () => {
    let points = 0;
    const newBreakdown: Array<{step: string, points: number, description: string}> = [];
    const gameDurationMinutes = stats.duration;

    // Step 1: Universal Base Scoring
    let stepPoints = 0;
    if (stats.teamWon) {
      stepPoints += 5;
      newBreakdown.push({step: "Universal", points: 5, description: "Team Won"});
    }
    if (stats.firstBlood) {
      stepPoints += 12;
      newBreakdown.push({step: "Universal", points: 12, description: "First Blood"});
    }
    
    const towerPoints = stats.towerDamage / 1000;
    stepPoints += towerPoints;
    newBreakdown.push({step: "Universal", points: towerPoints, description: `Tower Damage: ${stats.towerDamage}`});
    
    const observerPoints = stats.observerKills * 2.5;
    stepPoints += observerPoints;
    newBreakdown.push({step: "Universal", points: observerPoints, description: `Observer Kills: ${stats.observerKills}`});
    
    const courierPoints = stats.courierKills * 10;
    stepPoints += courierPoints;
    newBreakdown.push({step: "Universal", points: courierPoints, description: `Courier Kills: ${stats.courierKills}`});
    
    const sentryPoints = stats.sentryKills * 2;
    stepPoints += sentryPoints;
    newBreakdown.push({step: "Universal", points: sentryPoints, description: `Sentry Kills: ${stats.sentryKills}`});
    
    // Kill streaks (estimate)
    const estimatedStreak = Math.floor(stats.kills / 3);
    if (estimatedStreak >= 3) {
      const streakPoints = Math.pow(estimatedStreak - 2, 1.2) * 2.5;
      stepPoints += streakPoints;
      newBreakdown.push({step: "Universal", points: streakPoints, description: `Kill Streak: ${estimatedStreak}`});
    }
    
    const deathPenalty = stats.deaths * -0.7;
    stepPoints += deathPenalty;
    newBreakdown.push({step: "Universal", points: deathPenalty, description: `Death Penalty: ${stats.deaths} deaths`});
    
    const netWorthPerMin = stats.netWorth / gameDurationMinutes;
    if (netWorthPerMin > 350) {
      const netWorthBonus = Math.sqrt(netWorthPerMin - 350) / 10;
      stepPoints += netWorthBonus;
      newBreakdown.push({step: "Universal", points: netWorthBonus, description: `Net Worth Efficiency: ${netWorthPerMin.toFixed(0)}/min`});
    }
    
    points += stepPoints;

    // Step 2: Role-specific scoring
    let rolePoints = 0;
    
    if (stats.role === 'Mid') {
      const killPoints = stats.kills * 3.8;
      rolePoints += killPoints;
      newBreakdown.push({step: "Role", points: killPoints, description: `Mid Kills: ${stats.kills} × 3.8`});
      
      const assistPoints = stats.assists * 2.0;
      rolePoints += assistPoints;
      newBreakdown.push({step: "Role", points: assistPoints, description: `Mid Assists: ${stats.assists} × 2.0`});
      
      const xpmBonus = Math.max(stats.xpm - 400, 0) / 40;
      rolePoints += xpmBonus;
      newBreakdown.push({step: "Role", points: xpmBonus, description: `XPM Bonus: ${stats.xpm}`});
      
      const heroDamagePerMin = stats.heroDamage / gameDurationMinutes;
      const heroDamagePoints = heroDamagePerMin / 100;
      rolePoints += heroDamagePoints;
      newBreakdown.push({step: "Role", points: heroDamagePoints, description: `Hero Damage: ${heroDamagePerMin.toFixed(0)}/min`});
      
      if (stats.gpm > 480) {
        const gpmBonus = (stats.gpm - 480) / 50;
        rolePoints += gpmBonus;
        newBreakdown.push({step: "Role", points: gpmBonus, description: `GPM Bonus: ${stats.gpm}`});
      }
      
      if (stats.kills >= 7 && stats.assists < stats.kills) {
        rolePoints += 12;
        newBreakdown.push({step: "Role", points: 12, description: "Solo Dominance"});
      }
      
      if (stats.xpm > 600) {
        const xpLeadership = Math.sqrt(stats.xpm - 600) / 12;
        rolePoints += xpLeadership;
        newBreakdown.push({step: "Role", points: xpLeadership, description: `XP Leadership: ${stats.xpm}`});
      }
      
      if (stats.kills >= 10 || heroDamagePerMin > 600) {
        rolePoints += 8;
        newBreakdown.push({step: "Role", points: 8, description: "High Impact Bonus"});
      }
      
      if (stats.lastHits >= gameDurationMinutes * 6) {
        const farmingBonus = (stats.lastHits - gameDurationMinutes * 6) / 15;
        rolePoints += farmingBonus;
        newBreakdown.push({step: "Role", points: farmingBonus, description: `Farming Mid Bonus: ${stats.lastHits} LH`});
      }
      
    } else if (stats.role === 'Carry') {
      const killPoints = stats.kills * 2.5;
      rolePoints += killPoints;
      newBreakdown.push({step: "Role", points: killPoints, description: `Carry Kills: ${stats.kills} × 2.5`});
      
      const assistPoints = stats.assists * 1.3;
      rolePoints += assistPoints;
      newBreakdown.push({step: "Role", points: assistPoints, description: `Carry Assists: ${stats.assists} × 1.3`});
      
      const farmEfficiency = Math.max((stats.gpm - 300) / 40, 0);
      rolePoints += farmEfficiency;
      newBreakdown.push({step: "Role", points: farmEfficiency, description: `Farm Efficiency: ${stats.gpm} GPM`});
      
      const lhBonus = stats.lastHits / gameDurationMinutes / 5.5;
      rolePoints += lhBonus;
      newBreakdown.push({step: "Role", points: lhBonus, description: `Last Hit Bonus: ${stats.lastHits}`});
      
      const denyBonus = stats.denies / 3.5;
      rolePoints += denyBonus;
      newBreakdown.push({step: "Role", points: denyBonus, description: `Deny Bonus: ${stats.denies}`});
      
      if (stats.netWorth > 15000) {
        const nwBonus = Math.sqrt(stats.netWorth - 15000) / 110;
        rolePoints += nwBonus;
        newBreakdown.push({step: "Role", points: nwBonus, description: `Net Worth Excellence: ${stats.netWorth}`});
      }
      
      if (gameDurationMinutes > 38) {
        const lateGameMultiplier = 1 + (gameDurationMinutes - 38) / 140;
        rolePoints *= lateGameMultiplier;
        newBreakdown.push({step: "Role", points: rolePoints * (lateGameMultiplier - 1), description: `Late Game Scaling: ${gameDurationMinutes}min`});
      }
    }
    // Add other roles as needed...
    
    points += rolePoints;

    // Step 3: Duration Normalization
    const durationMultiplier = Math.min(gameDurationMinutes / 40, 1.25);
    const preNormalization = points;
    points = points / durationMultiplier;
    newBreakdown.push({step: "Duration", points: points - preNormalization, description: `Normalization: ${durationMultiplier.toFixed(3)}x`});

    // Step 4: Excellence Bonuses
    const kda = stats.deaths > 0 ? (stats.kills + stats.assists) / stats.deaths : (stats.kills + stats.assists);
    if (kda >= 6) {
      const kdaBonus = Math.pow(kda - 6, 0.7) * 2;
      points += kdaBonus;
      newBreakdown.push({step: "Excellence", points: kdaBonus, description: `KDA Excellence: ${kda.toFixed(2)}`});
    }

    // Multi-stat excellence
    let excellenceCount = 0;
    let excellenceBonus = 0;
    
    if (stats.kills >= 12) { 
      excellenceCount++; 
      const bonus = (stats.kills - 12) * 0.8;
      excellenceBonus += bonus;
      newBreakdown.push({step: "Excellence", points: bonus, description: `Kills Excellence: ${stats.kills}`});
    }
    if (stats.assists >= 18) { 
      excellenceCount++; 
      const bonus = (stats.assists - 18) * 0.3;
      excellenceBonus += bonus;
      newBreakdown.push({step: "Excellence", points: bonus, description: `Assists Excellence: ${stats.assists}`});
    }
    if (stats.gpm >= 600) { 
      excellenceCount++; 
      const bonus = (stats.gpm - 600) / 80;
      excellenceBonus += bonus;
      newBreakdown.push({step: "Excellence", points: bonus, description: `GPM Excellence: ${stats.gpm}`});
    }
    if (stats.heroDamage >= gameDurationMinutes * 500) { 
      excellenceCount++; 
      excellenceBonus += 4;
      newBreakdown.push({step: "Excellence", points: 4, description: `Hero Damage Excellence`});
    }
    if (stats.lastHits >= gameDurationMinutes * 7) { 
      excellenceCount++; 
      excellenceBonus += 2;
      newBreakdown.push({step: "Excellence", points: 2, description: `Last Hit Excellence`});
    }
    if ((stats.obsPlaced + stats.senPlaced) >= 15) { 
      excellenceCount++; 
      excellenceBonus += 3;
      newBreakdown.push({step: "Excellence", points: 3, description: `Ward Excellence`});
    }
    
    if (excellenceCount >= 3) {
      const multiBonus = excellenceCount * 3;
      points += excellenceBonus + multiBonus;
      newBreakdown.push({step: "Excellence", points: multiBonus, description: `Multi-Excellence Bonus: ${excellenceCount} categories`});
    }
    
    if (stats.deaths === 0 && stats.kills >= 5 && stats.assists >= 10) {
      points += 15;
      newBreakdown.push({step: "Excellence", points: 15, description: "Perfect Game Bonus"});
    }

    // Final rounding
    const finalScore = Math.round(points * 100) / 100;
    setCalculatedScore(finalScore);
    setBreakdown(newBreakdown);
  };

  const resetForm = () => {
    setStats({
      role: 'Mid',
      kills: 10,
      deaths: 3,
      assists: 8,
      duration: 40,
      gpm: 500,
      xpm: 600,
      lastHits: 200,
      denies: 10,
      netWorth: 20000,
      heroDamage: 25000,
      towerDamage: 3000,
      heroHealing: 5000,
      obsPlaced: 5,
      senPlaced: 3,
      courierKills: 0,
      observerKills: 2,
      sentryKills: 1,
      teamWon: true,
      firstBlood: false
    });
    setCalculatedScore(0);
    setBreakdown([]);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="text-blue-600" />
            Fantasy Score Calculator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Form */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select value={stats.role} onValueChange={(value) => setStats({...stats, role: value})}>
                    <SelectTrigger>
                      <SelectValue />
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
                <div>
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input 
                    id="duration"
                    type="number" 
                    value={stats.duration} 
                    onChange={(e) => setStats({...stats, duration: Number(e.target.value)})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="kills">Kills</Label>
                  <Input 
                    id="kills"
                    type="number" 
                    value={stats.kills} 
                    onChange={(e) => setStats({...stats, kills: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <Label htmlFor="deaths">Deaths</Label>
                  <Input 
                    id="deaths"
                    type="number" 
                    value={stats.deaths} 
                    onChange={(e) => setStats({...stats, deaths: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <Label htmlFor="assists">Assists</Label>
                  <Input 
                    id="assists"
                    type="number" 
                    value={stats.assists} 
                    onChange={(e) => setStats({...stats, assists: Number(e.target.value)})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="gpm">GPM</Label>
                  <Input 
                    id="gpm"
                    type="number" 
                    value={stats.gpm} 
                    onChange={(e) => setStats({...stats, gpm: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <Label htmlFor="xpm">XPM</Label>
                  <Input 
                    id="xpm"
                    type="number" 
                    value={stats.xpm} 
                    onChange={(e) => setStats({...stats, xpm: Number(e.target.value)})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="lastHits">Last Hits</Label>
                  <Input 
                    id="lastHits"
                    type="number" 
                    value={stats.lastHits} 
                    onChange={(e) => setStats({...stats, lastHits: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <Label htmlFor="netWorth">Net Worth</Label>
                  <Input 
                    id="netWorth"
                    type="number" 
                    value={stats.netWorth} 
                    onChange={(e) => setStats({...stats, netWorth: Number(e.target.value)})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="heroDamage">Hero Damage</Label>
                  <Input 
                    id="heroDamage"
                    type="number" 
                    value={stats.heroDamage} 
                    onChange={(e) => setStats({...stats, heroDamage: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <Label htmlFor="towerDamage">Tower Damage</Label>
                  <Input 
                    id="towerDamage"
                    type="number" 
                    value={stats.towerDamage} 
                    onChange={(e) => setStats({...stats, towerDamage: Number(e.target.value)})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <input 
                    id="teamWon"
                    type="checkbox" 
                    checked={stats.teamWon}
                    onChange={(e) => setStats({...stats, teamWon: e.target.checked})}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="teamWon">Team Won</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input 
                    id="firstBlood"
                    type="checkbox" 
                    checked={stats.firstBlood}
                    onChange={(e) => setStats({...stats, firstBlood: e.target.checked})}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="firstBlood">First Blood</Label>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={calculateFantasyScore} className="flex-1">
                  <Calculator className="mr-2 h-4 w-4" />
                  Calculate Score
                </Button>
                <Button onClick={resetForm} variant="outline">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
              </div>
            </div>

            {/* Results */}
            <div className="space-y-4">
              {calculatedScore > 0 && (
                <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200">
                  <CardHeader>
                    <CardTitle className="text-center">
                      Fantasy Score: <span className="text-3xl font-bold text-green-600">{calculatedScore.toFixed(2)}</span>
                    </CardTitle>
                  </CardHeader>
                </Card>
              )}

              {breakdown.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Score Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {breakdown.map((item, index) => (
                        <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100">
                          <div>
                            <span className="text-sm font-medium text-gray-600">{item.step}</span>
                            <div className="text-sm text-gray-500">{item.description}</div>
                          </div>
                          <div className={`font-mono font-semibold ${item.points >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {item.points >= 0 ? '+' : ''}{item.points.toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FantasyScoreCalculator;