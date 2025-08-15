"use client";

import React, { useState, useMemo } from 'react';
import type { PlayoffData, PlayoffMatch, PlayoffBracket } from '@/lib/definitions';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Trophy, 
  Clock, 
  CheckCircle, 
  Play, 
  Users, 
  Calendar,
  Star,
  TrendingUp,
  Crown,
  Zap,
  Search,
  Filter,
  Eye,
  EyeOff,
  ArrowRight
} from "lucide-react";
import { StandinInfoCompact } from './StandinInfoDisplay';
import { cn } from '@/lib/utils';

interface MatchCardProps {
  match: PlayoffMatch;
  showDetails?: boolean;
}

const MatchCard: React.FC<MatchCardProps> = ({ match, showDetails = false }) => {
  const teamA = match.teamA ?? { id: 'unknownA', name: 'TBD', logoUrl: '' };
  const teamB = match.teamB ?? { id: 'unknownB', name: 'TBD', logoUrl: '' };
  const scoreA = match.result?.teamAScore ?? 0;
  const scoreB = match.result?.teamBScore ?? 0;
  const winnerId = match.result?.winnerId;
  
  const getStatusIcon = () => {
    switch (match.status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'live':
        return <Play className="h-4 w-4 text-red-500 animate-pulse" />;
      case 'scheduled':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <Users className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getMatchFormatBadge = () => {
    const formatColors = {
      'bo1': 'bg-blue-100 text-blue-800',
      'bo3': 'bg-green-100 text-green-800', 
      'bo5': 'bg-purple-100 text-purple-800'
    };
    
    return (
      <Badge className={`text-xs ${formatColors[match.format] || 'bg-gray-100 text-gray-800'}`}>
        {match.format.toUpperCase()}
      </Badge>
    );
  };

  return (
    <Card className={cn(
      "transition-all duration-200 hover:shadow-md",
      match.status === 'live' && "ring-2 ring-red-500",
      match.status === 'completed' && winnerId && "bg-green-50"
    )}>
      <CardContent className="p-3 space-y-3">
        {/* Match Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="text-xs font-medium text-muted-foreground">
              Round {match.round} • Position {match.position}
            </span>
          </div>
          {getMatchFormatBadge()}
        </div>

        {/* Teams */}
        <div className="space-y-2">
          <div className={cn(
            "flex items-center justify-between p-2 rounded transition-colors",
            winnerId === teamA.id ? "bg-primary/10 border border-primary/20" : "bg-muted/30"
          )}>
            <div className="flex items-center gap-2">
              {winnerId === teamA.id && <Crown className="h-4 w-4 text-primary" />}
              {teamA.logoUrl && (
                <img src={teamA.logoUrl} alt={teamA.name} className="w-6 h-6 rounded" />
              )}
              <Link 
                href={`/teams/${teamA.id}`} 
                className="font-medium hover:underline"
              >
                {teamA.name}
              </Link>
            </div>
            <span className={cn(
              "font-bold text-lg",
              winnerId === teamA.id ? "text-primary" : "text-muted-foreground"
            )}>
              {match.status === 'completed' ? scoreA : '-'}
            </span>
          </div>

          <div className={cn(
            "flex items-center justify-between p-2 rounded transition-colors",
            winnerId === teamB.id ? "bg-primary/10 border border-primary/20" : "bg-muted/30"
          )}>
            <div className="flex items-center gap-2">
              {winnerId === teamB.id && <Crown className="h-4 w-4 text-primary" />}
              {teamB.logoUrl && (
                <img src={teamB.logoUrl} alt={teamB.name} className="w-6 h-6 rounded" />
              )}
              <Link 
                href={`/teams/${teamB.id}`} 
                className="font-medium hover:underline"
              >
                {teamB.name}
              </Link>
            </div>
            <span className={cn(
              "font-bold text-lg",
              winnerId === teamB.id ? "text-primary" : "text-muted-foreground"
            )}>
              {match.status === 'completed' ? scoreB : '-'}
            </span>
          </div>
        </div>

        {/* Match Status & Time */}
        {match.scheduledFor && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{new Date(match.scheduledFor).toLocaleString()}</span>
          </div>
        )}

        {/* Standin Info */}
        <StandinInfoCompact match={match as any} />

        {/* Additional Details */}
        {showDetails && match.result?.completedAt && (
          <div className="text-xs text-muted-foreground border-t pt-2">
            Completed: {new Date(match.result.completedAt).toLocaleString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface BracketViewProps {
  bracket: PlayoffBracket;
  showDetails?: boolean;
  searchTerm?: string;
  statusFilter?: string;
}

const BracketView: React.FC<BracketViewProps> = ({ bracket, showDetails = false, searchTerm = '', statusFilter = 'all' }) => {
  // Group matches by round and apply filters
  const filteredMatches = useMemo(() => {
    return bracket.matches.filter(match => {
      // Search filter
      const matchesSearch = !searchTerm || 
        match.teamA?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        match.teamB?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        match.id.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Status filter
      const matchesStatus = statusFilter === 'all' || match.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [bracket.matches, searchTerm, statusFilter]);

  const matchesByRound = filteredMatches.reduce((acc, match) => {
    const round = match.round;
    if (!acc[round]) acc[round] = [];
    acc[round].push(match);
    return acc;
  }, {} as Record<number, PlayoffMatch[]>);

  const rounds = Object.keys(matchesByRound).map(Number).sort((a, b) => a - b);

  const getBracketIcon = () => {
    switch (bracket.type) {
      case 'upper':
        return <TrendingUp className="h-5 w-5 text-green-500" />;
      case 'lower':
        return <Zap className="h-5 w-5 text-orange-500" />;
      case 'final':
        return <Crown className="h-5 w-5 text-yellow-500" />;
      case 'wildcard':
        return <Star className="h-5 w-5 text-blue-500" />;
      default:
        return <Trophy className="h-5 w-5 text-primary" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getBracketIcon()}
          {bracket.name}
          <Badge variant={bracket.isActive ? "default" : "secondary"}>
            {bracket.isActive ? "Active" : "Inactive"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rounds.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No matches found matching your criteria</p>
          </div>
        ) : (
          <div className="space-y-6">
            {rounds.map(round => (
              <div key={round} className="space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  Round {round}
                  <Badge variant="outline" className="text-xs">
                    {matchesByRound[round].length} matches
                  </Badge>
                </h4>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {matchesByRound[round].map(match => (
                    <MatchCard 
                      key={match.id} 
                      match={match} 
                      showDetails={showDetails}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const PlayoffBracketDisplay: React.FC<{ bracketData: PlayoffData }> = ({ bracketData }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  if (!bracketData || !Array.isArray(bracketData.brackets) || bracketData.brackets.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Trophy className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Playoff Brackets</h3>
          <p className="text-sm text-muted-foreground">
            The playoff brackets have not been set up yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Sort brackets by type for consistent display order
  const sortedBrackets = [...bracketData.brackets].sort((a, b) => {
    const typeOrder = { 'upper': 0, 'lower': 1, 'wildcard': 2, 'final': 3 };
    return (typeOrder[a.type] || 999) - (typeOrder[b.type] || 999);
  });

  // Calculate some statistics
  const totalMatches = bracketData.brackets.reduce((sum, bracket) => sum + bracket.matches.length, 0);
  const completedMatches = bracketData.brackets.reduce((sum, bracket) => 
    sum + bracket.matches.filter(m => m.status === 'completed').length, 0
  );
  const liveMatches = bracketData.brackets.reduce((sum, bracket) => 
    sum + bracket.matches.filter(m => m.status === 'live').length, 0
  );

  return (
    <div className="space-y-6">
      {/* Tournament Header */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Trophy className="h-6 w-6 text-primary" />
              <div>
                <h2 className="text-xl font-bold">{bracketData.name}</h2>
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  <span>{bracketData.brackets.length} brackets</span>
                  <span>•</span>
                  <span>{totalMatches} matches</span>
                  <span>•</span>
                  <span>{completedMatches} completed</span>
                  {liveMatches > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-red-500 font-medium">{liveMatches} live</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-2"
              >
                {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showDetails ? 'Hide Details' : 'Show Details'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search teams or matches..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
                className="flex items-center gap-1"
              >
                <Filter className="h-3 w-3" />
                All
              </Button>
              <Button
                variant={statusFilter === 'live' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('live')}
                className="flex items-center gap-1"
              >
                <Play className="h-3 w-3" />
                Live
              </Button>
              <Button
                variant={statusFilter === 'completed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('completed')}
                className="flex items-center gap-1"
              >
                <CheckCircle className="h-3 w-3" />
                Done
              </Button>
              <Button
                variant={statusFilter === 'scheduled' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('scheduled')}
                className="flex items-center gap-1"
              >
                <Clock className="h-3 w-3" />
                Upcoming
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bracket Tabs */}
      <Tabs defaultValue={sortedBrackets[0]?.id} className="w-full">
        <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${sortedBrackets.length}, 1fr)` }}>
          {sortedBrackets.map(bracket => (
            <TabsTrigger 
              key={bracket.id} 
              value={bracket.id}
              className="flex items-center gap-2"
            >
              {bracket.type === 'upper' && <TrendingUp className="h-4 w-4" />}
              {bracket.type === 'lower' && <Zap className="h-4 w-4" />}
              {bracket.type === 'final' && <Crown className="h-4 w-4" />}
              {bracket.type === 'wildcard' && <Star className="h-4 w-4" />}
              <span className="hidden sm:inline">{bracket.name}</span>
              <span className="sm:hidden">{bracket.type.charAt(0).toUpperCase()}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {sortedBrackets.map(bracket => (
          <TabsContent key={bracket.id} value={bracket.id}>
            <BracketView 
              bracket={bracket} 
              showDetails={showDetails}
              searchTerm={searchTerm}
              statusFilter={statusFilter}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default PlayoffBracketDisplay;

