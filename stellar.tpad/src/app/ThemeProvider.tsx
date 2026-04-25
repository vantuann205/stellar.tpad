'use client';

import { ThemeProvider as Provider } from '@/hooks/useTheme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <Provider>{children}</Provider>;
}
