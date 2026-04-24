'use client';

import { ThemeProvider as Provider } from '../context/ThemeContext';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <Provider>{children}</Provider>;
}
