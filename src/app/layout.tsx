import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chousei - イベント予約",
  description: "イベント予約調整システム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900 font-sans">
        {children}
      </body>
    </html>
  );
}
