'use client';

import { StatsLabPreview } from '@/components/stats-lab/preview';
import Design from '@/components/stats-lab/designs/D15TeamOfWeek';

export default function StatsRedesign15Page() {
  return <StatsLabPreview n={15}><Design /></StatsLabPreview>;
}
