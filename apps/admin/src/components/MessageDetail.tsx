import type { IngestionEvent, Message } from "@nulldiary/db";

function getPublicContent(message: Message): string {
  const edited = message.edited_content;
  if (edited && edited.trim().length > 0) return edited;
  return message.content;
}

export function MessageDetail({
  message,
  events,
}: {
  message: Message;
  events: IngestionEvent[];
}) {
  const publicContent = getPublicContent(message);

  return (
    <div>
      <div className="detail-section">
        <h2>Message</h2>
        <p>
          <strong>Status:</strong>{" "}
          <span
            className="status-badge"
            data-status={message.moderation_status}
          >
            {message.moderation_status}
          </span>
        </p>
        <p>
          <strong>Created:</strong>{" "}
          {new Date(message.created_at).toLocaleString()}
        </p>
        {message.moderated_by && (
          <p>
            <strong>Moderated by:</strong> {message.moderated_by}
          </p>
        )}

        <h3 style={{ marginTop: "1rem" }}>What will be shown</h3>
        <pre>{publicContent}</pre>

        <details style={{ marginTop: "0.75rem" }}>
          <summary style={{ cursor: "pointer" }}>Original message</summary>
          <pre style={{ marginTop: "0.5rem" }}>{message.content}</pre>
        </details>
      </div>

      <div className="detail-section">
        <h2>Ingestion Events ({events.length})</h2>
        {events.length === 0 ? (
          <p>No ingestion events found.</p>
        ) : (
          events.map((evt) => (
            <details key={evt.id} style={{ marginBottom: "0.5rem" }}>
              <summary>
                {evt.method} {evt.path} —{" "}
                {new Date(evt.received_at).toLocaleString()}
              </summary>
              <pre>
                {JSON.stringify(
                  { headers: evt.headers, query: evt.query, body: evt.body },
                  null,
                  2,
                )}
              </pre>
            </details>
          ))
        )}
      </div>
    </div>
  );
}
