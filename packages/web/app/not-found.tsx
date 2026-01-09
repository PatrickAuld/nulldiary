export default function NotFound() {
  return (
    <div className="text-center py-16">
      <h1 className="text-4xl font-bold mb-4">404</h1>
      <p className="text-xl text-[var(--muted)] mb-8">
        This secret doesn&apos;t exist (yet).
      </p>
      <a
        href="/"
        className="inline-block px-6 py-3 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-light)] transition-colors"
      >
        Back to home
      </a>
    </div>
  );
}
