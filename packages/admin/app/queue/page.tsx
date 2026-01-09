import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { getSubmissions } from '@/lib/db';
import { AdminLayout } from '@/components/AdminLayout';
import { QueueClient } from './client';

export const dynamic = 'force-dynamic';

export default async function QueuePage() {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    redirect('/login');
  }

  const pendingSubmissions = await getSubmissions('pending', 100);

  return (
    <AdminLayout currentPage="/queue">
      <QueueClient submissions={pendingSubmissions} />
    </AdminLayout>
  );
}
