
import type { LucideProps } from "lucide-react";
import { 
  Sparkles, Anchor, Swords, Zap, Ghost, Ban, MountainSnow, Flame, Snowflake, 
  Puzzle, ShieldOff, Waves, ShieldAlert, Trees, Bone, CloudLightning, 
  Target, Moon, Copy as CopyIconLucide, Axe as AxeIconLucide,
  Shield, FlaskConical, Brain, Bird, Droplets, Coins, Beer, Bug, Footprints, Dice5, // Replaced Spider with Bug
  Handshake, Cog, Shell, Sunrise, Hammer, ShieldPlus, Circle, BookOpen as BookIcon,
  Plane, Nut, Sun, Ship, HeartHandshake, Dog, Hand, Eye, PawPrint, VolumeX, Fish, 
  Waypoints as GateIcon, UserCircle2, Pickaxe, VenetianMask, SprayCan, Gem, Palmtree, // Removed Swirl
  Siren, Rat, Castle, Wheat, Dices, Unplug, Box, ShieldCheck, GitFork, Bot, Rabbit, Crown, Drama,
  Skull, Crosshair, EyeOff, Tornado, Activity, Bomb, Wind, Home // Added Wind, Bomb, Home. Removed Tower.
} from "lucide-react";
import { ForwardRefExoticComponent, RefAttributes } from "react";

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
  'Oracle', 'Outworld Destroyer',
  'Pangolier', 'Phantom Assassin', 'Phantom Lancer', 'Phoenix', 'Primal Beast', 
  'Puck', 'Pudge', 'Pugna', 'Queen of Pain', 'Razor', 'Riki', 'Ringmaster', 'Rubick', 'Sand King', 
  'Shadow Demon', 'Shadow Fiend', 'Shadow Shaman', 'Silencer', 'Skywrath Mage', 'Slardar', 'Slark', 
  'Snapfire', 'Sniper', 'Spectre', 'Spirit Breaker', 'Storm Spirit', 'Sven', 'Techies', 'Templar Assassin', 
  'Terrorblade', 'Tidehunter', 'Timbersaw', 'Tinker', 'Tiny', 'Treant Protector', 'Troll Warlord', 'Tusk', 
  'Underlord', 'Undying', 'Ursa', 'Vengeful Spirit', 'Venomancer', 'Viper', 'Visage', 'Void Spirit', 
  'Warlock', 'Weaver', 'Windranger', 'Winter Wyvern', 'Witch Doctor', 'Wraith King', 'Zeus'
];

export const heroIconMap: Record<string, ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>> = {
  'Abaddon': ShieldCheck,
  'Alchemist': FlaskConical,
  'Ancient Apparition': Snowflake,
  'Anti-Mage': Ban,
  'Arc Warden': GitFork,
  'Axe': AxeIconLucide,
  'Bane': Brain,
  'Batrider': Flame,
  'Beastmaster': AxeIconLucide, // Changed from Animal
  'Bloodseeker': Droplets,
  'Bounty Hunter': Coins,
  'Brewmaster': Beer,
  'Bristleback': Pickaxe, // Changed from Spikes
  'Broodmother': Bug, // Replaced Spider
  'Centaur Warrunner': Footprints,
  'Chaos Knight': Dices,
  'Chen': Handshake,
  'Clinkz': Flame, // Changed from Bone
  'Clockwerk': Cog,
  'Crystal Maiden': Snowflake,
  'Dark Seer': Shell,
  'Dark Willow': Palmtree, // Changed from Moonlight
  'Dawnbreaker': Sunrise,
  'Dazzle': ShieldPlus,
  'Death Prophet': Ghost,
  'Disruptor': CloudLightning,
  'Doom': Flame,
  'Dragon Knight': Castle, // Changed from Dragon
  'Drow Ranger': Target,
  'Earth Spirit': MountainSnow,
  'Earthshaker': MountainSnow,
  'Elder Titan': Hammer,
  'Ember Spirit': Flame,
  'Enchantress': Rabbit, // Changed from Antlers
  'Enigma': Gem, // Changed from Blackhole
  'Faceless Void': Circle,
  'Grimstroke': SprayCan, // Changed from Ink
  'Gyrocopter': Plane,
  'Hoodwink': Nut,
  'Huskar': Flame,
  'Invoker': Sparkles,
  'Io': Circle,
  'Jakiro': Flame, // Changed from IceAndFire
  'Juggernaut': Swords,
  'Keeper of the Light': Sun,
  'Kez': Puzzle, // Placeholder, no specific hero named Kez
  'Kunkka': Ship,
  'Legion Commander': Swords,
  'Leshrac': Zap,
  'Lich': Snowflake,
  'Lifestealer': Rat, // Changed from Hand
  'Lina': Flame,
  'Lion': Zap, // Changed from Demon
  'Lone Druid': PawPrint, // Changed from Bear
  'Luna': Moon,
  'Lycan': Dog, // Changed from Wolf
  'Magnus': Tornado, // Changed from Horn
  'Marci': Hand,
  'Mars': Shield,
  'Medusa': Siren,
  'Meepo': CopyIconLucide,
  'Mirana': Moon,
  'Monkey King': Pickaxe, // Changed from Staff
  'Morphling': Waves,
  'Muerta': Crosshair,
  'Naga Siren': Siren,
  "Nature's Prophet": Trees,
  'Necrophos': Skull,
  'Night Stalker': Moon,
  'Nyx Assassin': Bug, // Replaced Spider
  'Ogre Magi': Dice5,
  'Omniknight': ShieldPlus,
  'Oracle': Eye,
  'Outworld Destroyer': Brain, // Changed from Meteor
  'Pangolier': Swords,
  'Phantom Assassin': VenetianMask,
  'Phantom Lancer': CopyIconLucide,
  'Phoenix': Flame,
  'Primal Beast': PawPrint,
  'Puck': Sparkles,
  'Pudge': Anchor, // Changed from Hook
  'Pugna': Home, // Replaced Tower
  'Queen of Pain': Drama, // Changed from Scream
  'Razor': Zap,
  'Riki': EyeOff,
  'Ringmaster': Puzzle, // Placeholder
  'Rubick': CopyIconLucide,
  'Sand King': Bug, // Replaced Spider
  'Shadow Demon': Ghost,
  'Shadow Fiend': Ghost,
  'Shadow Shaman': Bot, // Changed from Totem
  'Silencer': VolumeX,
  'Skywrath Mage': Bird,
  'Slardar': Fish,
  'Slark': Waves,
  'Snapfire': Flame,
  'Sniper': Target,
  'Spectre': Ghost,
  'Spirit Breaker': Activity, // Changed from Horn
  'Storm Spirit': CloudLightning,
  'Sven': ShieldAlert,
  'Techies': Bomb,
  'Templar Assassin': ShieldOff,
  'Terrorblade': Swords,
  'Tidehunter': Anchor,
  'Timbersaw': AxeIconLucide,
  'Tinker': Cog,
  'Tiny': Trees,
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
  'Weaver': Bug, // Replaced Spider
  'Windranger': Wind, // Replaced Swirl
  'Winter Wyvern': Snowflake,
  'Witch Doctor': Bone,
  'Wraith King': Crown,
  'Zeus': CloudLightning,
  'Default': Puzzle,
};

export const heroColorMap: Record<string, string> = {
  // Strength Heroes
  "Abaddon": "#4C6B8A",          // Blue-gray armor
  "Alchemist": "#8B4513",        // Brown/gold
  "Axe": "#8B0000",              // Dark red
  "Beastmaster": "#8B4513",      // Brown/tan (Universal, but listed under Str in provided list)
  "Brewmaster": "#FF4500",       // Orange/red (Universal, but listed under Str)
  "Bristleback": "#8B4513",      // Brown
  "Centaur Warrunner": "#A0522D", // Sienna brown
  "Chaos Knight": "#2F2F2F",     // Dark gray/black
  "Clockwerk": "#CD853F",        // Brass/bronze
  "Dawnbreaker": "#FFD700",      // Gold/yellow
  "Doom": "#8B0000",             // Dark red
  "Dragon Knight": "#CD853F",    // Bronze/gold
  "Earth Spirit": "#8B7355",     // Earth brown
  "Earthshaker": "#8B4513",      // Brown/tan
  "Elder Titan": "#4682B4",      // Steel blue
  "Huskar": "#FF6347",           // Orange-red
  "Io": "#00FFFF",               // Cyan/light blue
  "Kunkka": "#1E90FF",           // Dodger blue
  "Legion Commander": "#DC143C",  // Crimson red
  "Lifestealer": "#654321",      // Dark brown
  "Magnus": "#4682B4",           // Steel blue (Universal, but listed under Str)
  "Marci": "#8B4513",            // Brown
  "Mars": "#B22222",             // Fire brick red
  "Night Stalker": "#2F4F4F",    // Dark slate gray
  "Ogre Magi": "#4169E1",        // Royal blue (Intelligence, but listed under Str)
  "Omniknight": "#FFD700",       // Gold
  "Primal Beast": "#8B4513",     // Brown
  "Pudge": "#9ACD32",            // Yellow green (Moved Pudge here as it's Strength)
  "Sand King": "#F4A460",        // Sandy brown
  "Slardar": "#008B8B",          // Dark cyan
  "Spirit Breaker": "#9370DB",   // Medium purple
  "Sven": "#4169E1",             // Royal blue
  "Tidehunter": "#008B8B",       // Dark cyan
  "Timbersaw": "#228B22",        // Forest green
  "Tiny": "#808080",             // Gray
  "Treant Protector": "#228B22", // Forest green
  "Tusk": "#87CEEB",             // Sky blue
  "Underlord": "#8B0000",        // Dark red
  "Undying": "#9ACD32",          // Yellow green
  "Wraith King": "#32CD32",      // Lime green

  // Agility Heroes  
  "Anti-Mage": "#FF8C00",        // Dark orange
  "Arc Warden": "#4169E1",       // Royal blue
  "Bloodseeker": "#8B0000",      // Dark red
  "Bounty Hunter": "#DAA520",    // Goldenrod
  "Clinkz": "#8B4513",           // Saddle brown
  "Drow Ranger": "#4682B4",      // Steel blue
  "Ember Spirit": "#FF4500",     // Orange red
  "Faceless Void": "#9370DB",    // Medium purple
  "Gyrocopter": "#CD853F",       // Peru/bronze
  "Hoodwink": "#8B4513",         // Saddle brown
  "Juggernaut": "#DC143C",       // Crimson
  "Luna": "#4169E1",             // Royal blue
  "Medusa": "#32CD32",           // Lime green
  "Meepo": "#8B4513",            // Saddle brown
  "Monkey King": "#DAA520",      // Goldenrod
  "Morphling": "#4682B4",        // Steel blue
  "Naga Siren": "#20B2AA",       // Light sea green
  "Phantom Assassin": "#4169E1", // Royal blue
  "Phantom Lancer": "#4682B4",   // Steel blue
  "Razor": "#00BFFF",            // Deep sky blue
  "Riki": "#9370DB",             // Medium purple
  "Shadow Fiend": "#8B0000",     // Dark red
  "Slark": "#008B8B",            // Dark cyan
  "Sniper": "#8B4513",           // Saddle brown
  "Spectre": "#9370DB",          // Medium purple
  "Templar Assassin": "#FF69B4", // Hot pink
  "Terrorblade": "#8B0000",      // Dark red
  "Troll Warlord": "#8B4513",    // Saddle brown
  "Ursa": "#8B4513",             // Saddle brown
  "Vengeful Spirit": "#4169E1",  // Royal blue
  "Venomancer": "#9ACD32",       // Yellow green (Universal, but listed under Agi)
  "Viper": "#228B22",            // Forest green
  "Weaver": "#8B008B",           // Dark magenta

  // Intelligence Heroes
  "Ancient Apparition": "#87CEEB", // Sky blue
  "Crystal Maiden": "#4169E1",     // Royal blue
  "Death Prophet": "#32CD32",      // Lime green
  "Disruptor": "#4169E1",          // Royal blue
  "Enchantress": "#8B4513",        // Saddle brown (Intelligence in Dota, but color fits Universal)
  "Grimstroke": "#2F4F4F",         // Dark slate gray
  "Jakiro": "#FF4500",             // Orange red
  "Keeper of the Light": "#FFD700", // Gold
  "Leshrac": "#4169E1",            // Royal blue
  "Lich": "#87CEEB",               // Sky blue
  "Lina": "#FF0000",               // Red
  "Lion": "#8B008B",               // Dark magenta
  "Muerta": "#32CD32",             // Lime green
  "Nature's Prophet": "#228B22",   // Forest green
  "Necrophos": "#32CD32",          // Lime green
  "Oracle": "#DAA520",             // Goldenrod
  "Outworld Destroyer": "#4169E1", // Royal blue
  "Puck": "#FF69B4",               // Hot pink
  "Pugna": "#32CD32",              // Lime green
  "Queen of Pain": "#8B008B",      // Dark magenta
  "Rubick": "#32CD32",             // Lime green
  "Shadow Demon": "#9370DB",       // Medium purple
  "Shadow Shaman": "#8B008B",      // Dark magenta
  "Silencer": "#9370DB",           // Medium purple
  "Skywrath Mage": "#4169E1",      // Royal blue
  "Storm Spirit": "#4169E1",       // Royal blue
  "Tinker": "#CD853F",             // Peru/bronze
  "Warlock": "#8B0000",            // Dark red
  "Witch Doctor": "#8B008B",       // Dark magenta
  "Zeus": "#4169E1",               // Royal blue

  // Universal Heroes (from your list which were under other categories or duplicates)
  "Bane": "#8B008B",               // Dark magenta
  "Batrider": "#FF4500",           // Orange red
  "Broodmother": "#8B0000",        // Dark red (Universal, listed here)
  "Chen": "#FFD700",               // Gold
  "Dark Seer": "#9370DB",          // Medium purple
  "Dark Willow": "#8B008B",        // Dark magenta
  "Dazzle": "#FF69B4",             // Hot pink
  "Enigma": "#9370DB",             // Medium purple
  "Invoker": "#DAA520",            // Goldenrod
  "Lycan": "#8B4513",              // Saddle brown
  "Mirana": "#4682B4",             // Steel blue (Universal, listed here)
  "Nyx Assassin": "#8B008B",       // Dark magenta (Universal, listed here)
  "Pangolier": "#DAA520",          // Goldenrod (Universal, listed here)
  "Phoenix": "#FF4500",            // Orange red
  "Techies": "#8B4513",            // Saddle brown
  "Visage": "#2F4F4F",             // Dark slate gray
  "Void Spirit": "#9370DB",        // Medium purple (Universal, listed here)
  "Windranger": "#228B22",         // Forest green
  "Winter Wyvern": "#87CEEB",       // Sky blue

  // Default fallback if a hero isn't in the map (though all should be)
  "Default": "#FF3BEA" 
};


// Fallback color if hero not in map (using your theme's primary neon pink)
export const FALLBACK_HERO_COLOR = '#FF3BEA'; 
