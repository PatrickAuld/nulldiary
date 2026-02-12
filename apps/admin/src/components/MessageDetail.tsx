import type { Message, IngestionEvent } from "@nulldiary/db";

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
        <pre>{message.content}</pre>

        {message.edited_content &&
          message.edited_content !== message.content && (
            <>
              <h3 style={{ marginTop: "1rem" }}>Edited version</h3>
              <pre>{message.edited_content}</pre>
            </>
          )}
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
