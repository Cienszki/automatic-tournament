'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  AlertCircle, 
  Calendar, 
  UserPlus, 
  GraduationCap,
  CheckCircle,
  ChevronRight,
  Clock
} from 'lucide-react';
import { cn, formatDatePL } from '@/lib/utils';

interface ActionItem {
  id: string;
  type: 'reschedule_request' | 'standin_approval' | 'match_upcoming' | 'coach_deadline' | 'transfer_window';
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
      default: return AlertCircle;
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
          <div className="p-2 rounded-lg bg-pdl-crimson/20 border border-pdl-crimson/30">
            <AlertCircle className="w-5 h-5 text-pdl-crimson" />
          </div>
          <div className="text-left">
            <h3 className="text-xl font-logik-extended-bold text-white tracking-wide uppercase">
              Akcje do wykonania
            </h3>
            {actions.length > 0 && (
              <p className="text-xs text-white/40 font-logik">
                {urgentActions.length > 0 && (
                  <span className="text-pdl-crimson">{urgentActions.length} pilnych</span>
                )}
                {urgentActions.length > 0 && normalActions.length > 0 && ' • '}
                {normalActions.length > 0 && `${normalActions.length} do wykonania`}
              </p>
            )}
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
                  <div className="p-2 rounded-lg bg-red-500/20 border border-red-500/30 flex-shrink-0">
                    <Icon className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-logik-extended-bold text-white">
                        {action.title}
                      </p>
                      {action.dueDate && (
                        <span className="text-xs text-red-400 font-logik flex-shrink-0">
                          {formatDatePL(action.dueDate)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/60 font-logik mt-1">
                      {action.description}
                    </p>
                  </div>
                </div>
                {action.action && (
                  <Button
                    size="sm"
                    onClick={action.action.onClick}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-logik-extended-bold"
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
                  <div className="p-2 rounded-lg bg-white/5 border border-white/10 flex-shrink-0">
                    <Icon className="w-4 h-4 text-white/40" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-logik-extended-bold text-white">
                        {action.title}
                      </p>
                      {action.dueDate && (
                        <span className="text-xs text-white/40 font-logik flex-shrink-0">
                          {formatDatePL(action.dueDate)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/60 font-logik mt-1">
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
