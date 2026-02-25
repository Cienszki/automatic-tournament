import type { Metadata } from 'next';
import { Space_Mono } from 'next/font/google';
import { GeistSans } from 'geist/font/sans';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/context/AuthContext';
import { TimeProvider } from '@/context/TimeContext';
import { TournamentProvider } from '@/context/TournamentContext';
import { neonBines, logik, logikExtendedBold, logikWideBlack, logikExtended8, logik3, logik4 } from '@/app/fonts';

const spaceMono = Space_Mono({
  variable: '--font-space-mono',
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap', // Performance: prevent FOIT
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL('https://dota2inhouse.pl'),
  title: {
    default: 'dota2inhouse.pl - Polskie Turnieje Dota 2',
    template: '%s | dota2inhouse.pl',
  },
  description: 'Platforma dla polskiej społeczności Dota 2 - turnieje, ligi i wydarzenia esportowe',
  openGraph: {
    type: 'website',
    siteName: 'dota2inhouse.pl',
    title: 'dota2inhouse.pl - Polskie Turnieje Dota 2',
    description: 'Platforma dla polskiej społeczności Dota 2 - turnieje, ligi i wydarzenia esportowe',
    url: 'https://dota2inhouse.pl',
    images: [
      {
        url: '/logos/pd2ih/pd2ih-logo.png',
        width: 512,
        height: 512,
        alt: 'PD2IH – Polish Dota 2 Inhouse',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'dota2inhouse.pl - Polskie Turnieje Dota 2',
    description: 'Platforma dla polskiej społeczności Dota 2 - turnieje, ligi i wydarzenia esportowe',
    images: ['/logos/pd2ih/pd2ih-logo.png'],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Performance: Preconnect to required origins */}
        <link rel="preconnect" href="https://firebasestorage.googleapis.com" />
        <link rel="preconnect" href="https://www.googleapis.com" />
        <link rel="dns-prefetch" href="https://firestore.googleapis.com" />
        <link rel="dns-prefetch" href="https://identitytoolkit.googleapis.com" />
      </head>
      <body 
        className={`${spaceMono.variable} ${neonBines.variable} ${logik.variable} ${logikExtendedBold.variable} ${logikWideBlack.variable} ${logikExtended8.variable} ${logik3.variable} ${logik4.variable} ${GeistSans.variable} antialiased font-sans`} 
        suppressHydrationWarning={true}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AuthProvider>
            <TournamentProvider>
              <TimeProvider>
                {children}
                <Toaster />
              </TimeProvider>
            </TournamentProvider>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
