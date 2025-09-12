import type { Metadata } from "next";
import "./globals.css";
import "./lib/envSetup";

export const metadata: Metadata = {
  title: "عامل‌های API بلادرنگ",
  description: "یک برنامه دمو از OpenAI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa">
      <body className={`antialiased`}>{children}</body>
    </html>
  );
}
