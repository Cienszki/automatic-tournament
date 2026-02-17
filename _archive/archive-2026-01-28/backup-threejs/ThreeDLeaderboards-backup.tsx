"use client";

import React, { useRef, useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber';
import { Text, OrbitControls } from '@react-three/drei';
// import { motion } from 'framer-motion'; // Not available
import * as THREE from 'three';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Crown, Trophy, Medal, Award, Star, Target } from "lucide-react";
import type { PlayerRole } from "@/lib/definitions";
import { cn } from "@/lib/utils";

interface LeaderboardData {
  overall: Array<{
    userId: string;
    displayName: string;
    averageScore: number;
    gamesPlayed: number;
    rank: number;
  }>;
  byRole: {
    [K in PlayerRole]: Array<{
      playerId: string;
      nickname: string;
      teamName: string;
      averageScore: number;
      totalMatches: number;
      rank: number;
    }>;
  };
}

interface LeaderboardPanelProps {
  position: [number, number, number];
  rotation: [number, number, number];
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  data: any[];
  isActive: boolean;
  onClick?: () => void;
}

// 3D Leaderboard Panel Component
function LeaderboardPanel({ position, rotation, title, icon: Icon, data, isActive, onClick }: LeaderboardPanelProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  
  useFrame((state) => {
    if (meshRef.current) {
      // Subtle floating animation
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime + position[0]) * 0.1;
      
      // Scale effect for active panel
      const targetScale = isActive ? 1.1 : 0.9;
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.05);
      
      // Opacity effect
      if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
        meshRef.current.material.opacity = isActive ? 1.0 : 0.7;
      }
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={rotation}
      onClick={onClick}
    >
      {/* Panel Background */}
      <planeGeometry args={[4, 5, 1]} />
      <meshStandardMaterial
        color={isActive ? "#3b82f6" : "#1e293b"}
        transparent
        opacity={isActive ? 1.0 : 0.7}
        side={THREE.DoubleSide}
      />
      
      {/* Title */}
      <Text
        position={[0, 2, 0.01]}
        fontSize={0.3}
        color={isActive ? "#ffffff" : "#94a3b8"}
        anchorX="center"
        anchorY="middle"
        font="/fonts/inter-bold.woff"
      >
        {title}
      </Text>
      
      {/* Top 8 entries (fit better in 3D space) */}
      {data.slice(0, 8).map((entry, index) => (
        <group key={entry.userId || entry.playerId || index} position={[0, 1.5 - index * 0.6, 0.01]}>
          {/* Rank */}
          <Text
            position={[-1.5, 0, 0]}
            fontSize={0.2}
            color={isActive ? "#fbbf24" : "#6b7280"}
            anchorX="center"
            anchorY="middle"
          >
            {index + 1}.
          </Text>
          
          {/* Name */}
          <Text
            position={[-0.5, 0, 0]}
            fontSize={0.15}
            color={isActive ? "#ffffff" : "#9ca3af"}
            anchorX="left"
            anchorY="middle"
            maxWidth={2}
          >
            {('displayName' in entry ? entry.displayName : 'nickname' in entry ? entry.nickname : 'Unknown') || 'Unknown'}
          </Text>
          
          {/* Score */}
          <Text
            position={[1.5, 0, 0]}
            fontSize={0.15}
            color={isActive ? "#10b981" : "#6b7280"}
            anchorX="center"
            anchorY="middle"
          >
            {entry.averageScore?.toFixed(1) || '0.0'}
          </Text>
        </group>
      ))}
    </mesh>
  );
}

// 3D Scene Component
function Scene({ leaderboards, activePanel, onPanelClick }: {
  leaderboards: LeaderboardData;
  activePanel: number;
  onPanelClick: (index: number) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  
  // Define the 6 panels (Overall + 5 roles)
  const panels = useMemo(() => {
    const roleOrder: (PlayerRole)[] = ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'];
    const icons = [Trophy, Crown, Target, Medal, Award, Star];
    
    return [
      {
        title: "Overall Leaders",
        data: leaderboards.overall || [],
        icon: Trophy
      },
      ...roleOrder.map((role, index) => ({
        title: `${role} Leaders`,
        data: leaderboards.byRole?.[role] || [],
        icon: icons[index + 1]
      }))
    ];
  }, [leaderboards]);

  // Calculate positions in a circle
  const radius = 6;
  const panelPositions = useMemo(() => {
    return panels.map((_, index) => {
      const angle = (index / 6) * Math.PI * 2;
      return [
        Math.sin(angle) * radius,
        0,
        Math.cos(angle) * radius
      ] as [number, number, number];
    });
  }, [panels.length]);

  // Rotate the group to show active panel in front
  useFrame(() => {
    if (groupRef.current) {
      const targetRotation = -(activePanel / 6) * Math.PI * 2;
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        targetRotation,
        0.05
      );
    }
  });

  return (
    <group ref={groupRef}>
      {/* Ambient lighting */}
      <ambientLight intensity={0.4} />
      
      {/* Directional light */}
      <directionalLight position={[10, 10, 5]} intensity={1} />
      
      {/* Point light for depth */}
      <pointLight position={[-10, -10, -5]} intensity={0.5} color="#3b82f6" />
      
      {/* Leaderboard panels */}
      {panels.map((panel, index) => (
        <LeaderboardPanel
          key={index}
          position={panelPositions[index]}
          rotation={[0, -(index / 6) * Math.PI * 2, 0]}
          title={panel.title}
          icon={panel.icon}
          data={panel.data}
          isActive={index === activePanel}
          onClick={() => onPanelClick(index)}
        />
      ))}
      
      {/* Central glow effect */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.1} />
      </mesh>
    </group>
  );
}

// Main 3D Leaderboards Component
export default function ThreeDLeaderboards({ leaderboards }: { leaderboards: LeaderboardData }) {
  const [activePanel, setActivePanel] = useState(0); // Start with Overall Leaders
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  
  // Removed auto-rotation - panels now change only by manual user interaction
  
  const handlePrevious = () => {
    setIsUserInteracting(true);
    setActivePanel(prev => (prev - 1 + 6) % 6);
    setTimeout(() => setIsUserInteracting(false), 3000);
  };
  
  const handleNext = () => {
    setIsUserInteracting(true);
    setActivePanel(prev => (prev + 1) % 6);
    setTimeout(() => setIsUserInteracting(false), 3000);
  };
  
  const handlePanelClick = (index: number) => {
    setIsUserInteracting(true);
    setActivePanel(index);
    setTimeout(() => setIsUserInteracting(false), 3000);
  };
  
  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setIsUserInteracting(true);
  };
  
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;
    
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;
    
    // Determine swipe direction (horizontal swipes only)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        handlePrevious();
      } else {
        handleNext();
      }
    }
    
    setTouchStart(null);
    setTimeout(() => setIsUserInteracting(false), 3000);
  };
  
  const currentPanel = useMemo(() => {
    const roleOrder: (PlayerRole | 'overall')[] = ['overall', 'Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'];
    const titles = ["Overall Leaders", "Carry Leaders", "Mid Leaders", "Offlane Leaders", "Soft Support Leaders", "Hard Support Leaders"];
    const icons = [Trophy, Crown, Target, Medal, Award, Star];
    
    return {
      title: titles[activePanel],
      icon: icons[activePanel],
      data: activePanel === 0 ? leaderboards.overall : leaderboards.byRole?.[roleOrder[activePanel] as PlayerRole] || []
    };
  }, [activePanel, leaderboards]);

  return (
    <Card className="w-full shadow-xl bg-gradient-to-br from-background via-background/95 to-muted/50">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl lg:text-3xl flex items-center justify-center gap-3">
          <currentPanel.icon className="h-8 w-8 text-primary" />
          Fantasy Leaderboards
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-0">
        {/* 3D Canvas */}
        <div 
          className="relative h-[600px] lg:h-[700px] w-full bg-gradient-to-b from-slate-900 to-slate-800 rounded-lg overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <Canvas 
            camera={{ position: [0, 0, 12], fov: 60 }}
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: false }}
            onCreated={(state) => {
              state.gl.setClearColor('#1e293b');
            }}
          >
            <Suspense fallback={null}>
              <Scene 
                leaderboards={leaderboards}
                activePanel={activePanel}
                onPanelClick={handlePanelClick}
              />
              
              {/* Orbit controls for desktop */}
              <OrbitControls
                enablePan={false}
                enableZoom={false}
                enableRotate={true}
                maxPolarAngle={Math.PI / 2}
                minPolarAngle={Math.PI / 2}
                onStart={() => setIsUserInteracting(true)}
                onEnd={() => setTimeout(() => setIsUserInteracting(false), 3000)}
              />
            </Suspense>
          </Canvas>
          
          {/* Navigation Controls */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-4 z-10">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevious}
              className="bg-background/80 backdrop-blur-sm border-primary/20 hover:bg-primary/20"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            {/* Panel indicators */}
            <div className="flex gap-2">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <button
                  key={index}
                  onClick={() => handlePanelClick(index)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all duration-300",
                    index === activePanel 
                      ? "bg-primary scale-125" 
                      : "bg-muted-foreground/40 hover:bg-muted-foreground/60"
                  )}
                />
              ))}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              className="bg-background/80 backdrop-blur-sm border-primary/20 hover:bg-primary/20"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Current panel indicator */}
          <div className="absolute top-4 left-4 z-10">
            <div className="bg-background/90 backdrop-blur-sm rounded-lg p-3 border border-primary/20">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <currentPanel.icon className="h-4 w-4 text-primary" />
                {currentPanel.title}
              </div>
            </div>
          </div>
          
          {/* Instructions */}
          <div className="absolute top-4 right-4 z-10 hidden lg:block">
            <div className="bg-background/90 backdrop-blur-sm rounded-lg p-3 border border-primary/20 text-xs text-muted-foreground">
              <div>🖱️ Drag to rotate • ⬅️➡️ Navigate • 📱 Swipe on mobile</div>
            </div>
          </div>
        </div>
        
        {/* Current Panel Details (Mobile-friendly) */}
        <div className="p-4 lg:p-6 border-t">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <currentPanel.icon className="h-5 w-5 text-primary" />
              {currentPanel.title}
            </h3>
            <div className="text-sm text-muted-foreground">
              {currentPanel.data.length} entries
            </div>
          </div>
          
          {/* All entries in a responsive grid with scrolling */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
            {currentPanel.data.map((entry, index) => (
              <div
                key={('userId' in entry ? entry.userId : 'playerId' in entry ? entry.playerId : index)}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border transition-colors",
                  index < 3 
                    ? "bg-primary/10 border-primary/20" 
                    : "bg-muted/50 border-muted-foreground/20"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                    index === 0 ? "bg-yellow-500 text-yellow-50" :
                    index === 1 ? "bg-gray-400 text-gray-50" :
                    index === 2 ? "bg-amber-600 text-amber-50" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {index + 1}
                  </div>
                  
                  <div className="flex-1">
                    <div className="font-medium text-sm">
                      {('displayName' in entry ? entry.displayName : 'nickname' in entry ? entry.nickname : 'Unknown') || 'Unknown'}
                    </div>
                    {'teamName' in entry && entry.teamName && (
                      <div className="text-xs text-muted-foreground">
                        {entry.teamName}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="font-bold text-primary">
                    {entry.averageScore?.toFixed(1) || '0.0'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {('gamesPlayed' in entry ? entry.gamesPlayed : 'totalMatches' in entry ? entry.totalMatches : 0) || 0} games
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}