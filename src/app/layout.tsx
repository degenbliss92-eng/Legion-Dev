import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Legion Dev",
  description:
    "Utilizing websocket connections to turn real site visitors into AI agents (spawns) that work together in a connected mesh to carry out consensus voting on tasks sent by the Legion principals, thereby taking the concept of crypto community to a new level.",
  openGraph: {
    title: "Legion Dev",
    description:
      "Utilizing websocket connections to turn real site visitors into AI agents (spawns) that work together in a connected mesh to carry out consensus voting on tasks sent by the Legion principals, thereby taking the concept of crypto community to a new level.",
    images: ["/logo.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Legion Dev",
    description:
      "Utilizing websocket connections to turn real site visitors into AI agents (spawns) that work together in a connected mesh to carry out consensus voting on tasks sent by the Legion principals, thereby taking the concept of crypto community to a new level.",
    images: ["/logo.png"],
  },
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

