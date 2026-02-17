"use client";

import React, { useRef, useState, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber';
import { Text, OrbitControls, Sphere, Box, Cylinder, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Crown, Trophy, Medal, Award, Star, Target, Zap, Swords } from "lucide-react";
import type { PlayerRole } from "@/lib/definitions";
import { cn } from "@/lib/utils";

interface LeaderboardData {
  overall: Array<{
    userId: string;
    displayName: string;
    averageScore: number;
    gamesPlayed: number;
    rank: number;
    currentLineup?: any;
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

// Floating particles for atmosphere
function FloatingParticles() {
  const particleCount = 50;
  const particlesRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (particlesRef.current) {
      particlesRef.current.rotation.y = state.clock.elapsedTime * 0.05;
      particlesRef.current.children.forEach((child, i) => {
        const offset = i * 0.1;
        child.position.y = Math.sin(state.clock.elapsedTime + offset) * 2;
        child.rotation.z += 0.01;
      });
    }
  });

  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const radius = 15 + Math.random() * 10;
      temp.push({
        position: [
          Math.cos(angle) * radius,
          (Math.random() - 0.5) * 20,
          Math.sin(angle) * radius
        ] as [number, number, number],
        scale: 0.1 + Math.random() * 0.3
      });
    }
    return temp;
  }, []);

  return (
    <group ref={particlesRef}>
      {particles.map((particle, i) => (
        <Sphere key={i} position={particle.position} args={[particle.scale, 8, 8]}>
          <meshStandardMaterial 
            color="#3b82f6" 
            emissive="#1e40af" 
            emissiveIntensity={0.3}
            transparent 
            opacity={0.6} 
          />
        </Sphere>
      ))}
    </group>
  );
}

// 3D Podium Component
function PodiumStep({ position, height, rank, data }: {
  position: [number, number, number];
  height: number;
  rank: number;
  data: any;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime + rank) * 0.1;
      meshRef.current.scale.setScalar(hovered ? 1.05 : 1);
    }
  });

  const colors = {
    1: '#ffd700', // Gold
    2: '#c0c0c0', // Silver  
    3: '#cd7f32'  // Bronze
  };

  return (
    <group>
      {/* Podium Base */}
      <Cylinder
        ref={meshRef}
        position={position}
        args={[1.5, 1.5, height, 32]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial 
          color={colors[rank as keyof typeof colors] || '#3b82f6'} 
          metalness={0.8}
          roughness={0.2}
          emissive={colors[rank as keyof typeof colors] || '#1e40af'}
          emissiveIntensity={0.1}
        />
      </Cylinder>

      {/* Rank Number */}
      <Text
        position={[position[0], position[1] + height/2 + 0.5, position[2]]}
        fontSize={0.8}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        font="/fonts/inter-bold.woff"
      >
        {rank}
      </Text>

      {/* Player Name */}
      <Text
        position={[position[0], position[1] + height/2 + 1.2, position[2]]}
        fontSize={0.3}
        color="#e2e8f0"
        anchorX="center"
        anchorY="middle"
        maxWidth={3}
      >
        {data?.displayName || data?.nickname || `Player ${rank}`}
      </Text>

      {/* Score */}
      <Text
        position={[position[0], position[1] + height/2 + 0.8, position[2]]}
        fontSize={0.4}
        color="#10b981"
        anchorX="center"
        anchorY="middle"
      >
        {data?.averageScore?.toFixed(1) || '0.0'}
      </Text>

      {/* Crown for first place */}
      {rank === 1 && (
        <Box position={[position[0], position[1] + height/2 + 2, position[2]]} args={[0.8, 0.4, 0.8]}>
          <meshStandardMaterial color="#ffd700" metalness={1} roughness={0} />
        </Box>
      )}
    </group>
  );
}

// Rotating Leaderboard Panel
function RotatingPanel({ 
  position, 
  rotation, 
  title, 
  data, 
  isActive, 
  panelIndex 
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  title: string;
  data: any[];
  isActive: boolean;
  panelIndex: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      // Floating animation
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.5 + panelIndex) * 0.3;
      
      // Scale effect for active panel
      const targetScale = isActive ? 1.2 : 0.9;
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.08);
      
      // Rotation effect
      if (isActive) {
        meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
      }
    }

    if (glowRef.current) {
      if (glowRef.current.material && !Array.isArray(glowRef.current.material)) {
        (glowRef.current.material as any).opacity = isActive ? 0.3 : 0.1;
      }
      glowRef.current.scale.setScalar(isActive ? 1.5 : 1.2);
    }
  });

  const panelColors = [
    '#ffd700', // Overall - Gold
    '#ff6b35', // Carry - Orange
    '#3b82f6', // Mid - Blue  
    '#10b981', // Offlane - Green
    '#8b5cf6', // Soft Support - Purple
    '#ec4899'  // Hard Support - Pink
  ];

  return (
    <group>
      {/* Glow Effect */}
      <Cylinder
        ref={glowRef}
        position={position}
        rotation={rotation}
        args={[3, 3, 0.1, 32]}
      >
        <meshBasicMaterial 
          color={panelColors[panelIndex]} 
          transparent 
          opacity={isActive ? 0.3 : 0.1}
        />
      </Cylinder>

      {/* Main Panel */}
      <Cylinder
        ref={meshRef}
        position={position}
        rotation={rotation}
        args={[2.5, 2.5, 0.3, 32]}
      >
        <meshStandardMaterial
          color={isActive ? panelColors[panelIndex] : '#1e293b'}
          metalness={0.6}
          roughness={0.3}
          emissive={panelColors[panelIndex]}
          emissiveIntensity={isActive ? 0.2 : 0.05}
        />
      </Cylinder>

      {/* Panel Title */}
      <Text
        position={[position[0], position[1] + 2, position[2] + 0.2]}
        rotation={rotation}
        fontSize={0.4}
        color={isActive ? "#ffffff" : "#94a3b8"}
        anchorX="center"
        anchorY="middle"
        font="/fonts/inter-bold.woff"
      >
        {title}
      </Text>

      {/* Top performers */}
      {data.slice(0, 3).map((entry, index) => (
        <group key={entry.userId || entry.playerId || index}>
          <Text
            position={[
              position[0] - 1.5 + index * 1.5, 
              position[1] + 1 - index * 0.3, 
              position[2] + 0.2
            ]}
            rotation={rotation}
            fontSize={0.2}
            color={isActive ? "#ffffff" : "#9ca3af"}
            anchorX="center"
            anchorY="middle"
          >
            {index + 1}. {(('displayName' in entry ? entry.displayName : 'nickname' in entry ? entry.nickname : 'Unknown')).substring(0, 8)}
          </Text>
          
          <Text
            position={[
              position[0] - 1.5 + index * 1.5, 
              position[1] + 0.6 - index * 0.3, 
              position[2] + 0.2
            ]}
            rotation={rotation}
            fontSize={0.15}
            color={isActive ? "#10b981" : "#6b7280"}
            anchorX="center"
            anchorY="middle"
          >
            {entry.averageScore?.toFixed(1) || '0.0'}
          </Text>
        </group>
      ))}
    </group>
  );
}

// Main 3D Scene
function Scene({ 
  leaderboards, 
  activePanel, 
  onPanelClick 
}: {
  leaderboards: LeaderboardData;
  activePanel: number;
  onPanelClick: (index: number) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  // Panel configuration
  const panels = useMemo(() => {
    const roleOrder: (PlayerRole)[] = ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'];
    
    return [
      {
        title: "🏆 Champions",
        data: leaderboards.overall || []
      },
      ...roleOrder.map((role, index) => ({
        title: `${['⚔️', '⚡', '🛡️', '🔮', '💚'][index]} ${role}`,
        data: leaderboards.byRole?.[role] || []
      }))
    ];
  }, [leaderboards]);

  // Calculate positions in a hexagon
  const radius = 8;
  const panelPositions = useMemo(() => {
    return panels.map((_, index) => {
      const angle = (index / 6) * Math.PI * 2 - Math.PI / 2; // Start from top
      return [
        Math.cos(angle) * radius,
        2,
        Math.sin(angle) * radius
      ] as [number, number, number];
    });
  }, [panels.length]);

  // Rotate the group to show active panel
  useFrame(() => {
    if (groupRef.current) {
      const targetRotation = -(activePanel / 6) * Math.PI * 2;
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        targetRotation,
        0.03
      );
    }
  });

  // Get top 3 for podium
  const topThree = leaderboards.overall?.slice(0, 3) || [];

  return (
    <group ref={groupRef}>
      {/* Environmental Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      <pointLight position={[-10, -10, -5]} intensity={0.5} color="#3b82f6" />
      <spotLight 
        position={[0, 20, 0]} 
        angle={Math.PI / 4} 
        penumbra={1} 
        intensity={2} 
        color="#ffd700"
        castShadow
      />

      {/* Floating Particles */}
      <FloatingParticles />

      {/* Central Podium */}
      {topThree.length > 0 && (
        <group>
          {/* Winner podium (center, tallest) */}
          {topThree[0] && (
            <PodiumStep
              position={[0, -2, 0]}
              height={4}
              rank={1}
              data={topThree[0]}
            />
          )}
          
          {/* Second place (left, medium) */}
          {topThree[1] && (
            <PodiumStep
              position={[-3, -2, 0]}
              height={3}
              rank={2}
              data={topThree[1]}
            />
          )}
          
          {/* Third place (right, shortest) */}
          {topThree[2] && (
            <PodiumStep
              position={[3, -2, 0]}
              height={2}
              rank={3}
              data={topThree[2]}
            />
          )}
        </group>
      )}

      {/* Rotating Panels */}
      {panels.map((panel, index) => (
        <RotatingPanel
          key={index}
          position={panelPositions[index]}
          rotation={[0, -(index / 6) * Math.PI * 2, 0]}
          title={panel.title}
          data={panel.data}
          isActive={index === activePanel}
          panelIndex={index}
        />
      ))}

      {/* Central Energy Orb */}
      <Sphere position={[0, 6, 0]} args={[1, 32, 32]}>
        <meshStandardMaterial
          color="#3b82f6"
          emissive="#1e40af"
          emissiveIntensity={0.5}
          transparent
          opacity={0.7}
          metalness={0.8}
          roughness={0.2}
        />
      </Sphere>

      {/* Energy beams from orb to panels */}
      {panelPositions.map((pos, index) => (
        <group key={`beam-${index}`}>
          <Cylinder
            position={[pos[0] * 0.5, 4, pos[2] * 0.5]}
            args={[0.05, 0.05, 4, 8]}
            rotation={[0, 0, Math.atan2(pos[2], pos[0])]}
          >
            <meshBasicMaterial
              color="#3b82f6"
              transparent
              opacity={index === activePanel ? 0.8 : 0.3}
            />
          </Cylinder>
        </group>
      ))}
    </group>
  );
}

// Main Component
export default function StunningLeaderboards({ leaderboards }: { leaderboards: LeaderboardData }) {
  const [activePanel, setActivePanel] = useState(0);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  const handlePrevious = () => {
    setIsUserInteracting(true);
    setActivePanel(prev => (prev - 1 + 6) % 6);
    setTimeout(() => setIsUserInteracting(false), 2000);
  };

  const handleNext = () => {
    setIsUserInteracting(true);
    setActivePanel(prev => (prev + 1) % 6);
    setTimeout(() => setIsUserInteracting(false), 2000);
  };

  const handlePanelClick = (index: number) => {
    setIsUserInteracting(true);
    setActivePanel(index);
    setTimeout(() => setIsUserInteracting(false), 2000);
  };

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setIsUserInteracting(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;
    
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    
    if (Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        handlePrevious();
      } else {
        handleNext();
      }
    }
    
    setTouchStart(null);
  };

  const panels = [
    { title: "🏆 Overall Champions", icon: Crown, data: leaderboards.overall || [] },
    { title: "⚔️ Carry Masters", icon: Swords, data: leaderboards.byRole?.['Carry'] || [] },
    { title: "⚡ Mid Legends", icon: Zap, data: leaderboards.byRole?.['Mid'] || [] },
    { title: "🛡️ Offlane Titans", icon: Target, data: leaderboards.byRole?.['Offlane'] || [] },
    { title: "🔮 Support Wizards", icon: Star, data: leaderboards.byRole?.['Soft Support'] || [] },
    { title: "💚 Guardian Angels", icon: Award, data: leaderboards.byRole?.['Hard Support'] || [] }
  ];

  const currentPanel = panels[activePanel];

  return (
    <Card className="w-full shadow-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-primary/20 overflow-hidden">
      <CardHeader className="text-center pb-2 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10">
        <CardTitle className="text-3xl lg:text-4xl flex items-center justify-center gap-3 bg-gradient-to-r from-primary via-blue-400 to-primary bg-clip-text text-transparent">
          <currentPanel.icon className="h-10 w-10 text-primary drop-shadow-lg" />
          Fantasy Leaderboards Arena
        </CardTitle>
        <p className="text-muted-foreground">Experience the ultimate 3D leaderboard visualization</p>
      </CardHeader>
      
      <CardContent className="p-0">
        {/* Main 3D Canvas */}
        <div 
          className="relative h-[700px] lg:h-[800px] w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <Canvas
            camera={{ position: [0, 5, 15], fov: 75 }}
            gl={{ 
              antialias: true, 
              alpha: true
            }}
            onCreated={(state) => {
              state.gl.setClearColor('#0f172a', 1);
              state.gl.shadowMap.enabled = true;
            }}
          >
            <Suspense fallback={null}>
              <Scene 
                leaderboards={leaderboards}
                activePanel={activePanel}
                onPanelClick={handlePanelClick}
              />
              
              <OrbitControls
                enablePan={false}
                enableZoom={true}
                minDistance={10}
                maxDistance={25}
                maxPolarAngle={Math.PI / 2.2}
                minPolarAngle={Math.PI / 4}
                onStart={() => setIsUserInteracting(true)}
                onEnd={() => setTimeout(() => setIsUserInteracting(false), 2000)}
              />
              
              <Environment preset="night" />
            </Suspense>
          </Canvas>
          
          {/* Floating UI Controls */}
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-6 z-10">
            <Button
              variant="outline"
              size="lg"
              onClick={handlePrevious}
              className="bg-black/40 backdrop-blur-lg border-primary/30 hover:bg-primary/20 text-white shadow-2xl"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            
            {/* Panel indicators with glow */}
            <div className="flex gap-3">
              {panels.map((panel, index) => (
                <button
                  key={index}
                  onClick={() => handlePanelClick(index)}
                  className={cn(
                    "w-4 h-4 rounded-full transition-all duration-500 shadow-lg",
                    index === activePanel 
                      ? "bg-primary scale-150 shadow-primary/50 shadow-2xl" 
                      : "bg-white/30 hover:bg-white/50 backdrop-blur-sm"
                  )}
                />
              ))}
            </div>
            
            <Button
              variant="outline"
              size="lg"
              onClick={handleNext}
              className="bg-black/40 backdrop-blur-lg border-primary/30 hover:bg-primary/20 text-white shadow-2xl"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </div>
          
          {/* Current panel info */}
          <div className="absolute top-6 left-6 z-10">
            <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-primary/30 shadow-2xl">
              <div className="flex items-center gap-3 text-white">
                <currentPanel.icon className="h-6 w-6 text-primary" />
                <div>
                  <div className="font-bold text-lg">{currentPanel.title}</div>
                  <div className="text-sm text-primary/80">{currentPanel.data.length} competitors</div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Instructions */}
          <div className="absolute top-6 right-6 z-10 hidden lg:block">
            <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-primary/30 shadow-2xl text-white/80 text-sm max-w-xs">
              <div className="space-y-2">
                <div>🖱️ <strong>Drag:</strong> Rotate view</div>
                <div>🔍 <strong>Scroll:</strong> Zoom in/out</div>
                <div>👆 <strong>Swipe:</strong> Switch panels</div>
                <div>🎯 <strong>Click dots:</strong> Jump to panel</div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Enhanced Details Panel */}
        <div className="p-6 bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 border-t border-primary/20">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold flex items-center gap-3 text-white">
              <currentPanel.icon className="h-7 w-7 text-primary" />
              {currentPanel.title}
            </h3>
            <div className="text-primary font-mono text-lg">
              {currentPanel.data.length} Champions
            </div>
          </div>
          
          {/* Top 10 in enhanced grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
            {currentPanel.data.slice(0, 10).map((entry, index) => (
              <div
                key={('userId' in entry ? entry.userId : 'playerId' in entry ? entry.playerId : index)}
                className={cn(
                  "relative p-4 rounded-xl border backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:shadow-xl",
                  index < 3 
                    ? "bg-gradient-to-br from-primary/20 to-primary/5 border-primary/40 shadow-primary/20 shadow-lg" 
                    : "bg-slate-800/50 border-slate-600/30 hover:border-primary/30"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shadow-lg",
                      index === 0 ? "bg-gradient-to-r from-yellow-400 to-yellow-600 text-black" :
                      index === 1 ? "bg-gradient-to-r from-gray-300 to-gray-500 text-black" :
                      index === 2 ? "bg-gradient-to-r from-amber-500 to-amber-700 text-white" :
                      "bg-gradient-to-r from-primary/80 to-primary text-white"
                    )}>
                      {index + 1}
                    </div>
                    
                    <div className="flex-1">
                      <div className="font-bold text-white text-lg">
                        {('displayName' in entry ? entry.displayName : 'nickname' in entry ? entry.nickname : 'Unknown')}
                      </div>
                      {'teamName' in entry && entry.teamName && (
                        <div className="text-sm text-slate-400">
                          {entry.teamName}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">
                      {entry.averageScore?.toFixed(1) || '0.0'}
                    </div>
                    <div className="text-sm text-slate-400">
                      {('gamesPlayed' in entry ? entry.gamesPlayed : 'totalMatches' in entry ? entry.totalMatches : 0)} games
                    </div>
                  </div>
                </div>
                
                {/* Rank badge */}
                {index < 3 && (
                  <div className="absolute -top-2 -right-2">
                    {index === 0 ? <Crown className="h-6 w-6 text-yellow-400" /> :
                     index === 1 ? <Medal className="h-6 w-6 text-gray-400" /> :
                     <Award className="h-6 w-6 text-amber-600" />}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}