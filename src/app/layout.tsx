import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "./components/ThemeProvider";
import { ThemeToggle } from "./components/ThemeToggle";

export const metadata: Metadata = {
  title: "Realtime API Agents",
  description: "A demo app from OpenAI.",
};

function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            const mode = localStorage.getItem('mode') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
            const theme = localStorage.getItem('theme') || 'default';
            
            if (mode === 'dark') document.documentElement.classList.add('dark');
            if (theme !== 'default') document.documentElement.setAttribute('data-theme', theme + '-' + mode);
          })();
        `,
      }}
    />
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          {children}
          <ThemeToggle />
        </ThemeProvider>
      </body>
    </html>
  );
}
