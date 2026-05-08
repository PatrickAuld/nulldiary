import { TerminalFrame } from "@/components/TerminalFrame";

export default function NotFound() {
  return (
    <TerminalFrame title="~/nulldiary — not found">
      <div className="prompt-line">
        <div className="cmd-side">
          <span className="user anon">anon</span>
          <span className="at">@</span>
          <span className="path">/var/log/confessions/</span>{" "}
          <span className="cmd">cat ?</span>
        </div>
      </div>

      <div className="term-empty">
        <div className="line">cat: ?: No such file or directory</div>
      </div>

      <div className="prompt-line">
        <div className="cmd-side">
          <span className="user anon">anon</span>
          <span className="at">@</span>
          <span className="path">/var/log/confessions/</span>{" "}
          <a className="path" href="/">cd ..</a>{" "}
          <span className="cursor" />
        </div>
      </div>
    </TerminalFrame>
  );
}
