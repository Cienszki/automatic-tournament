
import type { Icon as LucideIconType } from "lucide-react";
import { 
  Sparkles, Anchor, Swords, Zap, Ghost, Ban, MountainSnow, Flame, Snowflake, 
  Puzzle, ShieldOff, Waves, ShieldAlert, Trees, Bone, CloudLightning, 
  Target, Moon, Copy as CopyIconLucide, Axe as AxeIconLucide,
  Shield, FlaskConical, Brain, Bird, Droplets, Coins, Beer, Bug, Footprints, Dice5, // Replaced Spider with Bug
  Handshake, Cog, Shell, Sunrise, Hammer, ShieldPlus, Circle, BookOpen as BookIcon,
  Plane, Nut, Sun, Ship, HeartHandshake, Dog, Hand, Eye, PawPrint, VolumeX, Fish, 
  Waypoints as GateIcon, UserCircle2, Pickaxe, VenetianMask, SprayCan, Gem, Palmtree, // Removed Swirl
  Siren, Rat, Castle, Wheat, Dices, Unplug, Box, ShieldCheck, GitFork, Bot, Rabbit, Crown, Drama,
  Skull, Tower, Crosshair, EyeOff, Tornado, Activity, Bomb, Wind // Added Wind, Bomb
} from "lucide-react";

export const defaultHeroNames = [
  'Abaddon', 'Alchemist', 'Ancient Apparition', 'Anti-Mage', 'Arc Warden', 'Axe', 'Bane', 'Batrider', 'Beastmaster', 
  'Bloodseeker', 'Bounty Hunter', 'Brewmaster', 'Bristleback', 'Broodmother', 'Centaur Warrunner', 'Chaos Knight', 
  'Chen', 'Clinkz', 'Clockwerk', 'Crystal Maiden', 'Dark Seer', 'Dark Willow', 'Dawnbreaker', 'Dazzle', 
  'Death Prophet', 'Disruptor', 'Doom', 'Dragon Knight', 'Drow Ranger', 'Earth Spirit', 'Earthshaker', 
  'Elder Titan', 'Ember Spirit', 'Enchantress', 'Enigma', 'Faceless Void', 'Grimstroke', 'Gyrocopter', 
  'Hoodwink', 'Huskar', 'Invoker', 'Io', 'Jakiro', 'Juggernaut', 'Keeper of the Light', 'Kez', 'Kunkka', 
  'Legion Commander', 'Leshrac', 'Lich', 'Lifestealer', 'Lina', 'Lion', 'Lone Druid', 'Luna', 'Lycan', 
  'Magnus', 'Marci', 'Mars', 'Medusa', 'Meepo', 'Mirana', 'Monkey King', 'Morphling', 'Muerta', 
  'Naga Siren', "Nature's Prophet", 'Necrophos', 'Night Stalker', 'Nyx Assassin', 'Ogre Magi', 'Omniknight', 
  'Oracle', 'Outworld Devourer', 'Pangolier', 'Phantom Assassin', 'Phantom Lancer', 'Phoenix', 'Primal Beast', 
  'Puck', 'Pudge', 'Pugna', 'Queen of Pain', 'Razor', 'Riki', 'Ringmaster', 'Rubick', 'Sand King', 
  'Shadow Demon', 'Shadow Fiend', 'Shadow Shaman', 'Silencer', 'Skywrath Mage', 'Slardar', 'Slark', 
  'Snapfire', 'Sniper', 'Spectre', 'Spirit Breaker', 'Storm Spirit', 'Sven', 'Techies', 'Templar Assassin', 
  'Terrorblade', 'Tidehunter', 'Timbersaw', 'Tinker', 'Tiny', 'Treant Protector', 'Troll Warlord', 'Tusk', 
  'Underlord', 'Undying', 'Ursa', 'Vengeful Spirit', 'Venomancer', 'Viper', 'Visage', 'Void Spirit', 
  'Warlock', 'Weaver', 'Windranger', 'Winter Wyvern', 'Witch Doctor', 'Wraith King', 'Zeus'
];

export const heroIconMap: Record<string, LucideIconType> = {
  // Existing common heroes
  'Invoker': Sparkles,
  'Pudge': Anchor,
  'Juggernaut': Swords, 
  'Lion': Zap, 
  'Shadow Fiend': Ghost,
  'Anti-Mage': Ban,
  'Phantom Assassin': VenetianMask,
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
  'Windranger': Wind, // Changed from Swirl to Wind
  'Storm Spirit': CloudLightning,
  'Faceless Void': Circle,
  'Spectre': Ghost,
  'Bristleback': Pickaxe,

  // New heroes from the list
  'Abaddon': ShieldCheck,
  'Alchemist': FlaskConical,
  'Ancient Apparition': Snowflake,
  'Arc Warden': GitFork,
  'Bane': Brain,
  'Batrider': Flame,
  'Beastmaster': AxeIconLucide,
  'Bloodseeker': Droplets,
  'Bounty Hunter': Coins,
  'Brewmaster': Beer,
  'Broodmother': Bug, 
  'Centaur Warrunner': Footprints,
  'Chaos Knight': Dices,
  'Chen': Handshake,
  'Clinkz': Flame,
  'Clockwerk': Cog,
  'Dark Seer': Shell,
  'Dark Willow': Palmtree,
  'Dawnbreaker': Sunrise,
  'Dazzle': ShieldPlus,
  'Death Prophet': Ghost,
  'Disruptor': CloudLightning,
  'Doom': Flame,
  'Dragon Knight': Castle,
  'Earth Spirit': MountainSnow,
  'Elder Titan': Hammer,
  'Ember Spirit': Flame,
  'Enchantress': Rabbit,
  'Enigma': Gem,
  'Grimstroke': SprayCan,
  'Gyrocopter': Plane,
  'Hoodwink': Nut,
  'Huskar': Flame,
  'Io': Circle,
  'Jakiro': Flame,
  'Keeper of the Light': Sun,
  'Kez': Puzzle,
  'Kunkka': Ship,
  'Legion Commander': Swords,
  'Leshrac': Zap,
  'Lich': Snowflake,
  'Lifestealer': Rat,
  'Lone Druid': PawPrint,
  'Luna': Moon,
  'Lycan': Dog,
  'Magnus': Tornado, // Changed from Horn
  'Marci': Hand,
  'Mars': Shield,
  'Medusa': Siren,
  'Meepo': CopyIconLucide,
  'Monkey King': Pickaxe,
  'Morphling': Waves,
  'Muerta': Crosshair,
  'Naga Siren': Siren,
  "Nature's Prophet": Trees,
  'Necrophos': Skull,
  'Night Stalker': Moon,
  'Nyx Assassin': Bug, 
  'Ogre Magi': Dice5,
  'Omniknight': ShieldPlus,
  'Oracle': Eye,
  'Outworld Devourer': Brain,
  'Pangolier': Swords,
  'Phantom Lancer': CopyIconLucide,
  'Phoenix': Flame,
  'Primal Beast': PawPrint,
  'Puck': Sparkles,
  'Pugna': Tower,
  'Queen of Pain': Drama,
  'Razor': Zap,
  'Riki': EyeOff,
  'Ringmaster': Puzzle,
  'Sand King': Bug, 
  'Shadow Demon': Ghost,
  'Shadow Shaman': Bot,
  'Silencer': VolumeX,
  'Skywrath Mage': Bird,
  'Slardar': Fish,
  'Snapfire': Flame,
  'Sniper': Target,
  'Spirit Breaker': Activity, // Changed from Horn
  'Techies': Bomb, 
  'Terrorblade': Swords,
  'Tidehunter': Anchor,
  'Timbersaw': AxeIconLucide,
  'Tinker': Cog,
  'Treant Protector': Trees,
  'Troll Warlord': AxeIconLucide,
  'Tusk': Snowflake,
  'Underlord': GateIcon,
  'Undying': Skull,
  'Ursa': PawPrint,
  'Vengeful Spirit': Sparkles,
  'Venomancer': Droplets,
  'Viper': Droplets,
  'Visage': Bird,
  'Void Spirit': Sparkles,
  'Warlock': BookIcon,
  'Weaver': Bug, 
  'Winter Wyvern': Snowflake,
  'Wraith King': Crown,

  // Default
  'Default': Puzzle,
};

// Assigning colors based on visual themes or common associations.
// Using a mix of primary, secondary, accent, and chart colors.
export const heroColorMap: Record<string, string> = {
  // Existing thematic colors
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
  'Tiny': 'text-muted-foreground',  // Gray (stone giant)
  'Witch Doctor': 'text-chart-4',   // Purple (voodoo, dark magic)
  'Zeus': 'text-chart-3',           // Yellow/Gold (lightning)
  'Windranger': 'text-chart-5',     // Green (wind, nature)
  'Storm Spirit': 'text-secondary',   // Blue (electric, storm)
  'Faceless Void': 'text-chart-4',    // Purple (cosmic, timeless)
  'Spectre': 'text-chart-4',        // Purple (ethereal, haunting)
  'Bristleback': 'text-chart-3',    // Yellow/Gold (tough, quills)

  // New heroes - trying to match visual themes
  'Abaddon': 'text-accent',          // Light blue/ethereal
  'Alchemist': 'text-chart-5',       // Green (concoctions)
  'Ancient Apparition': 'text-accent',// Cyan/Ice
  'Arc Warden': 'text-chart-4',      // Purple/Electric
  'Bane': 'text-muted-foreground',   // Dark/Shadowy
  'Batrider': 'text-primary',        // Orange/Red (fire)
  'Beastmaster': 'text-chart-3',     // Brown/Yellow (wild)
  'Bloodseeker': 'text-destructive', // Red (blood)
  'Bounty Hunter': 'text-chart-3',   // Gold
  'Brewmaster': 'text-chart-5',      // Earthy green/brown
  'Broodmother': 'text-chart-4',     // Dark purple/black
  'Centaur Warrunner': 'text-destructive', // Reddish-brown
  'Chaos Knight': 'text-primary',    // Dark red/purple (chaos)
  'Chen': 'text-foreground',       // White/Gold (holy)
  'Clinkz': 'text-destructive',      // Fiery red/orange
  'Clockwerk': 'text-muted-foreground',// Metallic gray
  'Dark Seer': 'text-chart-4',       // Purple (dark magic)
  'Dark Willow': 'text-primary',     // Pink/Purple (fey)
  'Dawnbreaker': 'text-chart-3',     // Gold/White (celestial)
  'Dazzle': 'text-accent',           // Light blue/teal (healing)
  'Death Prophet': 'text-chart-5',   // sickly green/ethereal
  'Disruptor': 'text-secondary',     // Blue (storm)
  'Doom': 'text-destructive',      // Red/Black (demonic)
  'Dragon Knight': 'text-destructive',// Red (dragon form)
  'Earth Spirit': 'text-chart-5',    // Green/Brown (earth)
  'Elder Titan': 'text-muted-foreground', // Gray/Stone
  'Ember Spirit': 'text-primary',    // Orange/Red (fire)
  'Enchantress': 'text-chart-5',     // Green (nature)
  'Enigma': 'text-chart-4',          // Dark Purple/Black (void)
  'Grimstroke': 'text-primary',      // Dark Red/Ink
  'Gyrocopter': 'text-secondary',    // Blue/Gray (mechanical)
  'Hoodwink': 'text-chart-5',        // Green/Brown (forest)
  'Huskar': 'text-destructive',      // Red (berserker, fire)
  'Io': 'text-accent',               // Light Blue/White (wisp)
  'Jakiro': 'text-secondary',        // Blue (ice aspect) / Red (fire aspect) - choosing one
  'Keeper of the Light': 'text-foreground',// White/Gold (light)
  'Kez': 'text-muted-foreground',     // Placeholder
  'Kunkka': 'text-secondary',        // Blue (water)
  'Legion Commander': 'text-destructive',// Red (battle)
  'Leshrac': 'text-accent',          // Blue/Teal (pulse nova)
  'Lich': 'text-accent',             // Cyan/Blue (ice)
  'Lifestealer': 'text-destructive',   // Red/Dark (infested)
  'Lone Druid': 'text-chart-5',      // Green/Brown (nature, bear)
  'Luna': 'text-accent',             // Silvery Blue/White (moon)
  'Lycan': 'text-muted-foreground',  // Brown/Gray (wolf)
  'Magnus': 'text-secondary',        // Blue/Purple (empower)
  'Marci': 'text-primary',           // Pink/Red
  'Mars': 'text-destructive',        // Red (war)
  'Medusa': 'text-chart-5',          // Green (serpentine)
  'Meepo': 'text-chart-3',           // Brown/Yellow (earthy)
  'Monkey King': 'text-chart-3',     // Gold/Red
  'Morphling': 'text-accent',        // Cyan/Blue (water)
  'Muerta': 'text-primary',          // Red/Black
  'Naga Siren': 'text-accent',       // Teal/Blue (oceanic)
  "Nature's Prophet": 'text-chart-5',// Green (nature)
  'Necrophos': 'text-chart-5',       // Sickly Green (death aura)
  'Night Stalker': 'text-chart-4',   // Dark Blue/Purple (night)
  'Nyx Assassin': 'text-chart-4',    // Dark Purple/Blue (insectoid)
  'Ogre Magi': 'text-secondary',     // Blue (ogre skin)
  'Omniknight': 'text-foreground',   // White/Gold (holy)
  'Oracle': 'text-chart-3',          // Gold/Ethereal
  'Outworld Devourer': 'text-chart-4',// Dark Purple/Black (void)
  'Pangolier': 'text-destructive',   // Reddish-brown (swashbuckler)
  'Phantom Lancer': 'text-accent',   // Blue/Teal (illusions)
  'Phoenix': 'text-primary',         // Fiery Orange/Red
  'Primal Beast': 'text-destructive',// Red/Brown
  'Puck': 'text-chart-4',            // Purple/Pink (fey dragon)
  'Pugna': 'text-chart-5',           // Green (nether)
  'Queen of Pain': 'text-primary',   // Pink/Purple (succubus)
  'Razor': 'text-secondary',         // Electric Blue
  'Riki': 'text-muted-foreground',   // Dark/Stealthy
  'Ringmaster': 'text-muted-foreground', // Placeholder
  'Sand King': 'text-chart-3',       // Sandy Yellow/Brown
  'Shadow Demon': 'text-primary',    // Dark Red/Purple
  'Shadow Shaman': 'text-destructive',// Red/Orange (serpent wards)
  'Silencer': 'text-chart-4',        // Purple (arcane)
  'Skywrath Mage': 'text-chart-3',   // Gold/Blue (celestial)
  'Slardar': 'text-secondary',       // Deep Blue/Green (slithereen)
  'Snapfire': 'text-primary',        // Orange/Red (fiery)
  'Sniper': 'text-chart-5',          // Brown/Green (dwarven)
  'Spirit Breaker': 'text-chart-4',  // Purple/Blue (nether charge)
  'Techies': 'text-primary',         // Orange/Red (explosions)
  'Terrorblade': 'text-chart-4',     // Dark Purple/Demonic
  'Tidehunter': 'text-chart-5',      // Green (leviathan)
  'Timbersaw': 'text-muted-foreground',// Brown/Gray (mechanical)
  'Tinker': 'text-chart-3',          // Yellow/Orange (mechanical)
  'Treant Protector': 'text-chart-5',// Deep Green (forest)
  'Troll Warlord': 'text-destructive',// Red/Green (rage)
  'Tusk': 'text-accent',             // Icy Blue
  'Underlord': 'text-chart-5',       // Dark Green/Black (abyssal)
  'Undying': 'text-chart-5',         // Pale Green/Gray (undead)
  'Ursa': 'text-chart-5',            // Brown/Green (ursine)
  'Vengeful Spirit': 'text-accent',  // Ethereal Blue
  'Venomancer': 'text-chart-5',      // Toxic Green
  'Viper': 'text-chart-5',           // Green/Black (netherdrake)
  'Visage': 'text-muted-foreground', // Gray/Stone (gargoyle)
  'Void Spirit': 'text-chart-4',     // Purple (void remnant)
  'Warlock': 'text-destructive',     // Dark Red/Purple (demonic)
  'Weaver': 'text-chart-4',          // Purple/Green (insectoid)
  'Winter Wyvern': 'text-accent',    // Icy Blue/White
  'Wraith King': 'text-chart-5',     // Ethereal Green/Bone
  'Default': 'text-primary',
};
