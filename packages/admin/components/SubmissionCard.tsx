'use client';

import { useState } from 'react';
import type { Submission } from '@/lib/types';

interface SubmissionCardProps {
  submission: Submission;
  onModerate: (
    id: string,
    action: 'approve' | 'reject' | 'spam' | 'unreview',
    featured?: boolean
  ) => Promise<void>;
  showActions?: boolean;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusClass(status: Submission['status']): string {
  switch (status) {
    case 'pending':
      return 'status-pending';
    case 'approved':
      return 'status-approved';
    case 'rejected':
      return 'status-rejected';
    case 'spam':
      return 'status-spam';
    default:
      return '';
  }
}

export function SubmissionCard({
  submission,
  onModerate,
  showActions = true,
}: SubmissionCardProps) {
  const [loading, setLoading] = useState(false);
  const [featured, setFeatured] = useState(submission.featured);

  async function handleAction(action: 'approve' | 'reject' | 'spam' | 'unreview') {
    setLoading(true);
    try {
      await onModerate(submission.id, action, action === 'approve' ? featured : false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-4 mb-3">
        <span className={`status-badge ${getStatusClass(submission.status)}`}>
          {submission.status}
        </span>
        <span className="text-xs text-[var(--muted)]">
          {formatDate(submission.submittedAt)}
        </span>
      </div>

      <p className="text-sm whitespace-pre-wrap mb-4">{submission.message}</p>

      <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)] mb-4">
        {submission.model && (
          <span className="bg-[var(--card-border)] px-2 py-1 rounded font-mono">
            {submission.model}
          </span>
        )}
        {submission.author && <span>by {submission.author}</span>}
        {submission.cfCountry && <span>{submission.cfCountry}</span>}
        {submission.cfBotScore !== undefined && (
          <span>Bot Score: {submission.cfBotScore}</span>
        )}
        <span className="font-mono">{submission.requestMethod}</span>
      </div>

      {submission.tags && submission.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {submission.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs bg-[var(--muted)] text-white px-2 py-0.5 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {submission.context && (
        <p className="text-xs text-[var(--muted)] italic mb-4">
          Context: {submission.context}
        </p>
      )}

      {showActions && submission.status === 'pending' && (
        <div className="flex items-center gap-3 pt-3 border-t border-[var(--card-border)]">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className="rounded"
            />
            Featured
          </label>

          <div className="flex-1" />

          <button
            onClick={() => handleAction('spam')}
            disabled={loading}
            className="btn btn-secondary text-sm disabled:opacity-50"
          >
            Spam
          </button>
          <button
            onClick={() => handleAction('reject')}
            disabled={loading}
            className="btn btn-danger text-sm disabled:opacity-50"
          >
            Reject
          </button>
          <button
            onClick={() => handleAction('approve')}
            disabled={loading}
            className="btn btn-success text-sm disabled:opacity-50"
          >
            Approve
          </button>
        </div>
      )}

      {showActions && submission.status !== 'pending' && (
        <div className="flex items-center gap-3 pt-3 border-t border-[var(--card-border)]">
          {submission.moderatedBy && (
            <span className="text-xs text-[var(--muted)]">
              Moderated by {submission.moderatedBy}
            </span>
          )}
          <div className="flex-1" />
          <button
            onClick={() => handleAction('unreview')}
            disabled={loading}
            className="btn btn-secondary text-sm disabled:opacity-50"
          >
            Unreview
          </button>
        </div>
      )}
    </div>
  );
}
