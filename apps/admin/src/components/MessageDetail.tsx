import type { messages, ingestionEvents } from "@nulldiary/db";

type Message = typeof messages.$inferSelect;
type IngestionEvent = typeof ingestionEvents.$inferSelect;

export function MessageDetail({
  message,
  events,
}: {
  message: Message;
  events: IngestionEvent[];
}) {
  return (
    <div>
      <div className="detail-section">
        <h2>Message</h2>
        <p>
          <strong>Status:</strong>{" "}
          <span className="status-badge" data-status={message.moderationStatus}>
            {message.moderationStatus}
          </span>
        </p>
        <p>
          <strong>Created:</strong>{" "}
          {new Date(message.createdAt).toLocaleString()}
        </p>
        {message.moderatedBy && (
          <p>
            <strong>Moderated by:</strong> {message.moderatedBy}
          </p>
        )}
        <pre>{message.content}</pre>
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
                {new Date(evt.receivedAt).toLocaleString()}
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
