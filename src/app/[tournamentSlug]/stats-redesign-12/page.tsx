'use client';

import { StatsLabPreview } from '@/components/stats-lab/preview';
import Design from '@/components/stats-lab/designs/D12Constellation';

export default function StatsRedesign12Page() {
  return <StatsLabPreview n={12}><Design /></StatsLabPreview>;
}
