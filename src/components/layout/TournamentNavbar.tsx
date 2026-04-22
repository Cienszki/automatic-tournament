"use client";

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Shield,
  CalendarDays,
  GitFork,
  ScrollText,
  HelpCircle,
  BarChart2,
  Crown,
  Users,
  ClipboardCheck,
  Settings,
  ChevronDown,
  Layers,
  Menu,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTournament, useTournamentType } from '@/context/TournamentContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/context/AuthContext';
import { checkIfAdmin } from '@/lib/auth';
import { getFontFamily } from '@/lib/dynamic-fonts';
import { useHomeNavigation, HOME_VIEW_TO_SECTION } from '@/context/HomeNavigationContext';
import React from 'react';

// ------------------------------------------------------------------
// NavbarSponsor: cycles between two slides with a fade transition
// ------------------------------------------------------------------
interface NavbarSponsorProps {
  sponsorName?: string;
  sponsorImageUrl?: string;
  sponsorUrl?: string;
  secondaryText?: string;
  intervalMs: number;
  widthPx: number;
  fontFamily?: string;
  color?: string;
}

function NavbarSponsor({
  sponsorName,
  sponsorImageUrl,
  sponsorUrl,
  secondaryText,
  intervalMs,
  widthPx,
  fontFamily,
  color,
}: NavbarSponsorProps) {
  const [activeSlide, setActiveSlide] = React.useState(0);
  const [visible, setVisible] = React.useState(true);

  React.useEffect(() => {
    const timer = setInterval(() => {
      // Fade out, switch, fade in
      setVisible(false);
      setTimeout(() => {
        setActiveSlide(prev => (prev === 0 ? 1 : 0));
        setVisible(true);
      }, 300);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  const textStyle: React.CSSProperties = {
    fontFamily,
    color,
    fontSize: '0.75rem',
    lineHeight: '1.2',
  };

  const inner = (
    <div
      className="flex items-center justify-center w-full px-2 transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {activeSlide === 0 ? (
        /* Slide 1: sponsor name + image */
        <div className="flex items-center gap-2 w-full justify-center">
          {sponsorName && (
            <span className="break-words text-center leading-tight" style={textStyle}>
              {sponsorName}
            </span>
          )}
          {sponsorImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sponsorImageUrl}
              alt={sponsorName || 'Sponsor'}
              className="h-9 w-auto max-w-[80px] object-contain shrink-0"
            />
          )}
        </div>
      ) : (
        /* Slide 2: secondary text */
        <span className="break-words text-center leading-tight w-full" style={textStyle}>
          {secondaryText}
        </span>
      )}
    </div>
  );

  if (sponsorUrl) {
    return (
      <a
        href={sponsorUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center overflow-hidden shrink-0 hover:opacity-80 transition-opacity"
        style={{ width: widthPx, height: '100%' }}
      >
        {inner}
      </a>
    );
  }

  return (
    <div
      className="flex items-center justify-center overflow-hidden shrink-0"
      style={{ width: widthPx, height: '100%' }}
    >
      {inner}
    </div>
  );
}



interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  showFor?: 'all' | 'mmr-limited' | 'league';
}

export function TournamentNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { tournament, getTournamentPath, theme } = useTournament();
  const [divisions, setDivisions] = useState<any[]>([]);

  // Load divisions from Firestore for all tournament types
  useEffect(() => {
    if (!tournament?.id) {
      setDivisions([]);
      return;
    }

    let isMounted = true;

    const loadDivisions = async () => {
      try {
        const divisionsRef = collection(db, 'tournaments', tournament.id, 'divisions');
        const snapshot = await getDocs(divisionsRef);
        
        if (!isMounted) return;
        
        const divisionsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Array<{ id: string; tier?: number; [key: string]: unknown }>;
        
        // Sort by tier on client side
        divisionsData.sort((a, b) => (a.tier || 999) - (b.tier || 999));
        setDivisions(divisionsData);
      } catch (error) {
        console.error('Error loading divisions:', error);
        if (isMounted) {
          setDivisions([]);
        }
      }
    };

    loadDivisions();
    
    return () => {
      isMounted = false;
    };
  }, [tournament?.id, tournament?.type]);

  // Check if playoffs should be visible — driven by admin toggle on tournament config
  const playoffsStarted = !!(tournament?.playoffs?.enabled && tournament?.playoffs?.playoffsVisible);

  const { isLeague, isMmrLimited } = useTournamentType();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [hasMounted, setHasMounted] = React.useState(false);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [hasTeam, setHasTeam] = React.useState(false);
  const { goToHomeSection, isHomeActive, goToGroup } = useHomeNavigation();

  React.useEffect(() => {
    setHasMounted(true);
  }, []);

  React.useEffect(() => {
    async function verifyAdmin() {
      if (user && tournament?.id) {
        const adminStatus = await checkIfAdmin(user, tournament.id);
        setIsAdmin(adminStatus);
      } else {
        setIsAdmin(false);
      }
    }
    verifyAdmin();
  }, [user, tournament?.id]);

  // Check if the current user is a team captain
  React.useEffect(() => {
    async function checkCaptain() {
      if (!user || !tournament?.id) { setHasTeam(false); return; }
      try {
        const teamsRef = tournament.type === 'league'
          ? collection(db, 'tournaments', tournament.id, 'teams')
          : collection(db, 'teams');
        const q = query(teamsRef, where('captainId', '==', user.uid));
        const snap = await getDocs(q);
        setHasTeam(!snap.empty);
      } catch {
        setHasTeam(false);
      }
    }
    checkCaptain();
  }, [user, tournament?.id, tournament?.type]);

  if (!tournament) {
    return null;
  }

  // Navigation items - some are tournament-type specific
  const navItems: NavItem[] = [
    { href: '/my-team', label: 'Moja drużyna', icon: Users, showFor: 'all' },
    // Divisions - shown for all tournament types (used in mobile remaining items)
    { href: '/divisions', label: 'Dywizje', icon: Layers, showFor: 'all' },
    // Common page links
    { href: '/teams', label: 'Drużyny', icon: Shield, showFor: 'all' },
    { href: '/schedule', label: 'Terminarz', icon: CalendarDays, showFor: 'all' },
    { href: '/playoffs', label: 'Playoffs', icon: GitFork, showFor: 'all' },
    { href: '/fantasy', label: 'Fantasy', icon: Crown, showFor: 'all' },
    { href: '/pickem', label: 'Pick\'em', icon: ClipboardCheck, showFor: 'all' },
    { href: '/stats', label: 'Statystyki', icon: BarChart2, showFor: 'all' },
    { href: '/rules', label: 'Regulamin', icon: ScrollText, showFor: 'all' },
    { href: '/faq', label: 'FAQ', icon: HelpCircle, showFor: 'all' },
    { href: '/admin', label: 'Admin', icon: Settings, showFor: 'all' },
  ];

  // Filter nav items based on tournament type
  const filteredNavItems = navItems.filter(item =>
    item.showFor === 'all' ||
    (item.showFor === 'league' && isLeague) ||
    (item.showFor === 'mmr-limited' && !isLeague)
  );

  const isActive = (href: string) => {
    const fullPath = getTournamentPath(href);
    if (href === '') {
      return pathname === fullPath;
    }
    return pathname.startsWith(fullPath);
  };

  // Navigate to a homepage section, or push to homepage with ?view= param
  const handleViewNavigation = (viewKey: string) => {
    const sectionIndex = HOME_VIEW_TO_SECTION[viewKey] ?? 0;
    if (isHomeActive()) {
      goToHomeSection(sectionIndex);
    } else {
      router.push(`${getTournamentPath('')}?view=${viewKey}`);
    }
  };

  // Navigate to an individual group/division inline on the homepage
  const handleGroupNavigation = (divisionId: string) => {
    if (isHomeActive()) {
      goToGroup(divisionId);
    } else {
      router.push(`${getTournamentPath('')}?view=groups&group=${divisionId}`);
    }
  };

  // Compute navbar background style from theme settings.
  // Prefer an explicit navbarColor; fall back to cardColor; then to a
  // semi-transparent black so the backdrop-blur has something to tint.
  const navBg = theme?.navbarColor || theme?.cardColor || 'rgba(0,0,0,0.6)';
  // Default opacity per mode: transparent=0, blur=80, solid=100
  const defaultOpacity = theme?.navbarStyle === 'transparent' ? 0
    : theme?.navbarStyle === 'blur' ? 80
    : 100;
  const navbarOpacity = theme?.navbarOpacity ?? defaultOpacity;
  const navbarBlurPx = theme?.navbarBlur ?? 12;
  const navTextColor = theme?.navbarTextColor || undefined;
  const navbarFontFamily = (theme?.navbarFont && theme.navbarFont !== 'default')
    ? getFontFamily(theme.navbarFont, (tournament?.customFonts as Array<{ id: string; family: string }> | undefined) || [])
    : 'var(--font-logik)';
  const getColorWithOpacity = (color: string, opacityPct: number): string => {
    if (opacityPct <= 0) return 'transparent';
    const alpha = opacityPct / 100;
    // #RRGGBB
    if (/^#[0-9a-fA-F]{6}$/.test(color)) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    // #RRGGBBAA
    if (/^#[0-9a-fA-F]{8}$/.test(color)) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    // hsl(h s% l%) modern syntax
    if (color.startsWith('hsl(') && !color.includes(',')) {
      return `hsl(${color.slice(4, -1)} / ${alpha})`;
    }
    // hsl(h, s%, l%) legacy syntax → hsla
    if (color.startsWith('hsl(')) {
      return `hsla(${color.slice(4, -1)}, ${alpha})`;
    }
    // rgba(r, g, b, a) — replace the existing alpha channel
    if (color.startsWith('rgba(')) {
      const parts = color.match(/[\d.]+/g);
      if (parts && parts.length >= 3) {
        return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
      }
    }
    // rgb(r, g, b)
    if (color.startsWith('rgb(')) {
      return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
    }
    // Fallback: return with opacity via color-mix if nothing else matched
    if (opacityPct >= 100) return color;
    return color;
  };
  const isBlurStyle = theme?.navbarStyle === 'blur';
  const navbarStyleAttr: React.CSSProperties = {
    backgroundColor: getColorWithOpacity(navBg, navbarOpacity),
    backdropFilter: isBlurStyle ? `blur(${navbarBlurPx}px)` : undefined,
    // Safari requires the -webkit- prefix for backdrop-filter
    WebkitBackdropFilter: isBlurStyle ? `blur(${navbarBlurPx}px)` : undefined,
    fontFamily: navbarFontFamily,
  };

  // Logo component
  const LogoWithSwitcher = () => (
    <div className="flex items-center gap-2">
      {/* PD2IH / organizer Logo link to landing page */}
      <Link href="/" className="self-stretch flex items-center">
        <Image
          src={theme?.organizerLogoUrl || '/logos/pd2ih/pd2ih-logo.png'}
          alt="PD2IH"
          width={40}
          height={40}
          priority
          unoptimized
          className="h-10 w-auto max-w-[80px] object-contain"
        />
      </Link>

      {/* Tournament Inline Logo */}
      <button
        onClick={() => {
          if (isHomeActive()) {
            goToHomeSection(0);
          } else {
            router.push(getTournamentPath(''));
          }
        }}
        className="flex items-center self-stretch px-1 cursor-pointer"
      >
        <Image
          src={theme.inlineLogoUrl || '/logos/pdl/pdl-text.png'}
          alt={tournament?.name || 'Tournament'}
          height={80}
          width={200}
          priority
          className="object-contain"
        />
      </button>
    </div>
  );

  // Initial render before hydration
  if (!hasMounted) {
    return (
      <header
        className="border-b shadow-sm sticky top-0 z-50"
        style={{
          ...navbarStyleAttr,
          borderColor: theme.borderColor,
        }}
      >
        <div className="container mx-auto px-4 flex items-stretch justify-between h-14">
          <LogoWithSwitcher />
          <div className="h-10 w-10" />
        </div>
      </header>
    );
  }

  // Mobile navigation
  if (isMobile) {
    return (
      <header
        className="border-b shadow-sm sticky top-0 z-50"
        style={{
          ...navbarStyleAttr,
          borderColor: theme.borderColor,
        }}
      >
        <div className="container mx-auto px-4 flex items-stretch justify-between h-14">
          <LogoWithSwitcher />
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="self-stretch h-auto w-10 rounded-none">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Otwórz menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[280px] sm:w-[320px] p-0"
              style={{ backgroundColor: theme.cardColor }}
            >
              <SheetHeader className="p-4 border-b" style={{ borderColor: theme.borderColor }}>
                <SheetTitle className="flex items-center">
                  <LogoWithSwitcher />
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col space-y-1 p-4">
                {/* Groups / Divisions */}
                {(() => {
                  const groupsLabel = isMmrLimited ? 'Grupy' : 'Dywizje';
                  return (
                    <Button
                      variant="ghost"
                      onClick={() => { handleViewNavigation('groups'); setIsMobileMenuOpen(false); }}
                      className="w-full justify-start text-base py-3 px-3"
                      style={{ color: navTextColor }}
                    >
                      <Layers className="h-5 w-5 mr-3" />
                      <span>{groupsLabel}</span>
                    </Button>
                  );
                })()}

                {/* Teams */}
                <Button
                  variant="ghost"
                  onClick={() => { handleViewNavigation('teams'); setIsMobileMenuOpen(false); }}
                  className="w-full justify-start text-base py-3 px-3"
                  style={{ color: navTextColor }}
                >
                  <Shield className="h-5 w-5 mr-3" />
                  <span>Drużyny</span>
                </Button>

                {/* Schedule */}
                <Button
                  variant="ghost"
                  onClick={() => { handleViewNavigation('schedule'); setIsMobileMenuOpen(false); }}
                  className="w-full justify-start text-base py-3 px-3"
                  style={{ color: navTextColor }}
                >
                  <CalendarDays className="h-5 w-5 mr-3" />
                  <span>Terminarz</span>
                </Button>

                {/* Playoffs — only when started */}
                {playoffsStarted && (
                  <Button
                    variant="ghost"
                    onClick={() => { handleViewNavigation('playoffs'); setIsMobileMenuOpen(false); }}
                    className="w-full justify-start text-base py-3 px-3"
                    style={{ color: navTextColor }}
                  >
                    <GitFork className="h-5 w-5 mr-3" />
                    <span>Playoffs</span>
                  </Button>
                )}

                {/* Stats */}
                <Button
                  variant="ghost"
                  onClick={() => { handleViewNavigation('stats'); setIsMobileMenuOpen(false); }}
                  className="w-full justify-start text-base py-3 px-3"
                  style={{ color: navTextColor }}
                >
                  <BarChart2 className="h-5 w-5 mr-3" />
                  <span>Statystyki</span>
                </Button>

                {/* My Team — only for captains */}
                {hasTeam && (
                  <Button
                    variant="ghost"
                    onClick={() => { handleViewNavigation('my-team'); setIsMobileMenuOpen(false); }}
                    className="w-full justify-start text-base py-3 px-3"
                    style={{ color: navTextColor }}
                  >
                    <Users className="h-5 w-5 mr-3" />
                    <span>Moja drużyna</span>
                  </Button>
                )}

                {/* Remaining page links */}
                {filteredNavItems
                  .filter(item => !['/divisions', '/groups', '/teams', '/schedule', '/playoffs', '/stats', '/my-team'].includes(item.href))
                  .map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Button
                        key={item.href}
                        variant="ghost"
                        asChild
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={cn(
                          "w-full justify-start text-base py-3 px-3",
                          active && "bg-primary/10",
                        )}
                        style={{ color: active ? theme.primaryColor : navTextColor }}
                      >
                        <Link href={getTournamentPath(item.href)} className="flex items-center space-x-3">
                          <item.icon className="h-5 w-5" />
                          <span>{item.label}</span>
                        </Link>
                      </Button>
                    );
                  })}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>
    );
  }

  // Desktop navigation
  return (
    <header
      className="border-b shadow-sm sticky top-0 z-50"
      style={{
        ...navbarStyleAttr,
        borderColor: theme.borderColor,
      }}
    >
      <div className="container mx-auto px-4 flex items-stretch h-14">
        <LogoWithSwitcher />
        <div className="flex-1 flex justify-center">
          <nav className="flex items-stretch space-x-1">

            {/* ── Groups / Divisions — split button ─────────────── */}
            {(() => {
              const isGroupsActive = isActive('/divisions') || isActive('/groups');
              const groupsLabel = isMmrLimited ? 'Grupy' : 'Dywizje';
              const textStyle = {
                color: isGroupsActive ? theme.primaryColor : navTextColor,
                '--nav-hover-bg': getColorWithOpacity(theme.primaryColor, 10),
                '--nav-hover-text': theme.primaryColor,
              } as React.CSSProperties;
              return (
                <div key="divisions-split" className="relative flex items-stretch">
                  {/* Text/icon part — navigates to groups/divisions section */}
                  <button
                    onClick={() => handleViewNavigation('groups')}
                    onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); window.open(`${getTournamentPath('')}?view=groups`, '_blank'); } }}
                    className={cn(
                      "relative text-sm font-medium shrink-0 pl-3 pr-1 py-2 transition-all duration-200 group flex items-center gap-2",
                      "hover:text-[var(--nav-hover-text)]",
                      "focus-visible:outline-none focus-visible:ring-0",
                      !isGroupsActive && "text-muted-foreground",
                    )}
                    style={textStyle}
                  >
                    <Layers className="h-4 w-4" />
                    <span className="hidden lg:inline">{groupsLabel}</span>
                    <span
                      className={cn(
                        "absolute bottom-2 left-0 h-0.5 w-full transform transition-transform duration-300 ease-out",
                        isGroupsActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
                      )}
                      style={{ backgroundColor: theme.primaryColor }}
                    />
                  </button>

                  {/* Chevron part — opens dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={cn(
                          "text-sm font-medium shrink-0 px-1 py-2 transition-all duration-200 flex items-center",
                          "hover:text-[var(--nav-hover-text)]",
                          "focus-visible:outline-none focus-visible:ring-0",
                          !isGroupsActive && "text-muted-foreground",
                        )}
                        style={textStyle}
                        aria-label="Otwórz listę grup/dywizji"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="center"
                      className="w-48 border"
                      style={{
                        ...navbarStyleAttr,
                        borderColor: theme.borderColor,
                        color: navTextColor || undefined,
                      }}
                    >
                      {divisions.length > 0 ? (
                        divisions.map(division => (
                          <DropdownMenuItem
                            key={division.id}
                            className="cursor-pointer focus:bg-white/10 flex items-center gap-2"
                            style={{ color: (division as any).color || navTextColor || undefined }}
                            onSelect={() => {
                              handleGroupNavigation(division.id);
                              setIsMobileMenuOpen(false);
                            }}
                          >
                            <Layers className="h-4 w-4" />
                            {division.name}
                          </DropdownMenuItem>
                        ))
                      ) : (
                        <DropdownMenuItem disabled style={{ color: navTextColor || undefined }}>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Ładowanie...
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })()}

            {/* ── Playoffs — only when started ──────────────────── */}
            {playoffsStarted && (() => {
              const active = isActive('/playoffs');
              return (
                <button
                  key="playoffs"
                  onClick={() => handleViewNavigation('playoffs')}
                  onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); window.open(`${getTournamentPath('')}?view=playoffs`, '_blank'); } }}
                  className={cn(
                    "relative text-sm font-medium shrink-0 px-3 py-2 transition-all duration-200 group flex items-center gap-2",
                    "hover:bg-[var(--nav-hover-bg)] hover:text-[var(--nav-hover-text)]",
                    "focus-visible:outline-none focus-visible:ring-0",
                    !active && "text-muted-foreground",
                  )}
                  style={{
                    color: active ? theme.primaryColor : navTextColor,
                    '--nav-hover-bg': getColorWithOpacity(theme.primaryColor, 10),
                    '--nav-hover-text': theme.primaryColor,
                  } as React.CSSProperties}
                >
                  <GitFork className="h-4 w-4" />
                  <span className="hidden lg:inline">Playoffs</span>
                  <span
                    className={cn(
                      "absolute bottom-2 left-0 h-0.5 w-full transform transition-transform duration-300 ease-out",
                      active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
                    )}
                    style={{ backgroundColor: theme.primaryColor }}
                  />
                </button>
              );
            })()}

            {/* ── Schedule ──────────────────────────────────────── */}
            {(() => {
              const active = isActive('/schedule');
              return (
                <button
                  key="schedule"
                  onClick={() => handleViewNavigation('schedule')}
                  onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); window.open(`${getTournamentPath('')}?view=schedule`, '_blank'); } }}
                  className={cn(
                    "relative text-sm font-medium shrink-0 px-3 py-2 transition-all duration-200 group flex items-center gap-2",
                    "hover:bg-[var(--nav-hover-bg)] hover:text-[var(--nav-hover-text)]",
                    "focus-visible:outline-none focus-visible:ring-0",
                    !active && "text-muted-foreground",
                  )}
                  style={{
                    color: active ? theme.primaryColor : navTextColor,
                    '--nav-hover-bg': getColorWithOpacity(theme.primaryColor, 10),
                    '--nav-hover-text': theme.primaryColor,
                  } as React.CSSProperties}
                >
                  <CalendarDays className="h-4 w-4" />
                  <span className="hidden lg:inline">Terminarz</span>
                  <span
                    className={cn(
                      "absolute bottom-2 left-0 h-0.5 w-full transform transition-transform duration-300 ease-out",
                      active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
                    )}
                    style={{ backgroundColor: theme.primaryColor }}
                  />
                </button>
              );
            })()}

            {/* ── Teams ─────────────────────────────────────────── */}
            {(() => {
              const active = isActive('/teams');
              return (
                <button
                  key="teams"
                  onClick={() => handleViewNavigation('teams')}
                  onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); window.open(`${getTournamentPath('')}?view=teams`, '_blank'); } }}
                  className={cn(
                    "relative text-sm font-medium shrink-0 px-3 py-2 transition-all duration-200 group flex items-center gap-2",
                    "hover:bg-[var(--nav-hover-bg)] hover:text-[var(--nav-hover-text)]",
                    "focus-visible:outline-none focus-visible:ring-0",
                    !active && "text-muted-foreground",
                  )}
                  style={{
                    color: active ? theme.primaryColor : navTextColor,
                    '--nav-hover-bg': getColorWithOpacity(theme.primaryColor, 10),
                    '--nav-hover-text': theme.primaryColor,
                  } as React.CSSProperties}
                >
                  <Shield className="h-4 w-4" />
                  <span className="hidden lg:inline">Drużyny</span>
                  <span
                    className={cn(
                      "absolute bottom-2 left-0 h-0.5 w-full transform transition-transform duration-300 ease-out",
                      active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
                    )}
                    style={{ backgroundColor: theme.primaryColor }}
                  />
                </button>
              );
            })()}

            {/* ── Stats ─────────────────────────────────────────── */}
            {(() => {
              const active = isActive('/stats');
              return (
                <button
                  key="stats"
                  onClick={() => handleViewNavigation('stats')}
                  onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); window.open(`${getTournamentPath('')}?view=stats`, '_blank'); } }}
                  className={cn(
                    "relative text-sm font-medium shrink-0 px-3 py-2 transition-all duration-200 group flex items-center gap-2",
                    "hover:bg-[var(--nav-hover-bg)] hover:text-[var(--nav-hover-text)]",
                    "focus-visible:outline-none focus-visible:ring-0",
                    !active && "text-muted-foreground",
                  )}
                  style={{
                    color: active ? theme.primaryColor : navTextColor,
                    '--nav-hover-bg': getColorWithOpacity(theme.primaryColor, 10),
                    '--nav-hover-text': theme.primaryColor,
                  } as React.CSSProperties}
                >
                  <BarChart2 className="h-4 w-4" />
                  <span className="hidden lg:inline">Statystyki</span>
                  <span
                    className={cn(
                      "absolute bottom-2 left-0 h-0.5 w-full transform transition-transform duration-300 ease-out",
                      active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
                    )}
                    style={{ backgroundColor: theme.primaryColor }}
                  />
                </button>
              );
            })()}

            {/* ── My Team — only for captains ───────────────────── */}
            {/* ── Rules — full-page link ────────────────────────── */}
            {(() => {
              const active = isActive('/rules');
              return (
                <a
                  key="rules"
                  href={getTournamentPath('/rules')}
                  className={cn(
                    "relative text-sm font-medium shrink-0 px-3 py-2 transition-all duration-200 group flex items-center gap-2",
                    "hover:bg-[var(--nav-hover-bg)] hover:text-[var(--nav-hover-text)]",
                    "focus-visible:outline-none focus-visible:ring-0",
                    !active && "text-muted-foreground",
                  )}
                  style={{
                    color: active ? theme.primaryColor : navTextColor,
                    '--nav-hover-bg': getColorWithOpacity(theme.primaryColor, 10),
                    '--nav-hover-text': theme.primaryColor,
                  } as React.CSSProperties}
                >
                  <ScrollText className="h-4 w-4" />
                  <span className="hidden lg:inline">Regulamin</span>
                  <span
                    className={cn(
                      "absolute bottom-2 left-0 h-0.5 w-full transform transition-transform duration-300 ease-out",
                      active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
                    )}
                    style={{ backgroundColor: theme.primaryColor }}
                  />
                </a>
              );
            })()}

          </nav>
        </div>
        {/* Admin button on the right - only shown if user is admin */}
        {isAdmin && (
          <Button
            variant="ghost"
            asChild
            className={cn(
              "text-sm font-medium px-3 h-auto self-stretch rounded-none",
              "hover:bg-[#cf2648]/10 hover:text-[#cf2648]",
              !isActive('/admin') && "text-muted-foreground"
            )}
            style={{ color: isActive('/admin') ? theme.primaryColor : navTextColor }}
          >
            <Link href={getTournamentPath('/admin')} className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden lg:inline">Admin</span>
            </Link>
          </Button>
        )}
        {/* Navbar sponsor section - shown to all users when enabled */}
        {tournament.navbarSponsor?.enabled && (
          <NavbarSponsor
            sponsorName={tournament.navbarSponsor.sponsorName}
            sponsorImageUrl={tournament.navbarSponsor.sponsorImageUrl}
            sponsorUrl={tournament.navbarSponsor.sponsorUrl}
            secondaryText={tournament.navbarSponsor.secondaryText}
            intervalMs={tournament.navbarSponsor.intervalMs ?? 5000}
            widthPx={tournament.navbarSponsor.widthPx ?? 200}
            fontFamily={navbarFontFamily}
            color={navTextColor}
          />
        )}
      </div>
    </header>
  );
}
