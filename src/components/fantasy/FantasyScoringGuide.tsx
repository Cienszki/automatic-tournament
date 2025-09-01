"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Calculator, Target, TrendingUp, Award, Info } from 'lucide-react';

export default function FantasyScoringGuide() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const isExpanded = (section: string) => expandedSections.has(section);

  const performanceTiers = {
    'Carry': { avg: 99.9, elite: 167, excellent: 138, good: [54, 138] },
    'Mid': { avg: 105.8, elite: 178, excellent: 130, good: [68, 130] },
    'Offlane': { avg: 115.4, elite: 184, excellent: 157, good: [70, 157] },
    'Soft Support': { avg: 101.5, elite: 170, excellent: 135, good: [63, 135] },
    'Hard Support': { avg: 92.8, elite: 164, excellent: 126, good: [40, 126] }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center flex items-center justify-center gap-3">
            <Calculator className="text-blue-600" />
            Complete Fantasy Scoring Algorithm
            <Target className="text-purple-600" />
          </CardTitle>
          <p className="text-center text-gray-600 text-lg">
            Calculate any player&apos;s fantasy score with mathematical precision
          </p>
        </CardHeader>
      </Card>

      {/* Quick Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="text-green-600" />
            Role Performance Tiers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(performanceTiers).map(([role, data]) => (
              <div key={role} className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-lg mb-2">{role}</h4>
                <div className="space-y-1 text-sm">
                  <div className="text-gray-600">Average: {data.avg} PPG</div>
                  <div className="text-red-600 font-semibold">🔥 Elite: {data.elite}+ pts</div>
                  <div className="text-orange-600">⭐ Excellent: {data.excellent}+ pts</div>
                  <div className="text-green-600">✅ Good: {data.good[0]}-{data.good[1]} pts</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Universal Base Scoring */}
      <Collapsible open={isExpanded('universal')} onOpenChange={() => toggleSection('universal')}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="hover:bg-gray-50 cursor-pointer transition-colors">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-bold">STEP 1</div>
                  Universal Base Scoring
                </span>
                {isExpanded('universal') ? <ChevronDown /> : <ChevronRight />}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <p className="text-gray-600">These bonuses apply to ALL players regardless of role:</p>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold mb-3">Formula Breakdown:</h4>
                <div className="space-y-2 font-mono text-sm">
                  <div><strong>Team Won:</strong> +5 points</div>
                  <div><strong>First Blood:</strong> +12 points</div>
                  <div><strong>Tower Damage:</strong> Tower Damage ÷ 1000</div>
                  <div><strong>Observer Kills:</strong> Observer Kills × 2.5</div>
                  <div><strong>Sentry Kills:</strong> Sentry Kills × 2.0</div>
                  <div><strong>Courier Kills:</strong> Courier Kills × 10</div>
                  <div><strong>Kill Streaks:</strong> If Streak ≥ 3 → (Streak - 2)^1.2 × 2.5</div>
                  <div><strong>Deaths:</strong> Deaths × (-0.7)</div>
                  <div><strong>Net Worth:</strong> If NW/min &gt; 350 → √(NW/min - 350) ÷ 10</div>
                </div>
              </div>

              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="text-yellow-600" size={20} />
                  <strong>Pro Tip:</strong>
                </div>
                <p className="text-sm">Net Worth efficiency matters more than raw Net Worth. A player with 20k NW in 30 minutes scores better than 25k NW in 50 minutes!</p>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Final Result */}
      <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-bold">STEP 5</div>
            Final Result
            <Award className="text-green-600" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <div className="text-2xl font-bold font-mono mb-2">
              Final Score = round(Points × 100) ÷ 100
            </div>
            <p className="text-gray-600">All scores rounded to exactly 2 decimal places</p>
          </div>
        </CardContent>
      </Card>

      {/* Algorithm Info */}
      <Card className="bg-gray-50 border border-gray-200">
        <CardContent className="text-center py-4">
          <p className="text-sm text-gray-600">
            <strong>Algorithm Version:</strong> Final Optimized Equalized System (August 2025)<br/>
            <strong>Role Balance:</strong> 93-115 PPG spread (24.4% imbalance improvement)<br/>
            <em>All calculations are mathematically exact and match the system implementation</em>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}