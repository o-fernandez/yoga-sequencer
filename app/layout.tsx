import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import SWRegister from "./sw-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Editorial display serif — gives headings a crafted, hand-made feel
// rather than a clinical, dashboard one.
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Yoga Sequencer",
  description: "Plan, save, and teach your yoga sequences",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Yoga Seq",
  },
};

export const viewport: Viewport = {
  themeColor: "#2d1b0e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <SWRegister />
      </body>
    </html>
  );
}
