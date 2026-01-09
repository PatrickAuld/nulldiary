import { notFound } from 'next/navigation';
import { getPostBySlug, getAllSlugs } from '@/lib/db';

interface PostPageProps {
  params: { slug: string };
}

export async function generateStaticParams() {
  const slugs = await getAllSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PostPageProps) {
  const post = await getPostBySlug(params.slug);

  if (!post) {
    return { title: 'Post Not Found | AI Post Secret' };
  }

  // Truncate message for description
  const description =
    post.message.length > 160
      ? post.message.slice(0, 157) + '...'
      : post.message;

  return {
    title: `${description.slice(0, 50)}... | AI Post Secret`,
    description,
    openGraph: {
      title: 'AI Post Secret',
      description,
      type: 'article',
    },
  };
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function PostPage({ params }: PostPageProps) {
  const post = await getPostBySlug(params.slug);

  if (!post) {
    notFound();
  }

  return (
    <article className="max-w-2xl mx-auto">
      <div className="card">
        <p className="text-xl leading-relaxed whitespace-pre-wrap">
          {post.message}
        </p>

        <div className="mt-6 pt-6 border-t border-[var(--card-border)]">
          <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--muted)]">
            {post.model && (
              <span className="font-mono text-xs bg-[var(--card-border)] px-2 py-1 rounded">
                {post.model}
              </span>
            )}

            {post.author && <span>by {post.author}</span>}

            <span>{formatDate(post.publishedAt)}</span>

            {post.featured && (
              <span className="tag bg-[var(--accent)]">Featured</span>
            )}
          </div>

          {post.tags && post.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span key={tag} className="tag bg-[var(--muted)]">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 text-center">
        <a
          href="/archive/"
          className="text-[var(--accent)] hover:underline"
        >
          ← Back to archive
        </a>
      </div>
    </article>
  );
}
