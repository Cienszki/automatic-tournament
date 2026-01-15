// src/components/themed/ThemedCard.tsx
// A card component that adapts to the current tournament theme

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useTournament } from "@/context/TournamentContext";

export interface ThemedCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "highlighted" | "ghost" | "division";
  divisionTier?: 1 | 2 | 3;
  glow?: boolean;
  hover?: boolean;
}

const ThemedCard = React.forwardRef<HTMLDivElement, ThemedCardProps>(
  ({ 
    className, 
    variant = "default", 
    divisionTier,
    glow = false,
    hover = true,
    children,
    ...props 
  }, ref) => {
    const { tournamentSlug } = useTournament();
    const isPDL = tournamentSlug === "pdl";
    
    // Division tier colors
    const getDivisionColor = () => {
      if (!divisionTier) return "";
      switch (divisionTier) {
        case 1: return isPDL ? "border-pdl-gold/50" : "border-primary/50";
        case 2: return "border-division-challenger/50";
        case 3: return "border-division-adept/50";
        default: return "";
      }
    };
    
    // Variant styles
    const getVariantStyles = () => {
      switch (variant) {
        case "elevated":
          return cn(
            "bg-card/80 backdrop-blur-sm shadow-lg",
            isPDL 
              ? "shadow-pdl-crimson/5" 
              : "shadow-primary/10"
          );
        case "highlighted":
          return cn(
            "bg-card border-2",
            isPDL 
              ? "border-pdl-gold/30" 
              : "border-primary/30"
          );
        case "ghost":
          return "bg-transparent border-transparent";
        case "division":
          return cn("bg-card border-2", getDivisionColor());
        default:
          return "bg-card border border-border";
      }
    };
    
    // Glow effect
    const getGlowStyles = () => {
      if (!glow) return "";
      return isPDL
        ? "shadow-[0_0_20px_rgba(139,21,56,0.15)]"
        : "shadow-[0_0_20px_rgba(255,20,147,0.15)]";
    };
    
    // Hover effect
    const getHoverStyles = () => {
      if (!hover) return "";
      return cn(
        "transition-all duration-300 ease-out",
        "hover:-translate-y-0.5 hover:shadow-lg",
        isPDL
          ? "hover:shadow-pdl-crimson/10 hover:border-pdl-gold/30"
          : "hover:shadow-primary/20 hover:border-primary/30"
      );
    };
    
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg p-4",
          getVariantStyles(),
          getGlowStyles(),
          getHoverStyles(),
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ThemedCard.displayName = "ThemedCard";

// Card Header
const ThemedCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 pb-4", className)}
    {...props}
  />
));
ThemedCardHeader.displayName = "ThemedCardHeader";

// Card Title
const ThemedCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => {
  const { tournamentSlug } = useTournament();
  const isPDL = tournamentSlug === "pdl";
  
  return (
    <h3
      ref={ref}
      className={cn(
        "text-lg font-semibold leading-none tracking-tight",
        isPDL ? "font-geist" : "font-mono",
        className
      )}
      {...props}
    />
  );
});
ThemedCardTitle.displayName = "ThemedCardTitle";

// Card Description
const ThemedCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
ThemedCardDescription.displayName = "ThemedCardDescription";

// Card Content
const ThemedCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("pt-0", className)} {...props} />
));
ThemedCardContent.displayName = "ThemedCardContent";

// Card Footer
const ThemedCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center pt-4", className)}
    {...props}
  />
));
ThemedCardFooter.displayName = "ThemedCardFooter";

export {
  ThemedCard,
  ThemedCardHeader,
  ThemedCardTitle,
  ThemedCardDescription,
  ThemedCardContent,
  ThemedCardFooter,
};
