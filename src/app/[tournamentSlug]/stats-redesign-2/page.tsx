'use client';

import { StatsLabPreview } from '@/components/stats-lab/preview';
import Design from '@/components/stats-lab/designs/D02Podium';

export default function StatsRedesign2Page() {
  return <StatsLabPreview n={2}><Design /></StatsLabPreview>;
}
