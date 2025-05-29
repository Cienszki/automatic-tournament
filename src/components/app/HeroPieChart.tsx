
"use client";

import type { ReactNode } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'; // Removed LabelList as it's not used
import {
  ChartContainer,
} from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCircle2, Sparkles, Anchor, Sword, Zap, Ghost, Ban, Swords, MountainSnow, Flame, Snowflake, Axe as AxeIcon, Target, Moon, Copy, ShieldOff, Waves, ShieldAlert, Trees, Bone, CloudLightning, Icon as LucideIconType } from 'lucide-react';

interface HeroPieChartProps {
  heroes: string[];
  teamName: string;
}

// Define a type for our hero data structure for the chart
type HeroChartData = {
  name: string;
  value: number; // All heroes get equal value for equal slices
  icon: LucideIconType; // Changed from optional to required for simplicity in label
  fill: string;
};

const heroIconMap: Record<string, LucideIconType> = {
  'Invoker': Sparkles,
  'Pudge': Anchor,
  'Juggernaut': Sword,
  'Lion': Zap,
  'Shadow Fiend': Ghost,
  'Anti-Mage': Ban,
  'Phantom Assassin': Swords,
  'Earthshaker': MountainSnow,
  'Lina': Flame,
  'Crystal Maiden': Snowflake,
  'Axe': AxeIcon,
  'Drow Ranger': Target,
  'Mirana': Moon,
  'Rubick': Copy,
  'Templar Assassin': ShieldOff,
  'Slark': Waves,
  'Sven': ShieldAlert,
  'Tiny': Trees,
  'Witch Doctor': Bone,
  'Zeus': CloudLightning,
};

const chartColors = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

interface CustomLabelRenderProps {
  cx: number;
  cy: number;
  midAngle: number;
  outerRadius: number;
  name: string; // This 'name' comes from nameKey and corresponds to chartData[i].name
  icon: LucideIconType; // This 'icon' comes directly from chartData[i].icon
  fill: string; // This 'fill' comes directly from chartData[i].fill
  // Other props like percent, index, value might also be available if needed
}

const CustomLabel = (props: CustomLabelRenderProps): ReactNode => {
  const { cx, cy, midAngle, outerRadius, name, icon: HeroIconComponent, fill } = props;

  // Robust check for necessary geometric and data props
  if (typeof cx !== 'number' || 
      typeof cy !== 'number' || 
      typeof midAngle !== 'number' || 
      typeof outerRadius !== 'number' ||
      !name ||
      !HeroIconComponent ||
      !fill
      ) {
    // console.warn("CustomLabel: Missing required props", props);
    return null;
  }

  const RADIAN = Math.PI / 180;
  // Position for the hero name (outside the slice)
  const nameRadius = outerRadius + 25;
  const nameX = cx + nameRadius * Math.cos(-midAngle * RADIAN);
  const nameY = cy + nameRadius * Math.sin(-midAngle * RADIAN);

  // Position for the icon (inside the slice)
  const iconRadius = outerRadius * 0.65;
  const iconX = cx + iconRadius * Math.cos(-midAngle * RADIAN);
  const iconY = cy + iconRadius * Math.sin(-midAngle * RADIAN);
  
  // Determine icon color based on the slice's fill color for better contrast
  const iconColor = fill === 'hsl(var(--chart-1))' || fill === 'hsl(var(--chart-3))' || fill === 'hsl(var(--chart-5))' 
                  ? 'hsl(var(--accent-foreground))' 
                  : 'hsl(var(--foreground))';

  return (
    <>
      <text
        x={nameX}
        y={nameY}
        fill="hsl(var(--foreground))"
        textAnchor={nameX > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize="14px"
        fontWeight="medium"
      >
        {name}
      </text>
      <g transform={`translate(${iconX - 12}, ${iconY - 12})`}> {/* Adjust -12 to center 24x24 icon */}
        <HeroIconComponent size={24} color={iconColor} />
      </g>
    </>
  );
};


export function HeroPieChart({ heroes, teamName }: HeroPieChartProps) {
  if (!heroes || heroes.length === 0) {
    return (
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-primary flex items-center">
            <Swords className="h-6 w-6 mr-2" /> Team Signature Heroes
          </CardTitle>
          <CardDescription>This team has no signature heroes specified yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const chartData: HeroChartData[] = heroes.slice(0, 5).map((heroName, index) => ({
    name: heroName,
    value: 1, // Equal value for each hero
    icon: heroIconMap[heroName] || UserCircle2, // Fallback icon
    fill: chartColors[index % chartColors.length],
  }));

  const chartConfig = {}; // Not strictly needed if using direct fill in <Cell />

  return (
    <Card className="shadow-xl relative overflow-visible"> {/* Added overflow-visible */}
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-primary flex items-center">
          <Swords className="h-6 w-6 mr-2" /> {teamName}'s Signature Heroes
        </CardTitle>
        <CardDescription>Top 5 most played heroes by the team (Simulated Data)</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center items-center pt-4 h-[350px] md:h-[400px]"> {/* Adjusted height */}
        <ChartContainer config={chartConfig} className="w-full h-full max-w-xs mx-auto aspect-square">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 40, right: 40, bottom: 40, left: 40 }}> {/* Added margin for labels */}
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name" // This key's value will be passed as 'name' prop to CustomLabel
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={50}
                labelLine={false}
                label={<CustomLabel />} // Use CustomLabel directly here
                paddingAngle={2}
                animationDuration={500}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} stroke="hsl(var(--background))" strokeWidth={2} />
                ))}
              </Pie>
               {/* Central Icon */}
               <foreignObject x="50%" y="50%" width="1" height="1" overflow="visible">
                 <div style={{ position: 'absolute', transform: 'translate(-50%, -50%)' }}>
                    <UserCircle2 size={48} className="text-muted-foreground" />
                 </div>
              </foreignObject>
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
