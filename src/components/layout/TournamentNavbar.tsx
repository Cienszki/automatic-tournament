"use client";

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  LayoutGrid,
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
import React from 'react';



interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  showFor?: 'all' | 'mmr-limited' | 'league';
}

export function TournamentNavbar() {
  const pathname = usePathname();
  const { tournament, getTournamentPath, theme } = useTournament();
  const [divisions, setDivisions] = useState<any[]>([]);

  // Load divisions from Firestore for league tournaments
  useEffect(() => {
    if (!tournament?.id || tournament.type !== 'league') {
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
  const { isLeague } = useTournamentType();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [hasMounted, setHasMounted] = React.useState(false);
  const [isAdmin, setIsAdmin] = React.useState(false);

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

  if (!tournament) {
    return null;
  }

  // Navigation items - some are tournament-type specific
  const navItems: NavItem[] = [
    { href: '/my-team', label: 'Moja drużyna', icon: Users, showFor: 'all' },
    // MMR tournament specific
    { href: '/groups', label: 'Grupy', icon: LayoutGrid, showFor: 'mmr-limited' },
    // League specific
    { href: '/divisions', label: 'Dywizje', icon: Layers, showFor: 'league' },
    // Common
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

  // For desktop navbar, only show specific items
  const desktopNavItems = filteredNavItems.filter(item =>
    ['/divisions', '/teams', '/schedule', '/playoffs', '/stats', '/news', '/rules'].includes(item.href)
  );

  const isActive = (href: string) => {
    const fullPath = getTournamentPath(href);
    if (href === '') {
      return pathname === fullPath;
    }
    return pathname.startsWith(fullPath);
  };

  // Logo component
  const LogoWithSwitcher = () => (
    <div className="flex items-center gap-2">
      {/* PD2IH Logo link to landing page */}
      <Link href="/" className="flex items-center">
        <Image
          src="/logos/pd2ih/pd2ih-logo.png"
          alt="PD2IH"
          width={80}
          height={80}
          priority
          className="object-contain"
        />
      </Link>

      {/* PDL Inline Logo */}
      <Link href={getTournamentPath('')} className="flex items-center">
        <Image
          src="/logos/pdl/pdl-text.png"
          alt="PDL"
          height={80}
          width={200}
          priority
          className="object-contain"
        />
      </Link>
    </div>
  );

  // Initial render before hydration
  if (!hasMounted) {
    return (
      <header
        className="border-b shadow-sm sticky top-0 z-50 font-logik"
        style={{
          backgroundColor: theme.cardColor,
          borderColor: theme.borderColor,
        }}
      >
        <div className="container mx-auto px-4 flex items-center justify-between h-14">
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
        className="border-b shadow-sm sticky top-0 z-50 font-logik"
        style={{
          backgroundColor: theme.cardColor,
          borderColor: theme.borderColor,
        }}
      >
        <div className="container mx-auto px-4 flex items-center justify-between h-14">
          <LogoWithSwitcher />
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
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
                {filteredNavItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Button
                      key={item.href}
                      variant="ghost"
                      asChild
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        "w-full justify-start text-base py-3 px-3",
                        active && "bg-primary/10"
                      )}
                      style={{ color: active ? theme.primaryColor : undefined }}
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
      className="border-b shadow-sm sticky top-0 z-50 bg-background border-border font-logik"
    >
      <div className="container mx-auto px-4 flex items-center h-14">
        <LogoWithSwitcher />
        <div className="flex-1 flex justify-center">
          <nav className="flex items-center space-x-1">
            {desktopNavItems.map((item) => {
              // Special handling for Divisions dropdown
              if (item.href === '/divisions' && isLeague && tournament.type === 'league') {
                const active = isActive('/divisions');
                return (
                  <DropdownMenu key={item.href}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className={cn(
                          "relative text-sm font-medium shrink-0 px-3 py-2 transition-all duration-200 group",
                          "hover:bg-[#cf2648]/10 hover:text-[#cf2648]",
                          "focus-visible:outline-none focus-visible:ring-0",
                          !active && "text-muted-foreground"
                        )}
                        style={{ color: active ? theme.primaryColor : undefined }}
                      >
                        <item.icon className="h-4 w-4" />
                        <span className="hidden lg:inline">{item.label}</span>
                        <ChevronDown className="h-3 w-3 ml-1" />
                        <span
                          className={cn(
                            "absolute bottom-0 left-0 h-0.5 w-full transform transition-transform duration-300 ease-out",
                            active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                          )}
                          style={{ backgroundColor: theme.primaryColor }}
                        />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" className="w-48 font-logik">
                      {divisions.length > 0 ? (
                        divisions.map(division => (
                          <DropdownMenuItem 
                            key={division.id} 
                            asChild
                            className="hover:bg-[#cf2648]/10 hover:text-[#cf2648] focus:bg-[#cf2648]/10 focus:text-[#cf2648]"
                          >
                            <Link href={getTournamentPath(`/divisions/${division.id}`)} className="flex items-center gap-2 cursor-pointer">
                              <Layers className="h-4 w-4" />
                              {division.name}
                            </Link>
                          </DropdownMenuItem>
                        ))
                      ) : (
                        <DropdownMenuItem disabled className="text-muted-foreground">
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Ładowanie...
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              }
              
              // Regular nav item
              const active = isActive(item.href);
              return (
                <Button
                  key={item.href}
                  variant="ghost"
                  asChild
                  className={cn(
                    "relative text-sm font-medium shrink-0 px-3 py-2 transition-all duration-200 group",
                    "hover:bg-[#cf2648]/10 hover:text-[#cf2648]",
                    !active && "text-muted-foreground"
                  )}
                  style={{ color: active ? theme.primaryColor : undefined }}
                >
                  <Link href={getTournamentPath(item.href)} className="flex items-center gap-2">
                    <item.icon className="h-4 w-4" />
                    <span className="hidden lg:inline">{item.label}</span>
                    <span
                      className={cn(
                        "absolute bottom-0 left-0 h-0.5 w-full transform transition-transform duration-300 ease-out",
                        active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                      )}
                      style={{ backgroundColor: theme.primaryColor }}
                    />
                  </Link>
                </Button>
              );
            })}
          </nav>
        </div>
        {/* Admin button on the right - only shown if user is admin */}
        {isAdmin && (
          <Button
            variant="ghost"
            asChild
            className={cn(
              "text-sm font-medium px-3 py-2",
              "hover:bg-[#cf2648]/10 hover:text-[#cf2648]",
              !isActive('/admin') && "text-muted-foreground"
            )}
            style={{ color: isActive('/admin') ? theme.primaryColor : undefined }}
          >
            <Link href={getTournamentPath('/admin')} className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden lg:inline">Admin</span>
            </Link>
          </Button>
        )}
      </div>
    </header>
  );
}
