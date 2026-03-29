'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Crown, ClipboardCheck, Tv, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { useTournament } from '@/context/TournamentContext';

interface QuickLinkItem {
  href: string;
  icon: React.ReactNode;
  title: string;
  color: string;
  isExternal?: boolean;
}

export function MmrQuickLinksSection() {
  const { getTournamentPath, tournament } = useTournament();

  const links: QuickLinkItem[] = [];

  if (tournament?.fantasy?.enabled) {
    links.push({ href: getTournamentPath('/fantasy'), icon: <Crown className="h-4 w-4" />, title: 'Liga Fantasy', color: 'text-purple-400/70 group-hover:text-purple-400' });
  }
  if (tournament?.pickem?.enabled) {
    links.push({ href: getTournamentPath('/pickem'), icon: <ClipboardCheck className="h-4 w-4" />, title: "Pick'em", color: 'text-cyan-400/70 group-hover:text-cyan-400' });
  }
  if (tournament?.twitchUrl) {
    links.push({ href: tournament.twitchUrl, icon: <Tv className="h-4 w-4" />, title: 'Twitch', color: 'text-violet-400/70 group-hover:text-violet-400', isExternal: true });
  }

  if (links.length === 0) return null;

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-start space-y-1"
    >
      {links.map((link) => (
        <motion.div key={link.href} variants={fadeInUp} className="w-full">
          <Link
            href={link.href}
            className="block w-full"
            {...(link.isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            <motion.div
              whileHover={{ x: 5 }}
              className="group relative py-3 flex items-center gap-3 transition-all duration-300 w-full border-b border-white/5 hover:border-white/10"
            >
              <div className={cn('p-1.5 rounded bg-white/5 group-hover:bg-white/10 transition-colors', link.color)}>
                {link.icon}
              </div>
              <span className={cn('font-logik text-sm font-medium tracking-wide transition-colors', link.color)}>
                {link.title}
              </span>
              <ArrowRight className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-40 transition-opacity" />
            </motion.div>
          </Link>
        </motion.div>
      ))}
    </motion.div>
  );
}
