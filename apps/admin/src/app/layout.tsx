import type { ReactNode } from "react";
import { AppNav } from "@/components/AppNav";
import "./globals.css";

export const metadata = {
  title: "Admin - Nulldiary",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppNav />
        <main>{children}</main>
      </body>
    </html>
  );
}
