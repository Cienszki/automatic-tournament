import type { Metadata } from 'next';

// Card duel pages (/cards/duel/[id]): shared by link, kept out of search engines
export const metadata: Metadata = {
  title: 'Gra karciana',
  robots: { index: false, follow: false },
};

export default function KartyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
