'use client';

import { Clock, XCircle, AlertTriangle, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TeamStatus } from '@/lib/definitions';

interface RegistrationStatusBannerProps {
  status: TeamStatus;
}

type StatusConfig = {
  icon: React.ElementType;
  title: string;
  description: string;
  borderClass: string;
  bgClass: string;
  iconClass: string;
  dotClass: string;
};

const STATUS_CONFIG: Partial<Record<TeamStatus, StatusConfig>> = {
  pending: {
    icon: Clock,
    title: 'Oczekuje na weryfikację',
    description:
      'Zgłoszenie zostało wysłane i czeka na akceptację administratora turnieju. Nie ma potrzeby kontaktować się przez Discord — zostaniesz powiadomiony o decyzji.',
    borderClass: 'border-yellow-500/30',
    bgClass: 'bg-yellow-500/8',
    iconClass: 'text-yellow-400',
    dotClass: 'bg-yellow-400',
  },
  rejected: {
    icon: XCircle,
    title: 'Drużyna odrzucona',
    description:
      'Zgłoszenie zostało odrzucone przez administratora turnieju. Skontaktuj się z administracją przez Discord, aby wyjaśnić sytuację i ewentualnie ponownie złożyć zgłoszenie.',
    borderClass: 'border-red-500/30',
    bgClass: 'bg-red-500/8',
    iconClass: 'text-red-400',
    dotClass: 'bg-red-400',
  },
  warning: {
    icon: AlertTriangle,
    title: 'Ostrzeżenie',
    description:
      'Drużyna otrzymała ostrzeżenie od administratora turnieju. Sprawdź wiadomości i skontaktuj się z administracją.',
    borderClass: 'border-orange-500/30',
    bgClass: 'bg-orange-500/8',
    iconClass: 'text-orange-400',
    dotClass: 'bg-orange-400',
  },
  banned: {
    icon: Ban,
    title: 'Drużyna zbanowana',
    description:
      'Drużyna została wykluczona z turnieju. Skontaktuj się z administracją, aby uzyskać więcej informacji.',
    borderClass: 'border-red-900/40',
    bgClass: 'bg-red-900/10',
    iconClass: 'text-red-600',
    dotClass: 'bg-red-600',
  },
  // 'eliminated' is a gameplay state, not a registration state — no banner needed
};

export function RegistrationStatusBanner({ status }: RegistrationStatusBannerProps) {
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return null;

  const Icon = cfg.icon;

  return (
    <div
      className={cn(
        'rounded-xl border p-4 flex items-start gap-4',
        cfg.borderClass,
        cfg.bgClass,
      )}
    >
      {/* Pulsing dot for pending */}
      {status === 'pending' && (
        <span className="relative mt-1 flex-shrink-0">
          <span className={cn('absolute inline-flex h-3 w-3 rounded-full opacity-60 animate-ping', cfg.dotClass)} />
          <span className={cn('relative inline-flex h-3 w-3 rounded-full', cfg.dotClass)} />
        </span>
      )}

      {/* Icon for non-pending statuses */}
      {status !== 'pending' && (
        <div className={cn('p-1.5 rounded-lg bg-white/5 flex-shrink-0', cfg.iconClass)}>
          <Icon className="w-4 h-4" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className={cn('font-logik-extended-bold text-sm uppercase tracking-widest', cfg.iconClass)}>
          {cfg.title}
        </p>
        <p className="text-sm font-logik mt-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {cfg.description}
        </p>
      </div>
    </div>
  );
}
