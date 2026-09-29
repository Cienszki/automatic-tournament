'use client';

// Collapsible "advanced settings" block for the wizard.
//
// The people this wizard is for are non-technical and often nervous about
// breaking something. Showing sixty fields at once is what makes the admin panel
// unusable for them. Each step therefore shows only what is needed to go live,
// with everything else tucked behind one of these — discoverable, but not in the
// way, and explicitly labelled as optional.

import React, { useState } from 'react';
import { ChevronDown, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdvancedSectionProps {
  title?: string;
  description?: string;
  /** Open on first render — use when a step has nothing in its required part. */
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function AdvancedSection({
  title = 'Ustawienia zaawansowane',
  description = 'Wszystko tutaj jest opcjonalne — możesz to uzupełnić teraz albo później w panelu administracyjnym.',
  defaultOpen = false,
  children,
}: AdvancedSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/40 transition-colors"
      >
        <Settings2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{title}</p>
          {!open && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 space-y-6 border-t border-border/60">
          <p className="text-xs text-muted-foreground pt-4">{description}</p>
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Standing reassurance shown once per step.
 *
 * Non-technical organisers hesitate over every field when they believe the
 * choice is permanent. Saying plainly that it is not removes most of that.
 */
export function ChangeableLaterNote({ except }: { except?: string }) {
  return (
    <p className="text-xs text-muted-foreground flex items-start gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
      <span aria-hidden>💡</span>
      <span>
        Wszystkie ustawienia z tego kroku możesz zmienić później w panelu administracyjnym
        {except ? <> — z jednym wyjątkiem: <strong>{except}</strong>.</> : '.'}
      </span>
    </p>
  );
}
