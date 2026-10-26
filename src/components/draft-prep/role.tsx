'use client';

// A position as the rest of the site shows it: its icon (same set as the teams section) and name.

import { Eye, HandHelping, Shield, Sparkles, Swords } from 'lucide-react';
import { roleLabel } from '@/lib/draft-prep/engine';

const ROLE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Carry: Swords, Mid: Sparkles, Offlane: Shield, 'Soft Support': HandHelping, 'Hard Support': Eye,
};

/** Icon + "Carry (1)"; `label={false}` keeps only the icon, with the name on hover */
export function RoleTag({ role, label = true }: { role?: string; label?: boolean }) {
  const Icon = role ? ROLE_ICON[role] : undefined;
  const name = roleLabel(role);
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap shrink-0" title={label ? undefined : name}>
      {Icon && <Icon className="w-[1.05em] h-[1.05em] shrink-0" />}
      {label ? name : <span className="sr-only">{name}</span>}
    </span>
  );
}
