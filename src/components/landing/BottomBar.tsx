// src/components/landing/BottomBar.tsx
// Bottom bar with archives dropdown, social links, and branding

'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { TournamentSummary } from '@/types/tournament';
import { cn } from '@/lib/utils';
import { 
  ChevronUp, 
  ChevronDown, 
  Archive, 
  ExternalLink,
  MessageCircle,
  Play,
  Globe,
  Sparkles
} from 'lucide-react';
import { fadeInUp, staggerContainer, listItem } from '@/lib/animations';

// Discord icon component
function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="currentColor"
    >
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  );
}

// Twitch icon component
function TwitchIcon({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="currentColor"
    >
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
    </svg>
  );
}

interface BottomBarProps {
  archivedTournaments: TournamentSummary[];
}

export function BottomBar({ archivedTournaments }: BottomBarProps) {
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);

  return (
    <div className="relative">
      {/* Archive Dropdown */}
      <AnimatePresence>
        {isArchiveOpen && archivedTournaments.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="absolute bottom-full left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border overflow-hidden"
          >
            <motion.div 
              className="container mx-auto px-4 py-6"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              <div className="flex items-center gap-2 mb-4 text-muted-foreground">
                <Archive className="h-4 w-4" />
                <span className="text-sm font-medium">Archiwum turniejów</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {archivedTournaments.map((tournament) => (
                  <motion.div key={tournament.id} variants={listItem}>
                    <Link
                      href={`/${tournament.slug}`}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg",
                        "bg-background/50 border border-border",
                        "hover:bg-background hover:border-primary/30 transition-all duration-200",
                        "group"
                      )}
                    >
                      {tournament.logoUrl && (
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted shrink-0">
                          <Image
                            src={tournament.logoUrl}
                            alt={tournament.name}
                            width={40}
                            height={40}
                            className="object-contain w-full h-full"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                          {tournament.name}
                        </p>
                        {tournament.startDate && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(tournament.startDate).toLocaleDateString('pl-PL', {
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                        )}
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Bar */}
      <div className="border-t border-border/20">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Left: Archive Toggle & Creator Link */}
            <div className="flex items-center gap-2">
              {archivedTournaments.length > 0 && (
                <button
                  onClick={() => setIsArchiveOpen(!isArchiveOpen)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg",
                    "text-sm text-muted-foreground hover:text-foreground",
                    "hover:bg-muted/50 transition-all duration-200",
                    isArchiveOpen && "bg-muted/50 text-foreground"
                  )}
                >
                  <Archive className="h-4 w-4" />
                  <span className="hidden sm:inline">Poprzednie turnieje</span>
                  <span className="sm:hidden">Archiwum</span>
                  {isArchiveOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </button>
              )}
              
              <Link
                href="/creator"
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg",
                  "text-sm text-primary hover:text-primary/80",
                  "hover:bg-primary/5 transition-all duration-200",
                  "border border-primary/20"
                )}
              >
                <Sparkles className="h-4 w-4" />
                <span className="hidden md:inline font-medium">Stwórz Turniej</span>
                <span className="md:hidden font-medium">Kreator</span>
              </Link>
            </div>

            {/* Right: Social Links & Branding */}
            <div className="flex items-center gap-4">
              <SocialLink
                href="https://discord.gg/pd2ih"
                icon={<DiscordIcon className="h-5 w-5" />}
                label="Discord"
              />
              <SocialLink
                href="https://twitch.tv/pd2ih"
                icon={<TwitchIcon className="h-5 w-5" />}
                label="Twitch"
              />
              <div className="hidden sm:block w-px h-6 bg-border/30 mx-2" />
              <LanguageSelector />
              <div className="hidden lg:block w-px h-6 bg-border/30 mx-2" />
              <div className="hidden lg:flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Powered by
                </span>
                <span className="font-bold text-foreground">
                  PD2IH
                </span>
                <span className="text-xs text-muted-foreground">
                  Polish Dota 2 Inhouse
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SocialLinkProps {
  href: string;
  icon: React.ReactNode;
  label: string;
}

function SocialLink({ href, icon, label }: SocialLinkProps) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg",
        "text-muted-foreground hover:text-foreground",
        "hover:bg-muted/50 transition-all duration-200"
      )}
      title={label}
    >
      {icon}
      <span className="hidden lg:inline text-sm">{label}</span>
    </Link>
  );
}

function LanguageSelector() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg",
          "text-muted-foreground hover:text-foreground",
          "hover:bg-muted/50 transition-all duration-200"
        )}
      >
        <Globe className="h-4 w-4" />
        <span className="text-sm">PL</span>
        <ChevronDown className={cn(
          "h-3 w-3 transition-transform",
          isOpen && "rotate-180"
        )} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "absolute bottom-full right-0 mb-2",
              "bg-card border border-border rounded-lg shadow-lg",
              "overflow-hidden min-w-[120px]"
            )}
          >
            <button
              onClick={() => setIsOpen(false)}
              className={cn(
                "w-full px-4 py-2 text-left text-sm",
                "hover:bg-muted/50 transition-colors",
                "flex items-center gap-2"
              )}
            >
              <span className="text-base">🇵🇱</span>
              <span>Polski</span>
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className={cn(
                "w-full px-4 py-2 text-left text-sm",
                "hover:bg-muted/50 transition-colors",
                "flex items-center gap-2 text-muted-foreground"
              )}
              disabled
            >
              <span className="text-base">🇬🇧</span>
              <span>English</span>
              <span className="text-xs">(soon)</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
