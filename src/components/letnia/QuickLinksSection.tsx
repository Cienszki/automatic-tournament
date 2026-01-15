// src/components/letnia/QuickLinksSection.tsx
// Quick links section for Letnia home page

'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { 
  LayoutGrid, 
  GitFork, 
  Users, 
  FileText, 
  Crown, 
  ClipboardCheck,
  ChevronRight
} from 'lucide-react';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { useTournament } from '@/context/TournamentContext';

interface QuickLinkItem {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

export function LetniaQuickLinksSection() {
  const t = useTranslations('letniaHome.quickLinks');
  const { getTournamentPath, theme, tournament } = useTournament();

  const links: QuickLinkItem[] = [
    {
      href: getTournamentPath('/groups'),
      icon: <LayoutGrid className="h-5 w-5" />,
      title: t('groups'),
      description: t('groupsDesc'),
      color: theme.primaryColor
    },
    {
      href: getTournamentPath('/playoffs'),
      icon: <GitFork className="h-5 w-5" />,
      title: t('playoffs'),
      description: t('playoffsDesc'),
      color: theme.secondaryColor
    },
    {
      href: getTournamentPath('/teams'),
      icon: <Users className="h-5 w-5" />,
      title: t('teams'),
      description: t('teamsDesc'),
      color: theme.accentColor
    },
    {
      href: getTournamentPath('/rules'),
      icon: <FileText className="h-5 w-5" />,
      title: t('rules'),
      description: t('rulesDesc'),
      color: theme.primaryColor
    }
  ];

  // Add fantasy if enabled
  if (tournament?.fantasy?.enabled) {
    links.push({
      href: getTournamentPath('/fantasy'),
      icon: <Crown className="h-5 w-5" />,
      title: t('fantasy'),
      description: t('fantasyDesc'),
      color: theme.secondaryColor
    });
  }

  // Add pickem if enabled
  if (tournament?.pickem?.enabled) {
    links.push({
      href: getTournamentPath('/pickem'),
      icon: <ClipboardCheck className="h-5 w-5" />,
      title: t('pickem'),
      description: t('pickemDesc'),
      color: theme.primaryColor
    });
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-3"
    >
      {links.map((link) => (
        <motion.div key={link.href} variants={fadeInUp}>
          <Link
            href={link.href}
            className="group flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm hover:bg-card/50 transition-all duration-300"
          >
            <div 
              className="p-2 rounded-lg"
              style={{ 
                background: `${link.color}20`,
                boxShadow: `0 0 10px ${link.color}20`
              }}
            >
              <span style={{ color: link.color }}>{link.icon}</span>
            </div>
            <div className="flex-grow min-w-0">
              <div className="font-medium">{link.title}</div>
              <div className="text-xs text-muted-foreground truncate">
                {link.description}
              </div>
            </div>
            <ChevronRight 
              className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform"
              style={{ color: link.color }}
            />
          </Link>
        </motion.div>
      ))}
    </motion.div>
  );
}
