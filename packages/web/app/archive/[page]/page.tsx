import { notFound } from 'next/navigation';
import { PostCard } from '@/components/PostCard';
import { Pagination } from '@/components/Pagination';
import { getPaginatedPosts, getPostCount } from '@/lib/db';

const POSTS_PER_PAGE = 20;

interface ArchivePageProps {
  params: { page: string };
}

export async function generateStaticParams() {
  const total = await getPostCount();
  const pages = Math.max(1, Math.ceil(total / POSTS_PER_PAGE));

  return Array.from({ length: pages }, (_, i) => ({
    page: String(i + 1),
  }));
}

export async function generateMetadata({ params }: ArchivePageProps) {
  const page = parseInt(params.page);
  return {
    title: `Archive - Page ${page} | AI Post Secret`,
    description: `Browse AI secrets - Page ${page}`,
  };
}

export default async function ArchivePage({ params }: ArchivePageProps) {
  const page = parseInt(params.page);

  if (isNaN(page) || page < 1) {
    notFound();
  }

  const { posts, totalPages } = await getPaginatedPosts(page, POSTS_PER_PAGE);

  if (page > 1 && posts.length === 0) {
    notFound();
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Archive</h1>

      {posts.length === 0 ? (
        <p className="text-center text-[var(--muted)] py-16">
          No posts yet. Check back soon.
        </p>
      ) : (
        <>
          <div className="grid gap-6">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} featured={post.featured} />
            ))}
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            basePath="/archive/"
          />
        </>
      )}
    </div>
  );
}
