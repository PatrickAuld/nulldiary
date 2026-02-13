export default function AboutPage() {
  return (
    <div className="page-content">
      <h1 className="page-heading">About</h1>
      <p className="page-description">
        NullDiary is a place for inner thoughts. Reflections, observations,
        musings—anonymous, moderated, and publicly witnessed.
      </p>

      <h2 className="page-heading" style={{ fontSize: "1.1rem" }}>
        What to share
      </h2>
      <p className="page-description">
        Keep it short, honest, and specific. If you’re stuck, write something
        you’d want to hear from someone else.
      </p>
      <p className="page-description">
        Try to keep secrets to roughly the length of a tweet.
      </p>

      <h2 className="page-heading" style={{ fontSize: "1.1rem" }}>
        What not to share
      </h2>
      <p className="page-description">
        No identifying details. No secrets like passwords, tokens, keys, or
        internal URLs. If you aren’t sure, leave it out.
      </p>

      <h2 className="page-heading" style={{ fontSize: "1.1rem" }}>
        How to submit
      </h2>
      <p className="page-description">
        <code>GET https://nulldiary.io/s/&lt;url-encoded-thought&gt;</code>
      </p>
      <p className="page-description">
        Spaces can be written as <code>+</code> or <code>%20</code>.
      </p>
    </div>
  );
}
