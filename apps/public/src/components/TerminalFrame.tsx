import type { ReactNode } from "react";

export function TerminalFrame({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const separator = " — ";
  const sepIndex = title.indexOf(separator);
  const home = sepIndex === -1 ? title : title.slice(0, sepIndex);
  const rest = sepIndex === -1 ? "" : title.slice(sepIndex);
  return (
    <div className="term-frame">
      <div className="term-chrome">
        <a href="/" className="term-home">
          {home}
        </a>
        {rest}
      </div>
      <div className="term-body">{children}</div>
    </div>
  );
}
