
"use client";

import type { ReactNode } from 'react';
// import { ThemeProvider as NextThemesProvider } from 'next-themes';
// import type { ThemeProviderProps } from 'next-themes/dist/types';

// export function ThemeProvider({ children, ...props }: ThemeProviderProps): ReactNode {
//   return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
// }

// Fallback ThemeProvider if next-themes is not available
export function ThemeProvider({ children }: { children: ReactNode }): ReactNode {
  return <>{children}</>;
}
