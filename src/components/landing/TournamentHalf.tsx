// src/components/landing/TournamentHalf.tsx
// Full-height tournament card for split-screen landing page

'use client';

import { useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { TournamentSummary } from '@/types/tournament';
import { cn } from '@/lib/utils';
// Icons removed - not needed anymore

interface TournamentHalfProps {
  tournament: TournamentSummary;
  side: 'left' | 'right';
  isArchived?: boolean;
}

export function TournamentHalf({ tournament, side, isArchived = false }: TournamentHalfProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Mouse position for parallax effect
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  // Smooth spring animation for mouse movement
  const smoothMouseX = useSpring(mouseX, { stiffness: 150, damping: 20 });
  const smoothMouseY = useSpring(mouseY, { stiffness: 150, damping: 20 });
  
  // Transform mouse position to subtle movement
  const logoX = useTransform(smoothMouseX, [-0.5, 0.5], [-10, 10]);
  const logoY = useTransform(smoothMouseY, [-0.5, 0.5], [-10, 10]);
  const glowX = useTransform(smoothMouseX, [-0.5, 0.5], ['40%', '60%']);
  const glowY = useTransform(smoothMouseY, [-0.5, 0.5], ['40%', '60%']);
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const statusConfig = {
    registration: { label: 'Rejestracja otwarta', color: 'bg-green-500', pulse: true },
    active: { label: 'Trwa', color: 'bg-primary', pulse: true },
    completed: { label: 'Zakończony', color: 'bg-muted-foreground', pulse: false },
  };

  const status = statusConfig[tournament.status as keyof typeof statusConfig] || statusConfig.completed;

  // Get theme colors based on tournament
  const isPdl = tournament.slug === 'pdl';
  const themeColors = isPdl 
    ? {
        primary: 'hsl(345 75% 31%)',
        glow: 'hsl(345 75% 31% / 0.4)',
        // PDL: Red to white (top to bottom)
        textGradient: 'bg-gradient-to-b from-[#a00000] to-[#cbcccc]',
        border: 'border-[hsl(345,75%,31%)]',
        hoverBorder: 'hover:border-[hsl(46,65%,52%)]',
        textAccent: 'text-[hsl(46,65%,52%)]',
      }
    : {
        primary: 'hsl(330 100% 54%)',
        glow: 'hsl(330 100% 54% / 0.4)',
        // Letnia: Hot Pink (#FF1493) to Cyan (#00FFFF)
        textGradient: 'from-[#FF1493] via-[#FF69B4] to-[#00FFFF]',
        border: 'border-[hsl(330,100%,54%)]',
        hoverBorder: 'hover:border-[hsl(180,100%,50%)]',
        textAccent: 'text-[hsl(180,100%,50%)]',
      };

  return (
    <Link 
      href={`/${tournament.slug}`}
      className={cn(
        "relative flex-1 overflow-hidden group",
        "transition-all duration-500",
        side === 'left' ? 'border-r border-border/30' : ''
      )}
    >
      <motion.div
        ref={containerRef}
        className="relative h-full flex flex-col items-center justify-center p-8 cursor-pointer"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: side === 'left' ? 0.1 : 0.2 }}
      >
        {/* Crazy animated background */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 overflow-hidden">
          {isPdl ? (
            // PDL: Animated diagonal stripes
            <div className="absolute inset-0 animate-slide-diagonal"
              style={{
                backgroundImage: `repeating-linear-gradient(
                  45deg,
                  transparent,
                  transparent 35px,
                  ${themeColors.glow} 35px,
                  ${themeColors.glow} 70px
                )`,
                backgroundSize: '200% 200%',
                animation: 'slide-diagonal 4s linear infinite',
              } as React.CSSProperties}
            />
          ) : (
            // Letnia: Animated neon grid
            <>
              <div className="absolute inset-0"
                style={{
                  backgroundImage: `
                    linear-gradient(${themeColors.glow} 1px, transparent 1px),
                    linear-gradient(90deg, ${themeColors.glow} 1px, transparent 1px)
                  `,
                  backgroundSize: '50px 50px',
                  animation: 'grid-scroll 2s linear infinite',
                } as React.CSSProperties}
              />
              <div className="absolute inset-0"
                style={{
                  background: `radial-gradient(circle, ${themeColors.glow} 0%, transparent 70%)`,
                  animation: 'pulse-glow 1.5s ease-in-out infinite',
                } as React.CSSProperties}
              />
            </>
          )}
        </div>
        
        {/* Subtle background pattern */}
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center max-w-md">
          
          {/* Logo with parallax - LARGE */}
          <motion.div
            className={cn(
              "relative transition-transform duration-300",
              "group-hover:scale-105"
            )}
            style={{ x: logoX, y: logoY }}
          >
            {/* Glow behind logo */}
            <div 
              className={cn(
                "absolute inset-0 blur-3xl opacity-0 group-hover:opacity-[0.48] transition-opacity duration-500",
                isPdl ? "bg-[hsl(345,75%,31%)]" : "bg-[hsl(330,100%,54%)]"
              )}
              style={{ transform: 'scale(3)' }}
            />
            
            {/* Logo - Extra large */}
            <div className="relative w-[27rem] h-[27rem] md:w-[36rem] md:h-[36rem] lg:w-[42rem] lg:h-[42rem]">
              <Image
                src={tournament.logoUrl || '/logos/default.png'}
                alt={tournament.name}
                fill
                className="object-contain drop-shadow-2xl"
                priority
              />
            </div>
          </motion.div>

          {/* Tagline - Styled with tournament font */}
          <motion.div
            className="text-center max-w-md mb-6 px-4 h-32 md:h-40 lg:h-48 flex items-center justify-center"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: side === 'left' ? 0.3 : 0.4, duration: 0.5 }}
          >
            <p 
              className={cn(
                "text-2xl md:text-3xl lg:text-4xl font-bold",
                "bg-clip-text text-transparent bg-gradient-to-r",
                themeColors.textGradient,
                "leading-tight tracking-tight",
                isPdl ? "font-logik uppercase" : "font-tilt-neon"
              )}
              style={{
                textShadow: isPdl 
                  ? '0 0 30px hsl(345 75% 31% / 0.3)'
                  : '0 0 30px hsl(330 100% 54% / 0.3)',
              }}
            >
              {tournament.type === 'league' 
                ? 'Polska liga Dota 2 dla każdego'
                : 'Turniej z limitem MMR'}
            </p>
          </motion.div>

          {/* Status Badge */}
          <motion.div
            className="flex items-center gap-3"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: side === 'left' ? 0.4 : 0.5, duration: 0.5 }}
          >
            <span className={cn(
              "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium",
              "bg-background/80 backdrop-blur-sm border border-border"
            )}>
              <span className={cn(
                "w-2 h-2 rounded-full",
                status.color,
                status.pulse && "animate-pulse"
              )} />
              {status.label}
            </span>

            {/* Archived Badge */}
            {isArchived && (
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium bg-muted text-muted-foreground">
                Archiwum
              </span>
            )}
          </motion.div>
        </div>

        {/* Hover border effect */}
        <div className={cn(
          "absolute inset-0 border-2 border-transparent transition-colors duration-300",
          `group-hover:${themeColors.border}`
        )} />
      </motion.div>
    </Link>
  );
}
