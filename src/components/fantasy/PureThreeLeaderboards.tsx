"use client";

import React, { useRef, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Crown, Trophy, Medal, Award } from "lucide-react";

interface LeaderboardData {
  overall: Array<{
    userId: string;
    displayName: string;
    averageScore: number;
    gamesPlayed: number;
    rank: number;
    currentLineup?: any;
  }>;
  byRole: Record<string, Array<{
    playerId: string;
    nickname: string;
    teamName: string;
    averageScore: number;
    totalMatches: number;
    rank: number;
  }>>;
}

interface PureThreeLeaderboardsProps {
  leaderboards: LeaderboardData;
}

export default function PureThreeLeaderboards({ leaderboards }: PureThreeLeaderboardsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activePanel, setActivePanel] = useState(0);
  const [isClient, setIsClient] = useState(false);
  const sceneRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const animationRef = useRef<number>();

  // Available panels
  const panels = [
    { title: "Overall Leaders", data: leaderboards.overall, icon: Crown },
    { title: "Top Carries", data: leaderboards.byRole['Carry'] || [], icon: Trophy },
    { title: "Top Mids", data: leaderboards.byRole['Mid'] || [], icon: Medal },
    { title: "Top Offlaners", data: leaderboards.byRole['Offlane'] || [], icon: Award },
  ];

  useEffect(() => {
    setIsClient(true);
    
    if (!canvasRef.current) return;

    // Dynamic import of Three.js to avoid SSR issues
    import('three').then((THREE) => {
      const canvas = canvasRef.current!;
      
      // Scene setup
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0a0a0f);
      
      const camera = new THREE.PerspectiveCamera(75, 800 / 600, 0.1, 1000);
      camera.position.set(0, 2, 8);
      
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setSize(800, 600);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      
      sceneRef.current = scene;
      rendererRef.current = renderer;

      // Lighting setup
      const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
      scene.add(ambientLight);

      const spotLight1 = new THREE.SpotLight(0x00ffff, 1.5, 50, Math.PI / 6, 0.1);
      spotLight1.position.set(-10, 15, 10);
      spotLight1.castShadow = true;
      scene.add(spotLight1);

      const spotLight2 = new THREE.SpotLight(0xff0080, 1.5, 50, Math.PI / 6, 0.1);
      spotLight2.position.set(10, 15, 10);
      spotLight2.castShadow = true;
      scene.add(spotLight2);

      // Create floating particles
      const createParticles = () => {
        const particleCount = 100;
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i++) {
          // Random positions in a sphere
          positions[i * 3] = (Math.random() - 0.5) * 20;
          positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 20;

          // Neon colors
          const color = new THREE.Color();
          color.setHSL(Math.random(), 0.8, 0.6);
          colors[i * 3] = color.r;
          colors[i * 3 + 1] = color.g;
          colors[i * 3 + 2] = color.b;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
          size: 0.1,
          vertexColors: true,
          transparent: true,
          opacity: 0.8,
          blending: THREE.AdditiveBlending
        });

        const particles = new THREE.Points(geometry, material);
        scene.add(particles);
        return particles;
      };

      // Create 3D podiums for top 3 players
      const createPodiums = () => {
        const podiumGroup = new THREE.Group();
        const topPlayers = leaderboards.overall.slice(0, 3);

        topPlayers.forEach((player, index) => {
          const height = 2 - index * 0.4; // First place tallest
          const geometry = new THREE.CylinderGeometry(0.8, 0.8, height, 8);
          
          let material;
          switch (index) {
            case 0: // Gold
              material = new THREE.MeshPhongMaterial({ 
                color: 0xffd700, 
                shininess: 100,
                transparent: true,
                opacity: 0.9
              });
              break;
            case 1: // Silver  
              material = new THREE.MeshPhongMaterial({ 
                color: 0xc0c0c0, 
                shininess: 100,
                transparent: true,
                opacity: 0.9
              });
              break;
            case 2: // Bronze
              material = new THREE.MeshPhongMaterial({ 
                color: 0xcd7f32, 
                shininess: 100,
                transparent: true,
                opacity: 0.9
              });
              break;
          }

          const podium = new THREE.Mesh(geometry, material);
          podium.position.x = (index - 1) * 2.5;
          podium.position.y = height / 2;
          podium.castShadow = true;
          podium.receiveShadow = true;
          
          podiumGroup.add(podium);

          // Add floating name label (simplified as a glowing cube for now)
          const labelGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
          const labelMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00ffff, 
            transparent: true, 
            opacity: 0.8 
          });
          const label = new THREE.Mesh(labelGeometry, labelMaterial);
          label.position.x = (index - 1) * 2.5;
          label.position.y = height + 1;
          podiumGroup.add(label);
        });

        scene.add(podiumGroup);
        return podiumGroup;
      };

      // Create energy beams
      const createEnergyBeams = () => {
        const beamGroup = new THREE.Group();
        
        for (let i = 0; i < 5; i++) {
          const geometry = new THREE.CylinderGeometry(0.02, 0.02, 10, 8);
          const material = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.6
          });
          
          const beam = new THREE.Mesh(geometry, material);
          beam.position.x = (Math.random() - 0.5) * 15;
          beam.position.z = (Math.random() - 0.5) * 15;
          beam.rotation.x = Math.PI / 2;
          beamGroup.add(beam);
        }
        
        scene.add(beamGroup);
        return beamGroup;
      };

      const particles = createParticles();
      const podiums = createPodiums();
      const energyBeams = createEnergyBeams();

      // Animation loop
      const animate = () => {
        animationRef.current = requestAnimationFrame(animate);
        
        // Rotate particles
        particles.rotation.y += 0.002;
        particles.rotation.x += 0.001;
        
        // Animate podiums (gentle bounce)
        const time = Date.now() * 0.001;
        podiums.children.forEach((podium, index) => {
          if (podium.type === 'Mesh') {
            podium.position.y = Math.abs(podium.position.y) + Math.sin(time + index) * 0.1;
          }
        });

        // Animate energy beams
        energyBeams.rotation.y += 0.01;
        energyBeams.children.forEach((beam, index) => {
          if (beam instanceof THREE.Mesh && beam.material instanceof THREE.MeshBasicMaterial) {
            beam.material.opacity = 0.3 + Math.sin(time * 2 + index) * 0.3;
          }
        });

        // Camera orbit
        camera.position.x = Math.sin(time * 0.1) * 8;
        camera.position.z = Math.cos(time * 0.1) * 8;
        camera.lookAt(0, 1, 0);
        
        renderer.render(scene, camera);
      };

      animate();

      // Cleanup function
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
        renderer.dispose();
      };
    }).catch((error) => {
      console.error('Failed to load Three.js:', error);
    });

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [leaderboards, activePanel]);

  const nextPanel = () => {
    setActivePanel((prev) => (prev + 1) % panels.length);
  };

  const prevPanel = () => {
    setActivePanel((prev) => (prev - 1 + panels.length) % panels.length);
  };

  if (!isClient) {
    return (
      <Card className="w-full h-[700px] lg:h-[800px] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 rounded-2xl flex items-center justify-center border border-primary/20 shadow-2xl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary/30 border-t-primary mx-auto mb-4"></div>
          <p className="text-primary text-xl">Loading 3D Fantasy Arena...</p>
        </div>
      </Card>
    );
  }

  const currentPanel = panels[activePanel];
  const IconComponent = currentPanel.icon;

  return (
    <Card className="w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 rounded-2xl border border-primary/20 shadow-2xl overflow-hidden">
      <CardHeader className="text-center pb-4">
        <CardTitle className="flex items-center justify-center gap-3 text-3xl font-bold bg-gradient-to-r from-primary via-blue-400 to-primary bg-clip-text text-transparent">
          <IconComponent className="h-8 w-8 text-primary" />
          3D Fantasy Arena
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-6">
        {/* 3D Canvas */}
        <div className="relative mb-6">
          <canvas 
            ref={canvasRef}
            className="w-full h-[600px] rounded-xl border border-primary/20 shadow-inner"
            style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)' }}
          />
          
          {/* Overlay UI */}
          <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
            <div className="bg-black/60 backdrop-blur-sm rounded-lg p-3 border border-primary/20">
              <h3 className="text-primary font-bold text-lg flex items-center gap-2">
                <IconComponent className="h-5 w-5" />
                {currentPanel.title}
              </h3>
              <p className="text-slate-400 text-sm">{currentPanel.data.length} entries</p>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={prevPanel}
                size="sm" 
                variant="outline" 
                className="bg-black/60 backdrop-blur-sm border-primary/20 hover:bg-primary/20"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                onClick={nextPanel}
                size="sm" 
                variant="outline" 
                className="bg-black/60 backdrop-blur-sm border-primary/20 hover:bg-primary/20"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Bottom info panel */}
          <div className="absolute bottom-4 left-4 right-4">
            <div className="bg-black/80 backdrop-blur-sm rounded-lg p-4 border border-primary/20">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {currentPanel.data.slice(0, 3).map((player: any, index: number) => (
                  <div key={player.userId || player.playerId} className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <span className="text-2xl">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                      </span>
                      <span className="text-primary font-bold">#{index + 1}</span>
                    </div>
                    <p className="text-white font-semibold text-sm">
                      {player.displayName || player.nickname}
                    </p>
                    <p className="text-slate-400 text-xs">
                      {player.averageScore?.toFixed(1) || '0'} pts
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Panel Navigation */}
        <div className="flex justify-center gap-2 mb-4">
          {panels.map((panel, index) => {
            const Icon = panel.icon;
            return (
              <Button
                key={index}
                onClick={() => setActivePanel(index)}
                variant={activePanel === index ? "default" : "outline"}
                size="sm"
                className={`${
                  activePanel === index 
                    ? 'bg-primary text-primary-foreground' 
                    : 'border-primary/20 hover:bg-primary/20'
                }`}
              >
                <Icon className="h-4 w-4 mr-1" />
                {panel.title.replace('Top ', '')}
              </Button>
            );
          })}
        </div>

        {/* Stats Summary */}
        <div className="text-center text-sm text-slate-400">
          <p>🎮 Interactive 3D leaderboards • 🏆 {leaderboards.overall.length} total players • ⚡ Real-time updates</p>
        </div>
      </CardContent>
    </Card>
  );
}