
import localFont from 'next/font/local';

// Configure your local font here
export const neonBines = localFont({
  src: './fonts/NeonBines.ttf',
  display: 'swap',
  variable: '--font-neon-bines', // This is how you'll refer to it in CSS
});

// Logik font for PDL theme
export const logik = localFont({
  src: [
    { path: './fonts/logik/Logik-ExtendedBold.ttf', weight: '700', style: 'normal' },
    { path: './fonts/logik/Logik-WideBlack.ttf', weight: '900', style: 'normal' },
    { path: './fonts/logik/logik.ttf', weight: '400', style: 'normal' },
    { path: './fonts/logik/logik-2.ttf', weight: '400', style: 'normal' },
    { path: './fonts/logik/logik-3.ttf', weight: '400', style: 'normal' },
    { path: './fonts/logik/logik-4.ttf', weight: '400', style: 'normal' },
    { path: './fonts/logik/logik-6.ttf', weight: '400', style: 'normal' },
    { path: './fonts/logik/logik-extended-6.ttf', weight: '400', style: 'normal' },
    { path: './fonts/logik/logik-extended-7.ttf', weight: '400', style: 'normal' },
    { path: './fonts/logik/logik-extended-8.ttf', weight: '400', style: 'normal' },
    { path: './fonts/logik/logik-extended-9.ttf', weight: '400', style: 'normal' },
    { path: './fonts/logik/logik-extended-10.ttf', weight: '400', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-logik',
});

// Individual Logik variants for testing readability
export const logikExtendedBold = localFont({
  src: './fonts/logik/Logik-ExtendedBold.ttf',
  display: 'swap',
  variable: '--font-logik-extended-bold',
});

export const logikWideBlack = localFont({
  src: './fonts/logik/Logik-WideBlack.ttf',
  display: 'swap',
  variable: '--font-logik-wide-black',
});

export const logikExtended8 = localFont({
  src: './fonts/logik/logik-extended-8.ttf',
  display: 'swap',
  variable: '--font-logik-extended-8',
});

export const logik3 = localFont({
  src: './fonts/logik/logik-3.ttf',
  display: 'swap',
  variable: '--font-logik-3',
});

export const logik4 = localFont({
  src: './fonts/logik/logik-4.ttf',
  display: 'swap',
  variable: '--font-logik-4',
});
