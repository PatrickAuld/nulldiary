'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Submission } from '@/lib/types';
import { SubmissionCard } from '@/components/SubmissionCard';

interface QueueClientProps {
  submissions: Submission[];
}

export function QueueClient({ submissions: initialSubmissions }: QueueClientProps) {
  const router = useRouter();
  const [submissions, setSubmissions] = useState(initialSubmissions);

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
      // Remove from queue
      setSubmissions((prev) => prev.filter((s) => s.id !== id));
      router.refresh();
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Moderation Queue</h1>
        <span className="text-[var(--muted)]">
          {submissions.length} pending
        </span>
      </div>

      {submissions.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-xl text-[var(--muted)]">
            Queue is empty! All caught up.
          </p>
        </div>
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
