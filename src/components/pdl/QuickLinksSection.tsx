// src/components/pdl/QuickLinksSection.tsx
// Quick links to Fantasy, Pick'em, and About

'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { TrendingUp, Target, Info, ArrowRight, Sparkles, Tv } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { useTournament } from '@/context/TournamentContext';
import { organizationConfig } from '@/config/organization';

export function QuickLinksSection() {
  const { getTournamentPath, tournament } = useTournament();

  const links = [
    {
      title: 'Liga Fantasy',
      icon: <TrendingUp className="h-4 w-4" />,
      href: getTournamentPath('/fantasy'),
      color: 'text-purple-400',
      hoverColor: 'group-hover:text-purple-400',
    },
    {
      title: "Pick'em",
      icon: <Target className="h-4 w-4" />,
      href: getTournamentPath('/pickem'),
      color: 'text-cyan-400',
      hoverColor: 'group-hover:text-cyan-400',
    },
    {
      title: 'Aktualności',
      icon: <Sparkles className="h-4 w-4" />,
      href: getTournamentPath('/news'),
      color: 'text-amber-400',
      hoverColor: 'group-hover:text-amber-400',
    },
    {
      title: 'Twitch',
      icon: <Tv className="h-4 w-4" />,
      href: tournament?.twitchUrl || (tournament?.twitchChannel ? `https://www.twitch.tv/${tournament.twitchChannel}` : organizationConfig.defaults.twitch),
      color: 'text-[#9146FF]',
      hoverColor: 'group-hover:text-[#9146FF]',
      isExternal: true
    },
    {
      title: 'O Lidze',
      icon: <Info className="h-4 w-4" />,
      href: getTournamentPath('/about'),
      color: 'text-white/40',
      hoverColor: 'group-hover:text-white',
    }
  ];

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-start space-y-2"
    >
      {links.map((link, index) => (
        <motion.div
          key={link.title}
          variants={fadeInUp}
          className="w-full"
        >
          <Link
            href={link.href}
            className="block w-full"
            {...((link as any).isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            <motion.div
              whileHover={{ x: 5 }}
              className="group relative py-3 flex items-center gap-3 transition-all duration-300 w-full border-b border-white/5 hover:border-white/10"
            >
              <div className={cn(
                "p-1.5 rounded bg-white/5 group-hover:bg-white/10 transition-colors",
                link.color
              )}>
                {link.icon}
              </div>

              <div className="flex-1">
                <h3 className={cn(
                  "text-sm font-bold text-white/40 transition-colors tracking-wide uppercase",
                  link.hoverColor
                )}>
                  {link.title}
                </h3>
              </div>

              <ArrowRight className="w-3 h-3 text-white/10 group-hover:text-white/40 transition-colors opacity-0 group-hover:opacity-100" />
            </motion.div>
          </Link>
        </motion.div>
      ))}
    </motion.div>
  );
}
