"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Shield, CalendarDays, GitFork, ScrollText, HelpCircle, BarChart2, Crown, Users, ClipboardCheck, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Logo } from './Logo';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation } from '@/hooks/useTranslation';
import React from 'react';

export function Navbar() {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [hasMounted, setHasMounted] = React.useState(false);

  const navItems = [
    { href: '/my-team', label: t('nav.register'), icon: Users },
    { href: '/groups', label: t('nav.groups'), icon: LayoutGrid },
    { href: '/teams', label: t('nav.teams'), icon: Shield },
    { href: '/schedule', label: t('nav.schedule'), icon: CalendarDays },
    { href: '/playoffs', label: t('nav.playoffs'), icon: GitFork },
    { href: '/fantasy', label: t('nav.fantasy'), icon: Crown },
    { href: '/pickem', label: t('nav.pickem'), icon: ClipboardCheck },
    { href: '/stats', label: t('nav.stats'), icon: BarChart2 },
    { href: '/rules', label: t('nav.rules'), icon: ScrollText },
    { href: '/faq', label: t('nav.faq'), icon: HelpCircle },
    { href: '/admin', label: 'Admin', icon: Settings }, // Keep admin in English
  ];

  const CustomHamburgerIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="3" y="6" width="18" height="2.5" fill="hsl(var(--primary))" rx="1.25"/>
      <rect x="3" y="11" width="18" height="2.5" fill="hsl(var(--accent))" rx="1.25"/>
      <rect x="3" y="16" width="18" height="2.5" fill="hsl(var(--foreground))" rx="1.25"/>
    </svg>
  );

  React.useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return (
      <header className="bg-card border-b border-border shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <Logo />
          <div className="h-10 w-10 md:w-auto" />
        </div>
      </header>
    );
  }

  if (isMobile) {
    return (
      <header className="bg-card border-b border-border shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <Logo />
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <CustomHamburgerIcon className="h-7 w-7" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] sm:w-[320px] bg-card p-0">
              <SheetHeader className="p-4 border-b border-border">
                <SheetTitle className="flex items-center">
                  <Logo />
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col space-y-2 p-4">
                {navItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                  return (
                    <Button
                      key={item.href}
                      variant="ghost"
                      asChild
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn( "w-full justify-start text-base py-3 px-3", { 'text-primary bg-primary/10': isActive }
                      )}
                    >
                      <Link href={item.href} className="flex items-center space-x-3">
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
    <header className="bg-card border-b border-border shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 flex items-center justify-between">
        <Logo />
        <div className="flex-1 flex justify-center">
            <nav className="flex items-center space-x-2">
                {navItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                const isMyTeam = item.href === '/my-team';
                return (
                    <Button
                      key={item.href}
                      variant="ghost"
                      asChild
                      className={cn(
                        "relative text-sm font-medium shrink-0 px-3 py-2 transition-all duration-200 group",
                        "hover:bg-accent/50",
                        isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                        isMyTeam && isActive && "shadow-sm shadow-secondary/50",
                      )}
                    >
                      <Link href={item.href} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span className="hidden md:inline">{item.label}</span>
                        <span className={cn(
                            "absolute bottom-0 left-0 h-0.5 bg-primary w-full transform scale-x-0 transition-transform duration-300 ease-out group-hover:scale-x-100",
                            isActive && "scale-x-100"
                        )} />
                      </Link>
                    </Button>
                );
                })}
            </nav>
        </div>
      </div>
    </header>
  );
}
