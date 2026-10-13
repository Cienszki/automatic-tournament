'use client';

import { StatsLabPreview } from '@/components/stats-lab/preview';
import Design from '@/components/stats-lab/designs/D10Stories';

export default function StatsRedesign10Page() {
  return <StatsLabPreview n={10}><Design /></StatsLabPreview>;
}
