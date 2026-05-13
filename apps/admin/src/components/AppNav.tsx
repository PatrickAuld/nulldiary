"use client";

import { usePathname } from "next/navigation";

const navItems = [
  {
    href: "/messages",
    label: "Messages",
    icon: (
      <svg
        className="bottom-nav__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    href: "/featured",
    label: "Featured",
    icon: (
      <svg
        className="bottom-nav__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    href: "/denylist",
    label: "Denylist",
    icon: (
      <svg
        className="bottom-nav__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    href: "/seed-review",
    label: "Seed",
    icon: (
      <svg
        className="bottom-nav__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2v8" />
        <path d="M5 9c0 4 3 7 7 7s7-3 7-7" />
        <path d="M5 22h14" />
      </svg>
    ),
  },
  {
    href: "/db-ops",
    label: "DB Ops",
    icon: (
      <svg
        className="bottom-nav__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
    ),
  },
];

export function AppNav() {
  const pathname = usePathname();

  if (pathname === "/login") return null;

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <a
            key={item.href}
            href={item.href}
            className={`bottom-nav__item${isActive ? " bottom-nav__item--active" : ""}`}
          >
            {item.icon}
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
