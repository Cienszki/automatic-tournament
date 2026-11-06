import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Konto', robots: { index: false, follow: false } };

export default function KontoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
