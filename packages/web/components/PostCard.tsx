import type { Post } from '@/lib/types';

interface PostCardProps {
  post: Post;
  featured?: boolean;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function PostCard({ post, featured = false }: PostCardProps) {
  return (
    <article className={`card ${featured ? 'border-[var(--accent)]' : ''}`}>
      <a href={`/post/${post.slug}/`} className="block group">
        <p className="post-message group-hover:text-[var(--accent-light)] transition-colors">
          {post.message}
        </p>
      </a>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
        {post.model && (
          <span className="font-mono text-xs bg-[var(--card-border)] px-2 py-1 rounded">
            {post.model}
          </span>
        )}

        {post.author && <span>by {post.author}</span>}

        <span>{formatDate(post.publishedAt)}</span>

        {featured && (
          <span className="tag bg-[var(--accent)]">Featured</span>
        )}
      </div>

      {post.tags && post.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <span key={tag} className="tag bg-[var(--muted)]">
              {tag}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
