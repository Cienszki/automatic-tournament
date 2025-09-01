"use client";

import React from 'react';
import { Crown, Trophy, Star, Target, Zap, Medal } from 'lucide-react';

export default function EnhancedLoadingScreen() {
  const icons = [Crown, Trophy, Star, Target, Zap, Medal];
  
  return (
    <div className="relative w-full h-[700px] lg:h-[800px] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 rounded-2xl flex items-center justify-center border border-primary/20 shadow-2xl overflow-hidden">
      {/* Background Animation */}
      <div className="absolute inset-0">
        {/* Floating orbs */}
        <div className="absolute top-20 left-20 w-32 h-32 bg-primary/10 rounded-full animate-pulse"></div>
        <div className="absolute bottom-32 right-24 w-24 h-24 bg-blue-500/10 rounded-full animate-bounce delay-500"></div>
        <div className="absolute top-1/2 left-8 w-16 h-16 bg-purple-500/10 rounded-full animate-ping delay-1000"></div>
        <div className="absolute top-16 right-16 w-20 h-20 bg-cyan-500/10 rounded-full animate-pulse delay-700"></div>
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-blue-500/5"></div>
      </div>

      {/* Main Content */}
      <div className="relative text-center space-y-8 z-10">
        {/* Spinning loader with pulsing ring */}
        <div className="relative">
          <div className="animate-spin rounded-full h-20 w-20 border-4 border-primary/30 border-t-primary mx-auto"></div>
          <div className="absolute inset-0 animate-ping rounded-full h-20 w-20 border-2 border-primary/20 mx-auto"></div>
          <div className="absolute inset-2 animate-pulse rounded-full h-16 w-16 bg-primary/10 mx-auto"></div>
        </div>

        {/* Floating icons */}
        <div className="relative h-16">
          {icons.map((Icon, index) => (
            <Icon
              key={index}
              className={`absolute h-8 w-8 text-primary/60 animate-bounce`}
              style={{
                left: `${20 + index * 12}%`,
                top: `${10 + (index % 2) * 20}px`,
                animationDelay: `${index * 200}ms`,
                animationDuration: '2s'
              }}
            />
          ))}
        </div>

        {/* Text content */}
        <div className="space-y-3">
          <h2 className="text-primary text-2xl font-bold bg-gradient-to-r from-primary via-blue-400 to-primary bg-clip-text text-transparent">
            Loading Fantasy Arena...
          </h2>
          <p className="text-slate-400 text-lg">Preparing your 3D experience</p>
          <div className="text-sm text-slate-500 space-y-1">
            <div className="animate-pulse">⚡ Initializing 3D environment...</div>
            <div className="animate-pulse delay-300">🏆 Loading leaderboard data...</div>
            <div className="animate-pulse delay-600">🎮 Preparing interactive controls...</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-64 mx-auto">
          <div className="bg-slate-800 rounded-full h-2 overflow-hidden">
            <div className="bg-gradient-to-r from-primary to-blue-500 h-full rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  );
}