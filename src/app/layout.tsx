import type { Metadata } from 'next';
import { Space_Mono } from 'next/font/google';
import { GeistSans } from 'geist/font/sans';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/context/AuthContext';
import { TimeProvider } from '@/context/TimeContext';
import { TournamentProvider } from '@/context/TournamentContext';
import { neonBines } from '@/app/fonts';

const spaceMono = Space_Mono({
  variable: '--font-space-mono',
  subsets: ['latin'],
  weight: ['400', '700'],
});

export const metadata: Metadata = {
  title: 'dota2inhouse.pl - Polskie Turnieje Dota 2',
  description: 'Platforma dla polskiej społeczności Dota 2 - turnieje, ligi i wydarzenia esportowe',
  icons: {
    icon: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <body 
        className={`${spaceMono.variable} ${neonBines.variable} ${GeistSans.variable} antialiased font-sans`} 
        suppressHydrationWarning={true}
      >
        <AuthProvider>
          <TournamentProvider>
            <TimeProvider>
              {children}
              <Toaster />
            </TimeProvider>
          </TournamentProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
