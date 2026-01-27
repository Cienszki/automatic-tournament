'use client';

import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface RoundSelectorProps {
    currentRound: number;
    totalRounds: number;
    onRoundChange: (round: number) => void;
}

export function RoundSelector({ currentRound, totalRounds, onRoundChange }: RoundSelectorProps) {
    // Generate array of rounds
    const rounds = Array.from({ length: totalRounds }, (_, i) => i + 1);

    return (
        <div className="flex items-center justify-center gap-6 py-8 relative">
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[60px] bg-pdl-gold/5 blur-[50px] rounded-full pointer-events-none" />

            <Button
                variant="ghost"
                size="icon"
                onClick={() => onRoundChange(Math.max(1, currentRound - 1))}
                disabled={currentRound <= 1}
                className="group relative w-12 h-12 rounded-full border border-white/5 bg-white/5 hover:bg-white/10 hover:border-pdl-gold/30 hover:shadow-[0_0_15px_rgba(234,179,8,0.1)] transition-all disabled:opacity-30 disabled:pointer-events-none"
            >
                <ChevronLeft className="w-6 h-6 text-white/50 group-hover:text-pdl-gold transition-colors" />
            </Button>

            <div className="relative h-16 min-w-[200px] px-8 flex items-center justify-center overflow-hidden bg-[#0A0A0E]/60 backdrop-blur-md rounded-2xl border border-white/5 shadow-xl">
                {/* Inner bevel effect */}
                <div className="absolute inset-0 rounded-2xl border border-white/5 pointer-events-none" />

                <div className="flex flex-col items-center gap-0">
                    <span className="text-[10px] font-logik-extended-bold text-white/30 uppercase tracking-[0.2em]">
                        Current
                    </span>
                    <div className="flex items-baseline gap-3">
                        <span className="text-xl font-logik-extended-bold text-white/60 uppercase tracking-widest">
                            Round
                        </span>
                        <span className="text-4xl font-logik-extended-bold text-transparent bg-clip-text bg-gradient-to-b from-pdl-gold to-[#B8860B] drop-shadow-[0_2px_10px_rgba(234,179,8,0.2)]">
                            {currentRound}
                        </span>
                    </div>
                </div>
            </div>

            <Button
                variant="ghost"
                size="icon"
                onClick={() => onRoundChange(Math.min(totalRounds, currentRound + 1))}
                disabled={currentRound >= totalRounds}
                className="group relative w-12 h-12 rounded-full border border-white/5 bg-white/5 hover:bg-white/10 hover:border-pdl-gold/30 hover:shadow-[0_0_15px_rgba(234,179,8,0.1)] transition-all disabled:opacity-30 disabled:pointer-events-none"
            >
                <ChevronRight className="w-6 h-6 text-white/50 group-hover:text-pdl-gold transition-colors" />
            </Button>
        </div>
    );
}
