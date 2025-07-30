
import type { Metadata } from 'next';
import { Raleway, Space_Mono } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/context/AuthContext';
import { TimeProvider } from '@/context/TimeContext';
import { neonBines } from '@/app/fonts';

const raleway = Raleway({
  variable: '--font-raleway',
  subsets: ['latin'],
  weight: ['400', '700'],
});

const spaceMono = Space_Mono({
  variable: '--font-space-mono',
  subsets: ['latin'],
  weight: ['400', '700'],
});

export const metadata: Metadata = {
  title: 'Tournament Tracker',
  description: 'Track your esports tournament with ease.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${raleway.variable} ${spaceMono.variable} ${neonBines.variable} antialiased font-sans`} suppressHydrationWarning={true}>
        <AuthProvider>
          <TimeProvider>
            <div className="flex flex-col min-h-screen bg-background text-foreground">
              <Navbar />
              <main className="flex-grow container mx-auto px-4 py-8">
                {children}
              </main>
              <Footer />
            </div>
            <Toaster />
          </TimeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
