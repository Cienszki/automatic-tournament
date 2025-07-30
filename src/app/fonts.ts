
import localFont from 'next/font/local';

// Configure your local font here
export const neonBines = localFont({
  src: './fonts/NeonBines.ttf',
  display: 'swap',
  variable: '--font-neon-bines', // This is how you'll refer to it in CSS
});
