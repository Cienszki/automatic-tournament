'use client';

import { StatsLabPreview } from '@/components/stats-lab/preview';
import Design from '@/components/stats-lab/designs/D21Stocks';

export default function StatsRedesign21Page() {
  return <StatsLabPreview n={21}><Design /></StatsLabPreview>;
}
