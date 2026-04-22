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
        {/* Blocking inline script: reads the cached tournament theme from
            sessionStorage and applies CSS variables BEFORE the browser paints
            anything. This prevents the flash of the default dark background on
            repeat visits / refreshes (same technique used by next-themes). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=window.location.pathname.split('/')[1];if(!s)return;var r=sessionStorage.getItem('theme-cache-'+s);if(!r)return;var t=JSON.parse(r);var e=document.documentElement;var st=e.style;if(t.primaryColor)st.setProperty('--tournament-primary',t.primaryColor);if(t.secondaryColor)st.setProperty('--tournament-secondary',t.secondaryColor);if(t.accentColor)st.setProperty('--tournament-accent',t.accentColor);if(t.backgroundColor){st.setProperty('--tournament-background',t.backgroundColor);}if(t.backgroundGradient)st.setProperty('--tournament-bg-gradient',t.backgroundGradient);if(t.cardColor)st.setProperty('--tournament-card',t.cardColor);if(t.textColor)st.setProperty('--tournament-text',t.textColor);if(t.mutedTextColor)st.setProperty('--tournament-muted',t.mutedTextColor);if(t.borderColor)st.setProperty('--tournament-border',t.borderColor);e.setAttribute('data-tournament',s);e.classList.add('theme-'+s);}catch(e){}})();`,
          }}
        />
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
