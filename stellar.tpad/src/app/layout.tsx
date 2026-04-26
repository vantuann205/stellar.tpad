import type { Metadata } from "next";
import { Space_Grotesk } from 'next/font/google'
import "@/styles/globals.css";
import { ThemeProvider } from "@/hooks/useTheme";

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: "STELLAR TPAD - Token Creator",
  description: "Create and deploy tokens on Stellar",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const savedTheme = localStorage.getItem('theme');
                if (savedTheme !== 'light') {
                  document.documentElement.classList.add('dark');
                  document.documentElement.style.colorScheme = 'dark';
                }
              })();
            `,
          }}
        />
      </head>
      <body className={`${spaceGrotesk.className} min-h-screen transition-colors duration-300`} style={{
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
      }}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
