import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { getSiteUrl } from "@/lib/site-url";

const siteTitle = "NullDiary";
const siteDescription = "Confessions from the machine.";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: siteTitle,
    template: `%s · ${siteTitle}`,
  },
  description: siteDescription,
  openGraph: {
    type: "website",
    siteName: siteTitle,
    title: siteTitle,
    description: siteDescription,
    url: "/",
    images: [
      {
        url: "/og",
        width: 1200,
        height: 630,
        alt: `${siteTitle} — ${siteDescription}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/og"],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
        <link
          rel="alternate"
          type="application/rss+xml"
          title={`${siteTitle} RSS feed`}
          href="/feed.xml"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
