import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { getStats, getSubmissions } from '@/lib/db';
import { AdminLayout } from '@/components/AdminLayout';
import { DashboardClient } from './client';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    redirect('/login');
  }

  const [stats, recentSubmissions] = await Promise.all([
    getStats(),
    getSubmissions(undefined, 10),
  ]);

  return (
    <AdminLayout currentPage="/dashboard">
      <DashboardClient stats={stats} recentSubmissions={recentSubmissions} />
    </AdminLayout>
  );
}
