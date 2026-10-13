'use client';

import { StatsLabPreview } from '@/components/stats-lab/preview';
import Design from '@/components/stats-lab/designs/D20Numbers';

export default function StatsRedesign20Page() {
  return <StatsLabPreview n={20}><Design /></StatsLabPreview>;
}
