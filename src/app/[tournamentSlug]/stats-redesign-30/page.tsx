'use client';

import { StatsLabPreview } from '@/components/stats-lab/preview';
import Design from '@/components/stats-lab/designs/D30Bracket';

export default function StatsRedesign30Page() {
  return <StatsLabPreview n={30}><Design /></StatsLabPreview>;
}
