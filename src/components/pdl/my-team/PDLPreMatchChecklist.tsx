'use client';

import { CheckCircle, Circle, AlertCircle, Users, UserPlus, GraduationCap, Settings, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  required: boolean;
  icon?: typeof CheckCircle;
  warning?: string;
}

interface PDLPreMatchChecklistProps {
  matchId: string;
  matchDate: string;
  items: ChecklistItem[];
  timePenalty?: {
    minutes: number;
    reason: string;
  };
}

export function PDLPreMatchChecklist({
  matchId,
  matchDate,
  items,
  timePenalty,
}: PDLPreMatchChecklistProps) {
  const requiredItems = items.filter(i => i.required);
  const completedRequired = requiredItems.filter(i => i.completed).length;
  const isReady = requiredItems.every(i => i.completed);

  const hoursUntilMatch = (new Date(matchDate).getTime() - Date.now()) / (1000 * 60 * 60);
  const showChecklist = hoursUntilMatch < 48 && hoursUntilMatch > 0;

  if (!showChecklist) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            'p-1.5 rounded-lg border',
            isReady 
              ? 'bg-green-500/20 border-green-500/30' 
              : 'bg-yellow-500/20 border-yellow-500/30'
          )}>
            {isReady ? (
              <CheckCircle className="w-4 h-4 text-green-400" />
            ) : (
              <Clock className="w-4 h-4 text-yellow-400" />
            )}
          </div>
          <h5 className="text-xs font-logik-extended-bold text-white uppercase tracking-wide">
            Lista Sprawdzająca
          </h5>
        </div>
        <div className="text-xs font-logik">
          <span className={cn(
            'font-logik-extended-bold',
            isReady ? 'text-green-400' : 'text-yellow-400'
          )}>
            {completedRequired}/{requiredItems.length}
          </span>
          <span className="text-white/40 ml-1">wymaganych</span>
        </div>
      </div>

      {/* Time Penalty Warning */}
      {timePenalty && (
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-3">
          <div className="flex gap-2">
            <AlertCircle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-orange-200 font-logik">
              <p className="font-logik-extended-bold text-orange-300 mb-1">
                Kara czasowa: {timePenalty.minutes} min
              </p>
              <p className="text-orange-200/70">{timePenalty.reason}</p>
            </div>
          </div>
        </div>
      )}

      {/* Checklist Items */}
      <div className="rounded-lg border border-white/10 bg-white/[0.02] divide-y divide-white/5">
        {items.map((item) => {
          const Icon = item.icon || Circle;
          return (
            <div key={item.id} className="p-3">
              <div className="flex items-start gap-3">
                <div className={cn(
                  'flex-shrink-0 mt-0.5',
                  item.completed ? 'text-green-400' : item.required ? 'text-yellow-400' : 'text-white/40'
                )}>
                  {item.completed ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <Circle className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-white/40" />
                    <p className={cn(
                      'text-xs font-logik',
                      item.completed ? 'text-white/60 line-through' : 'text-white'
                    )}>
                      {item.label}
                    </p>
                    {item.required && !item.completed && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 font-logik-extended-bold uppercase">
                        Wymagane
                      </span>
                    )}
                  </div>
                  {item.warning && !item.completed && (
                    <p className="text-xs text-red-400 font-logik mt-1 ml-5">
                      {item.warning}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Ready Status */}
      {isReady ? (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-center">
          <p className="text-sm text-green-400 font-logik-extended-bold">
            ✓ Drużyna gotowa do meczu
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-center">
          <p className="text-xs text-yellow-400 font-logik">
            Uzupełnij wymagane elementy przed meczem
          </p>
        </div>
      )}
    </div>
  );
}
