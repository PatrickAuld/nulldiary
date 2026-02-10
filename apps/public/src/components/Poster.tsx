function textureClassFromId(id: string) {
  // Deterministic but cheap: hash last 2 hex chars (uuid-ish) into 0..5
  const tail = id.slice(-2);
  const n = Number.parseInt(tail, 16);
  const idx = Number.isFinite(n) ? n % 6 : 0;
  return `texture-${idx}`;
}

export function Poster({
  id,
  content,
  approvedAt,
}: {
  id: string;
  content: string;
  approvedAt: Date | null;
}) {
  const displayDate = approvedAt
    ? approvedAt.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <section className={`poster ${textureClassFromId(id)}`}>
      <div className="poster-inner">
        <div className="poster-card">
          <div className="message">{content}</div>
          <div className="meta">
            <span className="pill">anonymous</span>
            <span>
              {displayDate ? <time>{displayDate}</time> : null}{" "}
              <a href={`/messages/${id}`}>open</a>
            </span>
          </div>
          <div className="footer-links">
            <a href={`/messages/${id}`}>Permalink</a>
            <a href="#top">Top</a>
          </div>
        </div>
      </div>
    </section>
  );
}
