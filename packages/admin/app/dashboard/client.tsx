'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Submission, SubmissionStats } from '@/lib/types';
import { SubmissionCard } from '@/components/SubmissionCard';

interface DashboardClientProps {
  stats: SubmissionStats;
  recentSubmissions: Submission[];
}

export function DashboardClient({
  stats,
  recentSubmissions: initialSubmissions,
}: DashboardClientProps) {
  const router = useRouter();
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [buildStatus, setBuildStatus] = useState<'idle' | 'building' | 'success' | 'error'>('idle');

  async function handleModerate(
    id: string,
    action: 'approve' | 'reject' | 'spam' | 'unreview',
    featured?: boolean
  ) {
    const response = await fetch('/api/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, featured }),
    });

    if (response.ok) {
      // Remove from list or update status
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, status: action === 'unreview' ? 'pending' : action === 'approve' ? 'approved' : action }
            : s
        )
      );
      router.refresh();
    }
  }

  async function handleTriggerBuild() {
    setBuildStatus('building');
    try {
      const response = await fetch('/api/build', { method: 'POST' });
      if (response.ok) {
        setBuildStatus('success');
        setTimeout(() => setBuildStatus('idle'), 3000);
      } else {
        setBuildStatus('error');
      }
    } catch {
      setBuildStatus('error');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <button
          onClick={handleTriggerBuild}
          disabled={buildStatus === 'building'}
          className="btn btn-primary disabled:opacity-50"
        >
          {buildStatus === 'building'
            ? 'Building...'
            : buildStatus === 'success'
            ? 'Build Triggered!'
            : buildStatus === 'error'
            ? 'Build Failed'
            : 'Trigger Build'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="card text-center">
          <div className="text-3xl font-bold text-[var(--warning)]">
            {stats.pending}
          </div>
          <div className="text-sm text-[var(--muted)]">Pending</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-[var(--success)]">
            {stats.approved}
          </div>
          <div className="text-sm text-[var(--muted)]">Approved</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-[var(--danger)]">
            {stats.rejected}
          </div>
          <div className="text-sm text-[var(--muted)]">Rejected</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-[var(--muted)]">
            {stats.spam}
          </div>
          <div className="text-sm text-[var(--muted)]">Spam</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold">{stats.total}</div>
          <div className="text-sm text-[var(--muted)]">Total</div>
        </div>
      </div>

      {/* Recent Submissions */}
      <h2 className="text-xl font-semibold mb-4">Recent Submissions</h2>
      {submissions.length === 0 ? (
        <p className="text-[var(--muted)]">No submissions yet.</p>
      ) : (
        <div className="grid gap-4">
          {submissions.map((submission) => (
            <SubmissionCard
              key={submission.id}
              submission={submission}
              onModerate={handleModerate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
