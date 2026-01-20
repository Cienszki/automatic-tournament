// src/app/page.tsx
// Main landing page for dota2inhouse.pl
// Full-screen split design with tournament selection

'use client';

import { useTournament } from '@/context/TournamentContext';
import { TournamentHalf, BottomBar } from '@/components/landing';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import Image from 'next/image';

/**
 * Landing page for dota2inhouse.pl
 * Full-screen split design showing active tournaments
 */
export default function LandingPage() {
  const { activeTournaments, archivedTournaments, isLoading } = useTournament();


  // Loading state
  if (isLoading) {
    return <LoadingScreen />;
  }

  // If we have exactly 2 active tournaments, show the split view
  const showSplitView = activeTournaments.length === 2;
  
  // If we have 1 tournament, show it full screen
  const showSingleView = activeTournaments.length === 1;
  
  // If no active tournaments, show the empty state with archives
  const showEmptyState = activeTournaments.length === 0;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Main Tournament Selection */}
      <main className="flex-1 flex flex-col md:flex-row relative">
        {showSplitView && (
          <>
            <TournamentHalf 
              tournament={activeTournaments[0]} 
              side="left"
            />
            
            {/* PD2IH Center Logo - Circular badge on dividing line */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
              {/* Red glow effect - twice as big */}
              <div className="absolute inset-0 -inset-16 md:-inset-20 lg:-inset-24 bg-red-600/30 blur-3xl rounded-full animate-pulse" />
              
              <motion.div
                className="relative w-24 h-24 md:w-28 md:h-28 lg:w-32 lg:h-32 rounded-full bg-background/95 backdrop-blur-sm shadow-2xl overflow-hidden"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.3 }}
              >
                <div className="relative w-full h-full scale-[1.95]">
                  <Image
                    src="/logos/pd2ih/pd2ih-logo.png"
                    alt="PD2IH"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
              </motion.div>
            </div>
            
            <TournamentHalf 
              tournament={activeTournaments[1]} 
              side="right"
            />
          </>
        )}

        {showSingleView && (
          <TournamentHalf 
            tournament={activeTournaments[0]} 
            side="left"
          />
        )}

        {showEmptyState && (
          <EmptyState />
        )}
      </main>

      {/* Bottom Bar */}
      <BottomBar archivedTournaments={archivedTournaments} />
    </div>
  );
}

/**
 * Loading screen with animated placeholder
 */
function LoadingScreen() {
  return (
    <div className="h-screen bg-background flex items-center justify-center">
      <motion.div 
        className="flex flex-col items-center gap-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Animated logo placeholder */}
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 animate-pulse" />
          <motion.div 
            className="absolute inset-0 rounded-full border-2 border-primary/40"
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.5, 0, 0.5],
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        </div>
        
        {/* Loading text */}
        <div className="flex flex-col items-center gap-2">
          <div className="h-4 w-48 bg-muted rounded animate-pulse" />
          <div className="h-3 w-32 bg-muted/50 rounded animate-pulse" />
        </div>

        {/* Loading spinner */}
        <motion.div
          className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </motion.div>
    </div>
  );
}

/**
 * Empty state when no tournaments are active
 */
function EmptyState() {
  return (
    <motion.div 
      className="flex-1 flex items-center justify-center p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="text-center max-w-md">
        <motion.div
          className="w-32 h-32 mx-auto mb-8 rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center"
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
        >
          <span className="text-6xl">🏆</span>
        </motion.div>
        
        <motion.h1
          className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Brak aktywnych turniejów
        </motion.h1>
        
        <motion.p
          className="text-lg text-muted-foreground mb-8"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          Obecnie nie prowadzimy żadnych turniejów. 
          Dołącz do naszego Discorda, aby nie przegapić kolejnych wydarzeń!
        </motion.p>

        <motion.a
          href="https://discord.gg/pd2ih"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex items-center gap-2 px-6 py-3 rounded-full",
            "bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium",
            "transition-all duration-200 hover:scale-105"
          )}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>
          Dołącz do Discorda
        </motion.a>
      </div>
    </motion.div>
  );
}
// trigger rebuild
