// src/components/pdl/QuickLinksSection.tsx
// Quick links to Fantasy, Pick'em, and About

'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { TrendingUp, Target, Info, ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { useTournament } from '@/context/TournamentContext';

export function QuickLinksSection() {
  const { getTournamentPath } = useTournament();
  
  const links = [
    {
      title: 'Fantasy League',
      description: 'Zbuduj swój wymarzony skład na cały sezon!',
      icon: <TrendingUp className="h-5 w-5" />,
      href: getTournamentPath('/fantasy'),
      gradient: 'from-purple-500/20 to-pink-500/20',
      borderGradient: 'from-purple-500/50 to-pink-500/50',
      iconColor: 'text-purple-400',
      glowColor: 'rgba(168, 85, 247, 0.3)'
    },
    {
      title: "Pick'em",
      description: 'Wytypuj końcowe tabele dywizji!',
      icon: <Target className="h-5 w-5" />,
      href: getTournamentPath('/pickem'),
      gradient: 'from-blue-500/20 to-cyan-500/20',
      borderGradient: 'from-blue-500/50 to-cyan-500/50',
      iconColor: 'text-cyan-400',
      glowColor: 'rgba(34, 211, 238, 0.3)'
    },
    {
      title: 'O Lidze',
      description: 'Dowiedz się więcej o Polish Dota League',
      icon: <Info className="h-5 w-5" />,
      href: getTournamentPath('/about'),
      gradient: 'from-[#8B1538]/20 to-[#d4d4d4]/10',
      borderGradient: 'from-[#8B1538]/50 to-[#d4d4d4]/30',
      iconColor: 'text-[#d4d4d4]',
      glowColor: 'rgba(139, 21, 56, 0.3)'
    }
  ];

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      {links.map((link, index) => (
        <motion.div 
          key={link.title} 
          variants={fadeInUp}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Link href={link.href}>
            <motion.div
              whileHover={{ scale: 1.03, x: 8 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "group relative p-5 rounded-xl overflow-hidden",
                "bg-gradient-to-br from-[#1e1e24] to-[#16161a]",
                "border border-[#2a2a32]",
                "transition-all duration-300",
                "hover:border-[#3a3a44]"
              )}
              style={{
                boxShadow: `0 4px 24px rgba(0,0,0,0.4)`
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = `0 8px 32px ${link.glowColor}`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.4)';
              }}
            >
              {/* Gradient background on hover */}
              <div className={cn(
                "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                link.gradient
              )} />

              {/* Animated border gradient */}
              <motion.div
                className={cn(
                  "absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                  "bg-gradient-to-r",
                  link.borderGradient
                )}
                style={{
                  padding: '1px',
                  WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                  WebkitMaskComposite: 'xor',
                  maskComposite: 'exclude',
                }}
              />

              <div className="relative flex items-start gap-4">
                <motion.div 
                  className={cn(
                    "p-3 rounded-lg bg-[#252530]",
                    link.iconColor
                  )}
                  whileHover={{ rotate: [0, -10, 10, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="w-5 h-5 flex items-center justify-center">
                    {link.icon}
                  </div>
                </motion.div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-white mb-1">{link.title}</h3>
                  <p className="text-sm text-[#808090]">
                    {link.description}
                  </p>
                </div>
              </div>

              {/* Sparkle effect */}
              <motion.div
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="h-4 w-4 text-white/20" />
              </motion.div>
            </motion.div>
          </Link>
        </motion.div>
      ))}
    </motion.div>
  );
}
