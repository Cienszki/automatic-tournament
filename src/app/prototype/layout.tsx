import type { Metadata } from 'next';

// Prototypes are for the owner to judge, not for search engines.
export const metadata: Metadata = { title: 'Prototyp', robots: { index: false, follow: false } };

export default function PrototypeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
