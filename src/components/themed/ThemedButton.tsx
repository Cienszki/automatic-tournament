// src/components/themed/ThemedButton.tsx
// A button component that adapts to the current tournament theme

"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useTournament } from "@/context/TournamentContext";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        xl: "h-12 rounded-md px-10 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ThemedButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Add a glow effect on hover */
  glow?: boolean;
  /** Loading state */
  loading?: boolean;
}

const ThemedButton = React.forwardRef<HTMLButtonElement, ThemedButtonProps>(
  ({ 
    className, 
    variant, 
    size, 
    asChild = false, 
    glow = false,
    loading = false,
    children,
    disabled,
    ...props 
  }, ref) => {
    const { tournamentSlug } = useTournament();
    const isPDL = tournamentSlug === "pdl";
    const Comp = asChild ? Slot : "button";
    
    // Theme-specific primary button styles
    const getPrimaryStyles = () => {
      if (variant !== "default") return "";
      
      if (isPDL) {
        return cn(
          "bg-pdl-crimson text-white",
          "hover:bg-pdl-crimson-light",
          "active:bg-pdl-crimson-dark",
          glow && "hover:shadow-[0_0_20px_rgba(139,21,56,0.4)]"
        );
      }
      
      return cn(
        "bg-primary text-primary-foreground",
        "hover:bg-primary/90",
        "active:bg-primary/80",
        glow && "hover:shadow-[0_0_20px_rgba(255,20,147,0.4)]"
      );
    };
    
    // Theme-specific outline button styles
    const getOutlineStyles = () => {
      if (variant !== "outline") return "";
      
      if (isPDL) {
        return cn(
          "border-pdl-gold/50 text-pdl-gold",
          "hover:bg-pdl-gold/10 hover:border-pdl-gold",
          glow && "hover:shadow-[0_0_15px_rgba(212,175,55,0.3)]"
        );
      }
      
      return cn(
        "border-primary/50 text-primary",
        "hover:bg-primary/10 hover:border-primary",
        glow && "hover:shadow-[0_0_15px_rgba(255,20,147,0.3)]"
      );
    };
    
    // Theme-specific ghost button styles
    const getGhostStyles = () => {
      if (variant !== "ghost") return "";
      
      if (isPDL) {
        return "hover:bg-pdl-crimson/10 hover:text-pdl-gold";
      }
      
      return "hover:bg-primary/10 hover:text-primary";
    };
    
    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size }),
          getPrimaryStyles(),
          getOutlineStyles(),
          getGhostStyles(),
          "transition-all duration-200",
          loading && "cursor-wait",
          className
        )}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Ładowanie...</span>
          </span>
        ) : (
          children
        )}
      </Comp>
    );
  }
);
ThemedButton.displayName = "ThemedButton";

export { ThemedButton, buttonVariants };
