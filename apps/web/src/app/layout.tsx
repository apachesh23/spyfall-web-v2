import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Tektur } from "next/font/google";
import "./globals.css";
import "./global-effects.css";
import { GlobalRouteLoader } from "@/shared/components/layout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const tektur = Tektur({
  variable: "--font-tektur",
  subsets: ["latin", "latin-ext"],
});

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  title: "Spyfall",
  description: "Spyfall game",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/duck-favicon.ico?v=2" },
      { url: "/duck-favicon-16x16.png?v=2", sizes: "16x16", type: "image/png" },
      { url: "/duck-favicon-32x32.png?v=2", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: [{ url: "/duck-favicon.ico?v=2" }],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Spyfall",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${tektur.variable} antialiased`}
      >
        <GlobalRouteLoader />
        {children}
      </body>
    </html>
  );
}
