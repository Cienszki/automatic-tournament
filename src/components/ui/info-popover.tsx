"use client";

import { useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * An (i) that explains something — opens on hover (desktop) and on click/tap (phones).
 * A click after hovering keeps it open instead of toggling it shut.
 */
export function InfoPopover({
  label,
  title,
  children,
  className,
}: {
  /** Accessible name of the (i) button */
  label: string;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "inline-flex items-center justify-center w-5 h-5 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors shrink-0",
            className,
          )}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onClick={(e) => { e.preventDefault(); setOpen(true); }}
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-80 max-w-[90vw] text-xs leading-relaxed border-white/10 bg-[#111] text-white/80 normal-case tracking-normal"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {title && <p className="mb-1 font-semibold text-white">{title}</p>}
        <div>{children}</div>
      </PopoverContent>
    </Popover>
  );
}
