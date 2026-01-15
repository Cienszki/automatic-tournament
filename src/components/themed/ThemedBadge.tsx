// src/components/themed/ThemedBadge.tsx
// A badge component that adapts to the current tournament theme

"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useTournament } from "@/context/TournamentContext";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "",
        secondary: "bg-secondary text-secondary-foreground",
        destructive: "bg-destructive text-destructive-foreground",
        outline: "text-foreground border",
        success: "bg-green-500/20 text-green-400 border border-green-500/30",
        warning: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
        info: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs",
        sm: "px-2 py-0.5 text-[10px]",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

// Division badge variants
type DivisionTier = "elite" | "challenger" | "adept";

const divisionBadgeStyles: Record<DivisionTier, string> = {
  elite: "bg-pdl-gold/20 text-pdl-gold border border-pdl-gold/30",
  challenger: "bg-gray-400/20 text-gray-300 border border-gray-400/30",
  adept: "bg-amber-600/20 text-amber-500 border border-amber-600/30",
};

// Status badge variants
type StatusType = "live" | "upcoming" | "completed" | "archived" | "registration";

const statusBadgeStyles: Record<StatusType, string> = {
  live: "bg-green-500/20 text-green-400 border border-green-500/30 animate-pulse",
  upcoming: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  completed: "bg-gray-500/20 text-gray-400 border border-gray-500/30",
  archived: "bg-gray-600/20 text-gray-500 border border-gray-600/30",
  registration: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
};

export interface ThemedBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /** Division tier for league tournaments */
  division?: DivisionTier;
  /** Status for tournament/match status badges */
  status?: StatusType;
  /** Add a subtle glow effect */
  glow?: boolean;
}

function ThemedBadge({
  className,
  variant,
  size,
  division,
  status,
  glow = false,
  ...props
}: ThemedBadgeProps) {
  const { tournamentSlug } = useTournament();
  const isPDL = tournamentSlug === "pdl";
  
  // Determine styles based on type
  let styles = "";
  
  if (division) {
    styles = divisionBadgeStyles[division];
  } else if (status) {
    styles = statusBadgeStyles[status];
  } else if (variant === "default") {
    // Theme-specific primary badge
    styles = isPDL
      ? "bg-pdl-crimson/20 text-pdl-gold border border-pdl-crimson/30"
      : "bg-primary/20 text-primary border border-primary/30";
  }
  
  // Glow effect
  const glowStyles = glow
    ? isPDL
      ? "shadow-[0_0_10px_rgba(212,175,55,0.3)]"
      : "shadow-[0_0_10px_rgba(255,20,147,0.3)]"
    : "";
  
  return (
    <div
      className={cn(
        badgeVariants({ variant: division || status ? undefined : variant, size }),
        styles,
        glowStyles,
        className
      )}
      {...props}
    />
  );
}

export { ThemedBadge, badgeVariants };
