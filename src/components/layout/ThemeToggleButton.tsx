
"use client";

import { useState, useEffect } from "react";
// import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggleButton() {
  const [mounted, setMounted] = useState(false);
  // const { theme, setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Render a placeholder to avoid hydration mismatch and layout shift
    return <div className="h-10 w-10" />; // Matches size="icon" Button
  }

  // Fallback behavior if next-themes is not available
  const currentTheme = "light"; // Assume light theme
  // const currentTheme = theme === "system" ? resolvedTheme : theme;


  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => alert("Theme toggling is temporarily disabled. Please install 'next-themes'.")}
      // onClick={() => setTheme(currentTheme === "dark" ? "light" : "dark")}
      aria-label={currentTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {currentTheme === "dark" ? (
        <Sun className="h-[1.2rem] w-[1.2rem]" />
      ) : (
        <Moon className="h-[1.2rem] w-[1.2rem]" />
      )}
    </Button>
  );
}
