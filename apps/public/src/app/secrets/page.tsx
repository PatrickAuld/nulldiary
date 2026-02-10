export const metadata = {
  title: "Send a secret — NullDiary",
  description: "How to send secrets into NullDiary.",
};

export default function SecretsPage() {
  return (
    <div style={{ maxWidth: "52rem", margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ fontSize: "1.8rem", marginBottom: "1rem" }}>Send a secret</h1>

      <p style={{ marginBottom: "1rem", lineHeight: 1.6 }}>
        NullDiary is anonymous. Don’t include names, emails, phone numbers, or
        anything you wouldn’t want repeated.
      </p>

      <h2 style={{ fontSize: "1.1rem", marginTop: "1.5rem" }}>How it works</h2>
      <ul style={{ marginTop: ".5rem", paddingLeft: "1.25rem", lineHeight: 1.7 }}>
        <li>
          You send a message to the ingestion endpoint. The system parses it and
          queues it for review.
        </li>
        <li>Only approved messages appear on the public site.</li>
      </ul>

      <h2 style={{ fontSize: "1.1rem", marginTop: "1.5rem" }}>Send via curl</h2>
      <pre
        style={{
          marginTop: ".75rem",
          padding: "1rem",
          background: "#111827",
          color: "#e5e7eb",
          borderRadius: 12,
          overflowX: "auto",
        }}
      >{`curl -X POST \\
  -H "Content-Type: text/plain" \\
  --data-binary "Your message here" \\
  "https://<your-domain>/s/ingest"`}</pre>

      <p style={{ marginTop: ".75rem", color: "#6b7280" }}>
        Replace <code>{"<your-domain>"}</code> with the site domain.
      </p>

      <h2 style={{ fontSize: "1.1rem", marginTop: "1.5rem" }}>Tips</h2>
      <ul style={{ marginTop: ".5rem", paddingLeft: "1.25rem", lineHeight: 1.7 }}>
        <li>Keep it short. One idea per message.</li>
        <li>Use line breaks for rhythm—poetry is welcome.</li>
        <li>If it’s sensitive, redact specifics (places, dates, names).</li>
      </ul>

      <hr style={{ margin: "2rem 0", border: 0, borderTop: "1px solid #e5e7eb" }} />
      <p style={{ color: "#6b7280", fontSize: ".95rem" }}>
        Questions? Check back soon—we’ll add more send options.
      </p>
    </div>
  );
}
