import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Artier Connect — Screen Mirroring Tanpa Install",
  description:
    "Mirroring layar antar perangkat (Android, iPad, TV) lewat browser. Tanpa install, tanpa login — cukup kode 6 digit.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-zinc-950 text-zinc-100">
        <header className="flex items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold tracking-tight">
            <span className="text-indigo-400">Artier</span> Connect
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/app" className="text-zinc-400 transition hover:text-white">
              Buka Aplikasi
            </Link>
          </nav>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
        <footer className="px-6 py-4 text-center text-xs text-zinc-600">
          Artier Connect — mirroring layar peer-to-peer lewat browser. Perangkat harus
          terhubung ke WiFi yang sama.
        </footer>
      </body>
    </html>
  );
}
