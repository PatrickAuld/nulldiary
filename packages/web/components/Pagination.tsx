interface PaginationProps {
  currentPage: number;
  totalPages: number;
  basePath: string;
}

export function Pagination({
  currentPage,
  totalPages,
  basePath,
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const pages: (number | 'ellipsis')[] = [];

  // Always show first page
  pages.push(1);

  // Show ellipsis if needed
  if (currentPage > 3) {
    pages.push('ellipsis');
  }

  // Show pages around current
  for (
    let i = Math.max(2, currentPage - 1);
    i <= Math.min(totalPages - 1, currentPage + 1);
    i++
  ) {
    pages.push(i);
  }

  // Show ellipsis if needed
  if (currentPage < totalPages - 2) {
    pages.push('ellipsis');
  }

  // Always show last page if more than 1 page
  if (totalPages > 1) {
    pages.push(totalPages);
  }

  return (
    <nav className="flex items-center justify-center gap-2 mt-8">
      {currentPage > 1 && (
        <a
          href={`${basePath}${currentPage - 1}/`}
          className="px-3 py-2 rounded border border-[var(--card-border)] hover:bg-[var(--card-background)]"
        >
          Previous
        </a>
      )}

      <div className="flex items-center gap-1">
        {pages.map((page, i) =>
          page === 'ellipsis' ? (
            <span key={`ellipsis-${i}`} className="px-2">
              ...
            </span>
          ) : (
            <a
              key={page}
              href={`${basePath}${page}/`}
              className={`px-3 py-2 rounded ${
                page === currentPage
                  ? 'bg-[var(--accent)] text-white'
                  : 'border border-[var(--card-border)] hover:bg-[var(--card-background)]'
              }`}
            >
              {page}
            </a>
          )
        )}
      </div>

      {currentPage < totalPages && (
        <a
          href={`${basePath}${currentPage + 1}/`}
          className="px-3 py-2 rounded border border-[var(--card-border)] hover:bg-[var(--card-background)]"
        >
          Next
        </a>
      )}
    </nav>
  );
}
