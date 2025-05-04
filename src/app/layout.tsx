import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthNavWrapper from "@/app/components/AuthNavWrapper";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Volta Research Interviews",
  description: "Conduct research interviews for support engagements",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-white text-gray-900`}>
        <AuthNavWrapper />
        <main>{children}</main>
      </body>
    </html>
  );
}
