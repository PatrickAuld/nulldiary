'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface AdminLayoutProps {
  children: React.ReactNode;
  currentPage?: string;
}

export function AdminLayout({ children, currentPage }: AdminLayoutProps) {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const navItems = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/queue', label: 'Queue' },
  ];

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--card-border)]">
        <nav className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="text-xl font-bold">APS Admin</span>
            <div className="flex gap-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`hover:text-[var(--accent)] ${
                    currentPage === item.href
                      ? 'text-[var(--accent)]'
                      : 'text-[var(--muted)]'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-[var(--muted)] hover:text-[var(--danger)]"
          >
            Sign out
          </button>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
