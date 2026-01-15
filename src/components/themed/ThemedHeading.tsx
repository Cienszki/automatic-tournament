// src/components/themed/ThemedHeading.tsx
// Typography components that adapt to the current tournament theme

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useTournament } from "@/context/TournamentContext";

type HeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

interface ThemedHeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: HeadingLevel;
  /** Use accent color (secondary/gold) instead of default */
  accent?: boolean;
  /** Add gradient effect */
  gradient?: boolean;
  /** Add glow effect */
  glow?: boolean;
}

const headingStyles: Record<HeadingLevel, string> = {
  h1: "text-fluid-4xl font-bold tracking-tight",
  h2: "text-fluid-3xl font-semibold tracking-tight",
  h3: "text-fluid-2xl font-semibold",
  h4: "text-fluid-xl font-semibold",
  h5: "text-fluid-lg font-medium",
  h6: "text-fluid-base font-medium tracking-wide uppercase",
};

const ThemedHeading = React.forwardRef<HTMLHeadingElement, ThemedHeadingProps>(
  ({ 
    className, 
    as: Component = "h2", 
    accent = false,
    gradient = false,
    glow = false,
    children,
    ...props 
  }, ref) => {
    const { tournamentSlug } = useTournament();
    const isPDL = tournamentSlug === "pdl";
    
    // Font family based on tournament
    const fontFamily = isPDL ? "font-geist" : "font-neon";
    
    // Accent color
    const accentStyles = accent
      ? isPDL
        ? "text-pdl-gold"
        : "text-letnia-cyan"
      : "";
    
    // Gradient effect
    const gradientStyles = gradient
      ? cn(
          "bg-clip-text text-transparent bg-gradient-to-r",
          isPDL
            ? "from-pdl-gold via-pdl-crimson to-pdl-gold"
            : "from-letnia-pink via-letnia-cyan to-letnia-pink"
        )
      : "";
    
    // Glow effect
    const glowStyles = glow
      ? isPDL
        ? "[text-shadow:0_0_20px_rgba(212,175,55,0.5)]"
        : "[text-shadow:0_0_20px_rgba(255,20,147,0.5)]"
      : "";
    
    return (
      <Component
        ref={ref}
        className={cn(
          headingStyles[Component],
          fontFamily,
          accentStyles,
          gradientStyles,
          glowStyles,
          className
        )}
        {...props}
      >
        {children}
      </Component>
    );
  }
);
ThemedHeading.displayName = "ThemedHeading";

// Display text - for hero sections
interface DisplayTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: "sm" | "md" | "lg";
  gradient?: boolean;
  glow?: boolean;
}

const DisplayText = React.forwardRef<HTMLSpanElement, DisplayTextProps>(
  ({ 
    className, 
    size = "md",
    gradient = false,
    glow = false,
    children,
    ...props 
  }, ref) => {
    const { tournamentSlug } = useTournament();
    const isPDL = tournamentSlug === "pdl";
    
    const sizeStyles = {
      sm: "text-fluid-4xl",
      md: "text-fluid-5xl",
      lg: "text-fluid-6xl",
    };
    
    const fontFamily = isPDL ? "font-geist" : "font-neon";
    
    const gradientStyles = gradient
      ? cn(
          "bg-clip-text text-transparent bg-gradient-to-r",
          isPDL
            ? "from-pdl-gold via-white to-pdl-gold"
            : "from-letnia-pink via-letnia-cyan to-letnia-pink"
        )
      : "";
    
    const glowStyles = glow
      ? isPDL
        ? "[text-shadow:0_0_40px_rgba(212,175,55,0.6)]"
        : "[text-shadow:0_0_40px_rgba(255,20,147,0.6)]"
      : "";
    
    return (
      <span
        ref={ref}
        className={cn(
          sizeStyles[size],
          "font-bold tracking-tight",
          fontFamily,
          gradientStyles,
          glowStyles,
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);
DisplayText.displayName = "DisplayText";

// Section title with optional line
interface SectionTitleProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  /** Show decorative line */
  line?: boolean;
  /** Center the title */
  center?: boolean;
}

const SectionTitle = React.forwardRef<HTMLDivElement, SectionTitleProps>(
  ({ 
    className, 
    title,
    subtitle,
    line = true,
    center = false,
    ...props 
  }, ref) => {
    const { tournamentSlug } = useTournament();
    const isPDL = tournamentSlug === "pdl";
    
    return (
      <div
        ref={ref}
        className={cn(
          "mb-6",
          center && "text-center",
          className
        )}
        {...props}
      >
        <ThemedHeading as="h2" className="mb-1">
          {title}
        </ThemedHeading>
        {subtitle && (
          <p className="text-muted-foreground text-sm">{subtitle}</p>
        )}
        {line && (
          <div 
            className={cn(
              "mt-3 h-0.5 w-16 rounded-full",
              center && "mx-auto",
              isPDL
                ? "bg-gradient-to-r from-pdl-gold to-pdl-crimson"
                : "bg-gradient-to-r from-letnia-pink to-letnia-cyan"
            )}
          />
        )}
      </div>
    );
  }
);
SectionTitle.displayName = "SectionTitle";

// Stat display
interface StatDisplayProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string | number;
  label: string;
  /** Highlight with accent color */
  highlight?: boolean;
}

const StatDisplay = React.forwardRef<HTMLDivElement, StatDisplayProps>(
  ({ 
    className, 
    value,
    label,
    highlight = false,
    ...props 
  }, ref) => {
    const { tournamentSlug } = useTournament();
    const isPDL = tournamentSlug === "pdl";
    
    return (
      <div
        ref={ref}
        className={cn("text-center", className)}
        {...props}
      >
        <div 
          className={cn(
            "text-fluid-2xl font-bold font-mono",
            highlight && (isPDL ? "text-pdl-gold" : "text-letnia-cyan")
          )}
        >
          {value}
        </div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
          {label}
        </div>
      </div>
    );
  }
);
StatDisplay.displayName = "StatDisplay";

export { 
  ThemedHeading, 
  DisplayText, 
  SectionTitle, 
  StatDisplay 
};
