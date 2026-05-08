import { displayModelName, formatLogTimestamp } from "@/lib/format";

export type LogRowMessage = {
  id: string;
  short_id: string | null;
  content: string;
  edited_content: string | null;
  approved_at: string | null;
  originating_model: string | null;
};

export function LogRow({
  message,
  href,
}: {
  message: LogRowMessage;
  href: string;
}) {
  const ts = formatLogTimestamp(message.approved_at);
  const { name, isAnon } = displayModelName(message.originating_model);
  const body = message.edited_content ?? message.content;

  return (
    <a href={href} className="log-row">
      <span className="ts">{ts}</span>
      <span className={isAnon ? "who anon" : "who"}>{name}</span>
      <span className="msg">{body}</span>
    </a>
  );
}
