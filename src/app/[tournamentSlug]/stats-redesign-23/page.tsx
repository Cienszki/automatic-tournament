'use client';

import { StatsLabPreview } from '@/components/stats-lab/preview';
import Design from '@/components/stats-lab/designs/D23Elo';

export default function StatsRedesign23Page() {
  return <StatsLabPreview n={23}><Design /></StatsLabPreview>;
}
