'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  CircleAlert,
  Calendar, 
  UserPlus, 
  GraduationCap,
  CheckCircle,
  ChevronRight,
  Clock,
  Clock3,
  XCircle,
  Gavel
} from 'lucide-react';
import { cn, formatDatePL } from '@/lib/utils';
import { useTournament } from '@/context/TournamentContext';

interface ActionItem {
  id: string;
  type: 'reschedule_request' | 'standin_approval' | 'match_upcoming' | 'coach_deadline' | 'transfer_window' | 'team_pending' | 'team_rejected' | 'draft_penalty';
  title: string;
  description: string;
  urgent?: boolean;
  dueDate?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface PDLCaptainActionsProps {
  isCaptain: boolean;
  actions: ActionItem[];
}

export function PDLCaptainActions({ isCaptain, actions }: PDLCaptainActionsProps) {
  const { theme } = useTournament();
  const [collapsed, setCollapsed] = useState(false);

  if (!isCaptain || actions.length === 0) return null;

  const urgentActions = actions.filter(a => a.urgent);
  const normalActions = actions.filter(a => !a.urgent);

  const getIcon = (type: ActionItem['type']) => {
    switch (type) {
      case 'reschedule_request': return Calendar;
      case 'standin_approval': return UserPlus;
      case 'coach_deadline': return GraduationCap;
      case 'match_upcoming': return Clock;
      case 'transfer_window': return CheckCircle;
      case 'team_pending': return Clock3;
      case 'team_rejected': return XCircle;
      case 'draft_penalty': return Gavel;
      default: return CircleAlert;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between group"
      >
        <div className="flex items-center gap-3">
          <div className="text-left">
            <h3 className="text-xl font-logik-extended-bold tracking-wide uppercase" style={{ color: theme.sectionHeaderColor || '#ffffff', fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined }}>
              Powiadomienia
            </h3>
          </div>
        </div>
        <ChevronRight className={cn(
          'w-5 h-5 text-white/40 transition-transform',
          !collapsed && 'rotate-90'
        )} />
      </button>

      {/* Action List */}
      {!collapsed && (
        <div className="space-y-3">
          {/* Urgent Actions */}
          {urgentActions.map((action) => {
            const Icon = getIcon(action.type);
            return (
              <div
                key={action.id}
                className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg flex-shrink-0" style={{ backgroundColor: `${theme.primaryColor || '#8B1538'}20`, border: `1px solid ${theme.primaryColor || '#8B1538'}40` }}>
                    <Icon className="w-4 h-4" style={{ color: theme.primaryColor || '#8B1538' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-logik-extended-bold text-red-300">
                        {action.title}
                      </p>
                      {action.dueDate && (
                        <span className="text-xs text-red-400 font-logik flex-shrink-0">
                          {formatDatePL(action.dueDate)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed font-medium mt-1" style={{ color: 'var(--tournament-secondary-text)' }}>
                      {action.description}
                    </p>
                  </div>
                </div>
                {action.action && (
                  <Button
                    size="sm"
                    onClick={action.action.onClick}
                    className="w-full text-white font-logik-extended-bold"
                    style={{ backgroundColor: theme.primaryColor || '#8B1538' }}
                  >
                    {action.action.label}
                  </Button>
                )}
              </div>
            );
          })}

          {/* Normal Actions */}
          {normalActions.map((action) => {
            const Icon = getIcon(action.type);
            return (
              <div
                key={action.id}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg flex-shrink-0" style={{ backgroundColor: `${theme.primaryColor || '#8B1538'}20`, border: `1px solid ${theme.primaryColor || '#8B1538'}40` }}>
                    <Icon className="w-4 h-4" style={{ color: theme.primaryColor || '#8B1538' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-logik-extended-bold" style={{ color: theme.sectionHeaderColor || '#ffffff' }}>
                        {action.title}
                      </p>
                      {action.dueDate && (
                        <span className="text-xs font-logik flex-shrink-0" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.4)' }}>
                          {formatDatePL(action.dueDate)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed font-medium mt-1" style={{ color: 'var(--tournament-secondary-text)' }}>
                      {action.description}
                    </p>
                  </div>
                </div>
                {action.action && (
                  <Button
                    size="sm"
                    onClick={action.action.onClick}
                    variant="outline"
                    className="w-full border-white/10 text-white hover:bg-white/5 font-logik-extended-bold"
                  >
                    {action.action.label}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
