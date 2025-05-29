
"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserPlus, LayoutGrid, Shield, CalendarDays, GitFork, ScrollText, HelpCircle, BarChart2, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Logo } from './Logo';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import React from 'react';

const navItems = [
  { href: '/register', label: 'Register', icon: UserPlus },
  { href: '/groups', label: 'Group Stage', icon: LayoutGrid },
  { href: '/teams', label: 'Teams', icon: Shield },
  { href: '/schedule', label: 'Schedule', icon: CalendarDays },
  { href: '/playoffs', label: 'Playoffs', icon: GitFork },
  { href: '/stats', label: 'Stats', icon: BarChart2 },
  { href: '/rules', label: 'Rules', icon: ScrollText },
  { href: '/faq', label: 'FAQ', icon: HelpCircle },
];

const LeftBracket = () => (
  <svg width="8" height="24" viewBox="0 0 8 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-[1.25em] text-primary">
    <path d="M7 1C7 1 1 5.58172 1 12C1 18.4183 7 23 7 23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const RightBracket = () => (
  <svg width="8" height="24" viewBox="0 0 8 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-[1.25em] text-primary">
    <path d="M1 1C1 1 7 5.58172 7 12C7 18.4183 1 23 1 23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

export function Navbar() {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  if (isMobile) {
    return (
      <header className="bg-card border-b border-border shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Logo />
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] sm:w-[320px] bg-card p-0">
              <SheetHeader className="p-4 border-b border-border">
                <SheetTitle className="flex items-center justify-between">
                  <Logo />
                   <SheetClose asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <X className="h-5 w-5" />
                      <span className="sr-only">Close menu</span>
                    </Button>
                  </SheetClose>
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
                      className={cn(
                        "w-full justify-start text-base py-3 px-3",
                        isActive ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
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

  return (
    <header className="bg-card border-b border-border shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Logo />
        <div className="flex items-center space-x-1 md:space-x-2">
          <nav className="flex items-center space-x-1 md:space-x-2 overflow-x-auto pb-2 md:pb-0">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Button
                  key={item.href}
                  variant="ghost"
                  asChild
                  className={cn(
                    "text-sm font-medium shrink-0",
                    isActive 
                      ? 'text-primary bg-primary/10 px-1' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50 px-2 py-1 md:px-3 md:py-2',
                  )}
                >
                  <Link 
                    href={item.href} 
                    className={cn(
                      "flex items-center",
                      isActive ? 'gap-1 px-1.5 md:px-2 py-1 md:py-2' : 'space-x-2 px-2 py-1 md:px-3 md:py-2'
                    )}
                  >
                    {isActive && <LeftBracket />}
                    <div className={cn("flex items-center", isActive ? "gap-1.5 md:gap-2" : "gap-2")}>
                      <item.icon className="h-4 w-4" />
                      <span className="hidden md:inline">{item.label}</span>
                    </div>
                    {isActive && <RightBracket />}
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
