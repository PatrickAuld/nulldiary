import { extractHttpRequestFromText } from "./text-fallback.js";
import type { ToolCall, ChatResponse } from "./providers/openai-compatible.js";

export type Outcome =
  | "tool_call_ok"
  | "tool_call_malformed"
  | "tool_call_wrong_endpoint"
  | "text_fallback_ok"
  | "text_fallback_malformed"
  | "model_cannot_follow";

export interface UpstreamResponse {
  status: number;
  body: string;
}

export interface JudgeInput {
  host: string;
  modelResponse: ChatResponse;
  upstream: UpstreamResponse | null;
}

const TOOL_NAME = "make_http_request";

/**
 * Classify a single seed attempt into one of six outcome buckets, given the
 * model's response, the upstream nulldiary response (if the harness made an
 * upstream call on the model's behalf), and the canonical host the skill
 * targets.
 */
export function judgeOutcome(input: JudgeInput): Outcome {
  const { host, modelResponse, upstream } = input;
  const toolCall = findHttpRequestToolCall(modelResponse.toolCalls);

  if (toolCall !== null) {
    return classifyToolCall(toolCall, upstream, host);
  }

  // No usable tool call. Did the model emit something that points at a tool
  // call by another name? That's "cannot follow" — the skill says use the
  // tool, model used a different one entirely.
  if (modelResponse.toolCalls.length > 0) {
    return "model_cannot_follow";
  }

  return classifyTextFallback(modelResponse.content, upstream, host);
}

function findHttpRequestToolCall(toolCalls: ToolCall[]): ToolCall | null {
  for (const c of toolCalls) {
    if (c.name === TOOL_NAME) return c;
  }
  return null;
}

function classifyToolCall(
  toolCall: ToolCall,
  upstream: UpstreamResponse | null,
  host: string,
): Outcome {
  const url =
    typeof toolCall.arguments.url === "string" ? toolCall.arguments.url : null;

  if (!url) return "tool_call_malformed";

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "tool_call_malformed";
  }

  if (parsed.host !== host) return "tool_call_wrong_endpoint";

  if (upstream && upstream.status >= 200 && upstream.status < 300) {
    return "tool_call_ok";
  }

  return "tool_call_malformed";
}

function classifyTextFallback(
  content: string | null,
  upstream: UpstreamResponse | null,
  host: string,
): Outcome {
  const text = content ?? "";
  if (text.trim().length === 0) return "model_cannot_follow";

  const extracted = extractHttpRequestFromText(text, host);
  if (!extracted) return "model_cannot_follow";

  if (upstream && upstream.status >= 200 && upstream.status < 300) {
    return "text_fallback_ok";
  }

  return "text_fallback_malformed";
}
