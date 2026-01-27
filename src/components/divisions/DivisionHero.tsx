// src/components/divisions/DivisionHero.tsx
// Ultra-Premium Cinematic Hero Section

'use client';

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Trophy, Calendar, TrendingUp, Layers, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MouseEvent } from 'react';

interface DivisionHeroProps {
    divisionName: string;
    divisionTier: number;
    divisionColor: string;
    matchday?: string;
    currentRound?: number;
    totalRounds?: number;
    teamsCount: number;
    theme: any;
}

export function DivisionHero({
    divisionName,
    divisionTier,
    divisionColor,
    matchday,
    currentRound,
    totalRounds,
    teamsCount,
    theme
}: DivisionHeroProps) {
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const mouseX = useSpring(x, { stiffness: 500, damping: 100 });
    const mouseY = useSpring(y, { stiffness: 500, damping: 100 });

    function handleMouseMove(event: MouseEvent<HTMLDivElement>) {
        const { left, top, width, height } = event.currentTarget.getBoundingClientRect();
        const centerX = left + width / 2;
        const centerY = top + height / 2;

        x.set(event.clientX - centerX);
        y.set(event.clientY - centerY);
    }

    function handleMouseLeave() {
        x.set(0);
        y.set(0);
    }

    const rotateX = useTransform(mouseY, [-300, 300], [5, -5]);
    const rotateY = useTransform(mouseX, [-300, 300], [-5, 5]);

    const getTierClass = (tier: number) => {
        if (tier === 1) return { text: 'text-shine-gold', bg: 'bg-shine-gold', border: 'border-shine-gold' };
        if (tier === 2) return { text: 'text-shine-silver', bg: 'bg-shine-silver', border: 'border-shine-silver' };
        if (tier === 3) return { text: 'text-shine-bronze', bg: 'bg-shine-bronze', border: 'border-shine-bronze' };
        return { text: 'text-white', bg: 'bg-white', border: 'border-white/10' };
    };

    const tierStyle = getTierClass(divisionTier);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-2xl mb-8 min-h-[300px] flex items-center justify-center perspective-1000"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
                perspective: 1000
            }}
        >
            {/* 3D Floating Content Container */}
            <motion.div
                className="relative z-10 w-full max-w-6xl px-12 py-16 flex flex-col md:flex-row items-center justify-between gap-12"
                style={{
                    rotateX,
                    rotateY,
                    transformStyle: "preserve-3d"
                }}
            >
                {/* Left: Division Identity */}
                <div className="flex flex-col items-center md:items-start gap-6 transform-gpu" style={{ transform: "translateZ(30px)" }}>
                    <motion.div
                        className="relative group"
                        whileHover={{ scale: 1.05 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    >
                        <div
                            className={cn(
                                "w-24 h-24 rounded-3xl flex items-center justify-center backdrop-blur-xl shadow-2xl relative overflow-hidden",
                                "border-2", tierStyle.border
                            )}
                            style={{
                                boxShadow: `0 20px 50px -10px ${divisionColor}30`
                            }}
                        >
                            <div className={cn("absolute inset-0 opacity-20", tierStyle.bg)} />
                            <Layers className={cn("w-10 h-10 drop-shadow-md", tierStyle.text)} />
                        </div>

                        {/* Decorative orbitals */}
                        <div className={cn("absolute inset-0 rounded-3xl border scale-110 opacity-30 animate-spin-slow pointer-events-none", tierStyle.border)} />
                        <div className={cn("absolute inset-0 rounded-3xl border scale-125 opacity-10 animate-reverse-spin pointer-events-none", tierStyle.border)} />
                    </motion.div>

                    <div className="text-center md:text-left">
                        <motion.h1
                            className={cn("text-6xl md:text-8xl font-logik-extended-bold tracking-tighter mb-2", tierStyle.text)}
                            style={{
                                filter: `drop-shadow(0 0 40px ${divisionColor}30)`
                            }}
                        >
                            {divisionName}
                        </motion.h1>
                        <div className="flex items-center justify-center md:justify-start gap-4 text-white/50 text-sm font-sans font-medium tracking-wide uppercase">
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/5 backdrop-blur-md">
                                <Trophy className={cn("w-3.5 h-3.5", tierStyle.text)} />
                                {teamsCount} Drużyn
                            </span>
                            {matchday && (
                                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/5 backdrop-blur-md">
                                    <Calendar className={cn("w-3.5 h-3.5", tierStyle.text)} />
                                    {matchday}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Season Pulse & Stats */}
                <div className="flex flex-col gap-6 md:items-end w-full md:w-auto" style={{ transform: "translateZ(20px)" }}>
                    {currentRound && totalRounds && (
                        <div className="p-6 rounded-2xl glass-panel-premium w-full md:w-80 backdrop-blur-2xl border-white/10">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Sezon {currentRound}/{totalRounds}</span>
                                <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                            </div>

                            <div className="relative h-3 w-full bg-black/40 rounded-full overflow-hidden mb-2 shadow-inner">
                                <motion.div
                                    className="absolute top-0 left-0 h-full rounded-full"
                                    style={{
                                        background: `linear-gradient(90deg, ${divisionColor}, #fff)`,
                                        boxShadow: `0 0 20px ${divisionColor}`
                                    }}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(currentRound / totalRounds) * 100}%` }}
                                    transition={{ duration: 1.5, ease: "circOut" }}
                                />
                                {/* Scanline effect on bar */}
                                <div className="absolute inset-0 bg-white/20 w-1 animate-shimmer opacity-50" />
                            </div>

                            <div className="flex justify-between text-[10px] text-white/30 font-mono">
                                <span>START</span>
                                <span>FINAŁY</span>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}
