
import type { Icon as LucideIconType } from "lucide-react";
import { 
  Sparkles, Anchor, Swords, Zap, Ghost, Ban, MountainSnow, Flame, Snowflake, 
  Puzzle, ShieldOff, Waves, ShieldAlert, Trees, Bone, CloudLightning, 
  Target, Moon, Copy as CopyIconLucide, Axe as AxeIconLucide
  // Add other icons used in your heroIconMap as needed
} from "lucide-react";

export const defaultHeroNames = [
  'Invoker', 'Pudge', 'Juggernaut', 'Lion', 'Shadow Fiend', 'Anti-Mage', 
  'Phantom Assassin', 'Earthshaker', 'Lina', 'Crystal Maiden', 'Axe', 
  'Drow Ranger', 'Mirana', 'Rubick', 'Templar Assassin', 'Slark', 'Sven', 
  'Tiny', 'Witch Doctor', 'Zeus', 'Windranger', 'Storm Spirit', 
  'Faceless Void', 'Spectre', 'Bristleback'
];

export const heroIconMap: Record<string, LucideIconType> = {
  'Invoker': Sparkles,
  'Pudge': Anchor,
  'Juggernaut': Swords, 
  'Lion': Zap, 
  'Shadow Fiend': Ghost,
  'Anti-Mage': Ban,
  'Phantom Assassin': Swords, // Using Swords for PA too
  'Earthshaker': MountainSnow,
  'Lina': Flame,
  'Crystal Maiden': Snowflake,
  'Axe': AxeIconLucide,
  'Drow Ranger': Target,
  'Mirana': Moon,
  'Rubick': CopyIconLucide,
  'Templar Assassin': ShieldOff,
  'Slark': Waves,
  'Sven': ShieldAlert,
  'Tiny': Trees,
  'Witch Doctor': Bone,
  'Zeus': CloudLightning,
  'Windranger': Puzzle, // Default/fallback icon for heroes not explicitly mapped
  'Storm Spirit': Puzzle, 
  'Faceless Void': Puzzle, 
  'Spectre': Puzzle, 
  'Bristleback': Puzzle, 
  'Default': Puzzle,
};

// Placeholder: User will provide specific colors. Current thematic colors are kept.
export const heroColorMap: Record<string, string> = {
  'Invoker': 'text-chart-4',        // Purple (arcane magic)
  'Pudge': 'text-chart-5',          // Green (decay, rot)
  'Juggernaut': 'text-destructive',  // Red (aggressive, warrior)
  'Lion': 'text-destructive',       // Red (demonic, fire)
  'Shadow Fiend': 'text-muted-foreground', // Dark/Gray (shadows)
  'Anti-Mage': 'text-chart-4',      // Purple (anti-magic, void)
  'Phantom Assassin': 'text-secondary',// Blue (stealthy, sharp)
  'Earthshaker': 'text-chart-3',    // Yellow/Gold (earth, stone)
  'Lina': 'text-primary',           // Hot Pink (fire, intense)
  'Crystal Maiden': 'text-accent',    // Cyan/Teal (ice)
  'Axe': 'text-destructive',        // Red (aggressive, blood)
  'Drow Ranger': 'text-accent',       // Cyan/Teal (cold, precise)
  'Mirana': 'text-foreground',      // Off-White (lunar, divine)
  'Rubick': 'text-chart-5',         // Green (trickster, stolen magic)
  'Templar Assassin': 'text-primary', // Hot Pink (psionic, mysterious)
  'Slark': 'text-secondary',        // Blue (aquatic, stealthy)
  'Sven': 'text-secondary',         // Blue (knightly, strong)
  'Tiny': 'text-muted-foreground', // Gray (stone giant)
  'Witch Doctor': 'text-chart-4',   // Purple (voodoo, dark magic)
  'Zeus': 'text-chart-3',           // Yellow/Gold (lightning)
  'Windranger': 'text-chart-5',     // Green (wind, nature)
  'Storm Spirit': 'text-secondary',   // Blue (electric, storm)
  'Faceless Void': 'text-chart-4',    // Purple (cosmic, timeless)
  'Spectre': 'text-chart-4',        // Purple (ethereal, haunting)
  'Bristleback': 'text-chart-3',    // Yellow/Gold (tough, quills)
  // Add more heroes and their color mappings as needed
  // For heroes not in this map, components will fall back to a default color (e.g., text-primary)
};
