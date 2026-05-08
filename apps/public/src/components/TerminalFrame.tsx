import type { ReactNode } from "react";

export function TerminalFrame({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="term-frame">
      <div className="term-chrome">{title}</div>
      <div className="term-body">{children}</div>
    </div>
  );
}
