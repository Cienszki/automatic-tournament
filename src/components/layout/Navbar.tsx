
"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, UserPlus, LayoutGrid, Shield, CalendarDays, GitFork, ScrollText, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Logo } from './Logo';

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/register', label: 'Register', icon: UserPlus },
  { href: '/groups', label: 'Group Stage', icon: LayoutGrid },
  { href: '/teams', label: 'Teams', icon: Shield },
  { href: '/schedule', label: 'Schedule', icon: CalendarDays },
  { href: '/playoffs', label: 'Playoffs', icon: GitFork },
  { href: '/rules', label: 'Rules', icon: ScrollText },
  { href: '/faq', label: 'FAQ', icon: HelpCircle },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="bg-card border-b border-border shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Logo />
        <nav className="flex items-center space-x-1 md:space-x-2 overflow-x-auto pb-2 md:pb-0">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Button
                key={item.href}
                variant="ghost"
                asChild
                className={cn(
                  "text-sm font-medium px-2 py-1 md:px-3 md:py-2 shrink-0",
                  isActive ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                )}
              >
                <Link href={item.href} className="flex items-center space-x-2">
                  <item.icon className="h-4 w-4" />
                  <span className="hidden md:inline">{item.label}</span>
                </Link>
              </Button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
