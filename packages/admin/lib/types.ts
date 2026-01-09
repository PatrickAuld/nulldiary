export interface Submission {
  id: string;
  message: string;
  messageLength: number;
  author?: string;
  model?: string;
  tags?: string[];
  context?: string;
  status: 'pending' | 'approved' | 'rejected' | 'spam';
  submittedAt: string;
  moderatedAt?: string;
  moderatedBy?: string;
  moderationNotes?: string;
  publishedAt?: string;
  slug?: string;
  featured: boolean;
  // Request metadata
  requestMethod: string;
  cfCountry?: string;
  cfCity?: string;
  userAgent?: string;
  cfBotScore?: number;
}

export interface SubmissionStats {
  pending: number;
  approved: number;
  rejected: number;
  spam: number;
  total: number;
}

export interface ModerationAction {
  action: 'approve' | 'reject' | 'spam' | 'unreview';
  submissionId: string;
  notes?: string;
  featured?: boolean;
}
