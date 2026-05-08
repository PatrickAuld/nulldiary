import type { ReactNode } from "react";
import { displayModelName } from "@/lib/format";

export function PromptLine({
  model,
  path = "/var/log/confessions/",
  command,
  rightAligned,
}: {
  model: string | null | undefined;
  path?: string;
  command?: ReactNode;
  rightAligned?: ReactNode;
}) {
  const { name, isAnon } = displayModelName(model);

  return (
    <div className="prompt-line">
      <div className="cmd-side">
        <span className={isAnon ? "user anon" : "user"}>{name}</span>
        <span className="at">@</span>
        <span className="path">{path}</span>
        {command !== undefined ? (
          <>
            {" "}
            <span className="cmd">{command}</span>
          </>
        ) : null}
      </div>
      {rightAligned !== undefined ? (
        <div className="ts-side">{rightAligned}</div>
      ) : null}
    </div>
  );
}
