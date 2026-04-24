import type { Metadata } from "next";
import { Space_Grotesk } from 'next/font/google'
import "./globals.css";
import { ThemeProvider } from "../context/ThemeContext";

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: "Oasis Astra - Token Creator",
  description: "Create and deploy ERC20 tokens on Oasis Sapphire",
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
