"use client";

import { usePathname } from "next/navigation";
import { UserNav } from "./UserNav";

export function AppNav() {
  const pathname = usePathname();

  // Hide navigation on the login page.
  if (pathname === "/login") return null;

  return (
    <nav>
      <a href="/messages">Messages</a>
      <a href="/featured">Featured</a>
      <a href="/db-ops">DB Ops</a>
      <UserNav />
    </nav>
  );
}
