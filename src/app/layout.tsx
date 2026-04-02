import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JUP Signals — Perps Trading Dashboard",
  description: "Real-time trading signals for Jupiter Perps with EMA Cross 20/200 analysis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className="antialiased bg-gray-950 font-sans">
        {children}
      </body>
    </html>
  );
}

