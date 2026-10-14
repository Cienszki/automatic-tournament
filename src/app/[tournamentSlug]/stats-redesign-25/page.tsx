'use client';

import { StatsLabPreview } from '@/components/stats-lab/preview';
import Design from '@/components/stats-lab/designs/D25Treemap';

export default function StatsRedesign25Page() {
  return <StatsLabPreview n={25}><Design /></StatsLabPreview>;
}
