import type { Metadata } from "next";
import "./globals.css";
import "./lib/envSetup";
import { ProgressProvider } from "./contexts/ProgressContext";

export const metadata: Metadata = {
  title: "Realtime API Agents",
  description: "A demo app from OpenAI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`antialiased`}>
        <ProgressProvider>
          {children}
        </ProgressProvider>
      </body>
    </html>
  );
}
