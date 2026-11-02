import type { Metadata } from 'next';

// The card game test build: shared with testers by link, kept out of search engines
export const metadata: Metadata = {
  title: 'Karty — wersja testowa',
  robots: { index: false, follow: false },
};

export default function KartyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
