import type { messages } from "@nulldiary/db";

type Message = typeof messages.$inferSelect;

export function MessageList({ messages }: { messages: Message[] }) {
  if (messages.length === 0) {
    return <p>No messages found.</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Content</th>
          <th>Status</th>
          <th>Created</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {messages.map((msg) => (
          <tr key={msg.id}>
            <td>
              {msg.content.length > 100
                ? msg.content.slice(0, 100) + "..."
                : msg.content}
            </td>
            <td>
              <span className="status-badge" data-status={msg.moderationStatus}>
                {msg.moderationStatus}
              </span>
            </td>
            <td>{new Date(msg.createdAt).toLocaleString()}</td>
            <td>
              <a href={`/messages/${msg.id}`}>View</a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
