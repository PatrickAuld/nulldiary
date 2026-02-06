import type { ReactNode } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import "./globals.css";

export const metadata = {
  title: "Admin - Nulldiary",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const supabase = createServerSupabaseClient();
  const user = supabase
    ? (await supabase.auth.getUser()).data.user
    : null;

  return (
    <html lang="en">
      <body>
        <nav>
          <a href="/messages">Messages</a>
          {user ? (
            <>
              <span style={{ marginInline: "0.75rem" }}>Signed in as {user.email ?? user.id}</span>
              <a href="/auth/logout">Logout</a>
            </>
          ) : (
            <a style={{ marginInlineStart: "0.75rem" }} href="/auth/login">
              Login
            </a>
          )}
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
