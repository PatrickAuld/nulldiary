import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Post Secret - Admin',
  description: 'Moderation dashboard for AI Post Secret',
  robots: 'noindex, nofollow',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
