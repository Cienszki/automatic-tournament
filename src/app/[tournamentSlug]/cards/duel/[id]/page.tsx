"use client";

import { useParams } from 'next/navigation';
import { CardStage } from '@/components/card-lab/CardLab';
import { DuelScreen } from '@/components/card-lab/duel/DuelScreen';

/** One card duel: the challenge link, the lobby, the match */
export default function DuelPage() {
  const { id } = useParams<{ id: string }>();
  return <CardStage><DuelScreen id={id} /></CardStage>;
}
