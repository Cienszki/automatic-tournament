// src/components/divisions/DivisionHero.tsx
// Ultra-Premium Cinematic Hero Section

'use client';

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Trophy, Calendar, TrendingUp, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MouseEvent } from 'react';
import { getDivisionTheme } from '@/lib/division-themes';

interface DivisionHeroProps {
    divisionName: string;
    divisionTier: number;
    divisionColor: string;
    matchday?: string;
    currentRound?: number;
    totalRounds?: number;
    teamsCount: number;
    theme: any;
    divisionTheme?: string;
    medalUrl?: string;
}

export function DivisionHero({
    divisionName,
    divisionTier,
    divisionColor,
    matchday,
    currentRound,
    totalRounds,
    teamsCount,
    theme,
    divisionTheme,
    medalUrl
}: DivisionHeroProps) {
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const mouseX = useSpring(x, { stiffness: 500, damping: 100 });
    const mouseY = useSpring(y, { stiffness: 500, damping: 100 });
    
    // Get theme if specified
    const themeData = getDivisionTheme(divisionTheme);
    const displayColor = themeData?.primaryColor || divisionColor;
    const displayGradient = themeData?.gradient || `linear-gradient(135deg, ${divisionColor} 0%, ${divisionColor} 100%)`;

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
                <div className="flex flex-col md:flex-row items-center gap-6 transform-gpu" style={{ transform: "translateZ(30px)" }}>
                    <motion.div
                        className="relative group shrink-0"
                        whileHover={{ scale: 1.05 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    >
                        <div
                            className={cn(
                                "rounded-3xl flex items-center justify-center backdrop-blur-xl shadow-2xl relative overflow-hidden border-2",
                                medalUrl ? "w-32 h-32" : "w-24 h-24"
                            )}
                            style={{
                                borderColor: displayColor,
                                boxShadow: `0 20px 50px -10px ${displayColor}30`
                            }}
                        >
                            {!medalUrl && <div className={cn("absolute inset-0 opacity-20", tierStyle.bg)} />}
                            {medalUrl ? (
                                <img 
                                    src={medalUrl} 
                                    alt={`${divisionName} medal`}
                                    className="w-full h-full object-contain drop-shadow-2xl p-2"
                                />
                            ) : (
                                <Layers className={cn("w-10 h-10 drop-shadow-md", tierStyle.text)} />
                            )}
                        </div>

                        {/* Decorative orbitals */}
                        <div className="absolute inset-0 rounded-3xl border-2 scale-110 opacity-30 animate-spin-slow pointer-events-none" style={{ borderColor: displayColor }} />
                        <div className="absolute inset-0 rounded-3xl border-2 scale-125 opacity-10 animate-reverse-spin pointer-events-none" style={{ borderColor: displayColor }} />
                    </motion.div>

                    <div className="text-center md:text-left">
                        <motion.h1
                            className="text-6xl md:text-8xl font-logik-extended-bold tracking-tighter mb-2"
                            style={{
                                color: displayColor,
                                filter: `drop-shadow(0 0 40px ${displayColor}30)`
                            }}
                        >
                            {divisionName}
                        </motion.h1>
                        {matchday && (
                            <div className="flex items-center justify-center md:justify-start gap-4 text-white/50 text-sm font-sans font-medium tracking-wide uppercase">
                                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/5 backdrop-blur-md">
                                    <Calendar className="w-3.5 h-3.5" style={{ color: displayColor }} />
                                    {matchday}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
