"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  UserCircle, 
  Lock, 
  Info, 
  Trophy, 
  Clock,
  Target,
  Users,
  BookOpen,
  Calculator,
  Award,
  TrendingUp,
  Swords,
  Zap
} from "lucide-react";
import CreativeLeaderboards from '@/components/fantasy/CreativeLeaderboards';

// Mock data that simulates the real API structure
const mockLeaderboards = {
  overall: [
    {
      userId: "28vD5PHBQCMefj1gbWrX1R8kBjM2",
      displayName: "Valais",
      averageScore: 95.24,
      gamesPlayed: 18,
      rank: 1,
      currentLineup: {
        "Carry": { id: "1", nickname: "Valais", role: "Carry" },
        "Mid": { id: "2", nickname: "Gandalf1k", role: "Mid" }
      }
    },
    {
      userId: "CTRKrFfa37MuLQymMNEv9r4kVUh2",
      displayName: ".joxxi",
      averageScore: 93.17,
      gamesPlayed: 25,
      rank: 2,
      currentLineup: {}
    },
    {
      userId: "1uTIoCrW2vaa0rMy04MR55Pt3GA2",
      displayName: "BeBoy", 
      averageScore: 92.97,
      gamesPlayed: 30,
      rank: 3,
      currentLineup: {}
    },
    {
      userId: "ECWWYGZeAuRh4nyD8zcNh2NFX2r2",
      displayName: "AaDeHaDe",
      averageScore: 92.97,
      gamesPlayed: 30,
      rank: 4,
      currentLineup: {}
    },
    {
      userId: "vqqEyhJ9U7ZMESuFm4RelmByIhm2",
      displayName: "Pocieszny",
      averageScore: 92.97,
      gamesPlayed: 30,
      rank: 5,
      currentLineup: {}
    }
  ],
  byRole: {
    'Carry': [
      { playerId: "oXYYBpa30uErWzrnzdAk", nickname: "Valais", teamName: "Pora na Przygode", averageScore: 120.5, totalMatches: 10, rank: 1 },
      { playerId: "HsMv06e5VSBpzpkBsNQd", nickname: "Juxi1337", teamName: "CINCO PERROS", averageScore: 115.2, totalMatches: 12, rank: 2 }
    ],
    'Mid': [
      { playerId: "UTsAbjuxuaPuQbzkAZND", nickname: "Gandalf1k", teamName: "Psychiatryk", averageScore: 125.3, totalMatches: 8, rank: 1 },
      { playerId: "7sXBiIbXSl5ijRV0weub", nickname: "Joxxi", teamName: "CINCO PERROS", averageScore: 118.7, totalMatches: 11, rank: 2 }
    ],
    'Offlane': [
      { playerId: "ak4dmw4VEYK0zCY1O2Zo", nickname: "Budda-", teamName: "Pora na Przygode", averageScore: 108.9, totalMatches: 9, rank: 1 }
    ],
    'Soft Support': [
      { playerId: "zkw87djJSxaAqf4Pu3Yr", nickname: "AaDeHaDe", teamName: "Jest Letko", averageScore: 85.3, totalMatches: 18, rank: 1 }
    ],
    'Hard Support': [
      { playerId: "73vueKAfZLRv0zeXYjAE", nickname: "Be Boy", teamName: "Jest Letko", averageScore: 75.8, totalMatches: 22, rank: 1 }
    ]
  }
};

const mockPlayers = [
  { id: "1", nickname: "Valais", role: "Carry", mmr: 4167, teamName: "Pora na Przygode" },
  { id: "2", nickname: "Gandalf1k", role: "Mid", mmr: 9500, teamName: "Psychiatryk" },
  { id: "3", nickname: "Budda-", role: "Offlane", mmr: 5338, teamName: "Pora na Przygode" },
  { id: "4", nickname: "AaDeHaDe", role: "Soft Support", mmr: 3891, teamName: "Jest Letko" },
  { id: "5", nickname: "Be Boy", role: "Hard Support", mmr: 3856, teamName: "Jest Letko" },
];

const TEAM_MMR_CAP = 25000;

export default function FantasyPage() {
  const [leaderboards, setLeaderboards] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentBudgetUsed = 0;

  useEffect(() => {
    const fetchLeaderboards = async () => {
      try {
        console.log('🚀 Starting leaderboard fetch...');
        setLoading(true);
        const response = await fetch('/api/fantasy/leaderboards');
        console.log('📡 Response received:', response.status, response.ok);
        const data = await response.json();
        console.log('📊 Data received:', data.success, 'Keys:', Object.keys(data));
        
        if (data.success) {
          console.log('✅ Setting leaderboards data - FIXED ALGORITHM');
          console.log('📊 Algorithm:', data.algorithm);
          console.log('📅 Generated at:', data.generatedAt);
          setLeaderboards(data.leaderboards);
        } else {
          console.log('❌ API returned error:', data.message);
          setError(data.message || 'Failed to load leaderboards. Please run fixed fantasy recalculation first.');
          setLeaderboards(null);
        }
      } catch (err) {
        console.error('💥 Error fetching leaderboards:', err);
        setError('Network error: Failed to load leaderboards');
        setLeaderboards(null);
      } finally {
        console.log('🏁 Setting loading to false');
        setLoading(false);
      }
    };

    fetchLeaderboards();
  }, []);

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <Card className="hidden md:flex shadow-xl text-center relative overflow-hidden h-[320px] fhd:h-[320px] 2k:h-[500px] flex-col justify-center p-6">
        <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: `url(/backgrounds/fantasy.png)` }} />
      </Card>

      <Card className="flex md:hidden shadow-xl text-center relative overflow-hidden h-[120px] flex-col justify-center items-center p-4 bg-black">
        <span className="text-3xl font-extrabold text-[#39ff14] drop-shadow-[0_0_8px_#39ff14] font-neon-bines">
          Fantasy League
        </span>
      </Card>

      {/* Round Status Bar */}
      <Card className="shadow-lg border-primary/20">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Current Round:</span>
                <Badge variant="secondary" className="text-base">Group Stage</Badge>
              </div>
              
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <span className="text-sm text-muted-foreground">Selecting for:</span>
                <Badge variant="default" className="text-base">Playoffs</Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-lg font-bold text-primary">87.3</div>
                <div className="text-xs text-muted-foreground">Your Avg PPG</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold">12</div>
                <div className="text-xs text-muted-foreground">Games Played</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* How to Play Section */}
      <Card className="shadow-lg border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            How to Play Fantasy League
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Team Building
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Select one player for each role (Carry, Mid, Offlane, Soft Support, Hard Support)</li>
                <li>• Your total team MMR cannot exceed 25,000</li>
                <li>• Choose wisely - higher MMR players cost more but may score more points</li>
                <li>• You can change your lineup before each round starts</li>
              </ul>
            </div>
            
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Scoring System
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• <strong>Balanced Algorithm:</strong> All roles now competitive (93-115 PPG range)</li>
                <li>• <strong>Role-Specific:</strong> Mid/Offlane buffed, Hard Support healing nerfed</li>
                <li>• <strong>Excellence Bonuses:</strong> Multi-stat performances get massive rewards</li>
                <li>• <strong>Duration Normalized:</strong> Fair scoring regardless of game length</li>
              </ul>
              <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded">
                <div className="text-xs text-blue-800">
                  🎯 <strong>New balanced algorithm active!</strong> All roles competitive in fantasy league
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Player Selection Section */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Build Your Team
          </CardTitle>
          <CardDescription>
            Select one player for each role. Total MMR cannot exceed 25,000.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Budget Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <Label>MMR Budget Used</Label>
              <span className="font-mono">
                0 / 25,000
              </span>
            </div>
            <Progress 
              value={0} 
              className="h-3"
            />
            <div className="text-xs text-muted-foreground">
              Remaining: 25,000 MMR
            </div>
          </div>

          {/* Role Selection Grid */}
          <div className="grid lg:grid-cols-5 md:grid-cols-3 gap-4">
            {["Carry", "Mid", "Offlane", "Soft Support", "Hard Support"].map((role) => (
              <Card key={role} className="border-2 border-dashed border-muted">
                <CardContent className="p-4 text-center">
                  <div className="text-sm font-medium mb-2">{role}</div>
                  <div className="text-xs text-muted-foreground mb-3">
                    Select a {role.toLowerCase()}
                  </div>
                  <Button variant="outline" size="sm">
                    Choose Player
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center">
            <Button size="lg" className="w-full md:w-auto" disabled>
              <Lock className="h-4 w-4 mr-2" />
              Save Lineup (Complete team first)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Fantasy Leaderboards */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary/30 border-t-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading leaderboards...</p>
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-destructive mb-4">⚠️ {error}</p>
          <p className="text-muted-foreground text-sm">Showing fallback data</p>
        </div>
      ) : null}
      
      {leaderboards && (
        <CreativeLeaderboards leaderboards={leaderboards} />
      )}
      
      {!leaderboards && !loading && (
        <Card className="shadow-lg">
          <CardContent className="p-8 text-center">
            <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Leaderboards Not Available</h3>
            <p className="text-muted-foreground mb-4">
              {error || 'Fantasy leaderboards are not ready yet.'}
            </p>
            <p className="text-sm text-muted-foreground">
              Please contact an administrator to run the fixed fantasy recalculation.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Quick Algorithm Overview */}
      <Card className="shadow-lg border-l-4 border-l-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Algorithm Quick Overview
          </CardTitle>
          <CardDescription>
            High-level summary of the new balanced fantasy scoring system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-semibold text-green-800 mb-2">🚀 Role Buffs</h4>
              <ul className="text-sm text-green-700 space-y-1">
                <li>• Mid: 3.8× kills (major buff!)</li>
                <li>• Offlane: 3.0× kills, 2.8× assists</li>
                <li>• Enhanced teamfight bonuses</li>
              </ul>
            </div>
            
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-2">⚖️ Balance Changes</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• All roles: 93-115 PPG range</li>
                <li>• Hard Support healing nerfed</li>
                <li>• Duration normalization refined</li>
              </ul>
            </div>
            
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <h4 className="font-semibold text-purple-800 mb-2">🌟 Excellence System</h4>
              <ul className="text-sm text-purple-700 space-y-1">
                <li>• Multi-stat bonuses (3+ = huge!)</li>
                <li>• Perfect game rewards (+15)</li>
                <li>• Uncapped skill scaling</li>
              </ul>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-300 rounded-lg p-4">
            <div className="flex items-center justify-center">
              <div className="text-center">
                <h4 className="font-semibold text-yellow-800">New Balanced Algorithm Active!</h4>
                <p className="text-sm text-yellow-700">All roles now competitive with 93-115 PPG range</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}