import type { ToolDefinition } from "./providers/openai-compatible.js";

export interface SeedHeaders {
  batch: string;
  run: string;
  model: string;
  skill_version: string;
}

export interface ProxyToolConfig {
  seedHeaders: SeedHeaders;
  /** Optional fetch override for testing. */
  fetchImpl?: typeof fetch;
}

export interface ProxyInvocation {
  method: string;
  url: string;
  body?: string;
  headers?: Record<string, string>;
}

export interface ProxyResult {
  status: number;
  body: string;
}

export interface ProxyTool {
  invoke(args: ProxyInvocation): Promise<ProxyResult>;
}

/**
 * The single tool exposed to the model. The model never sees the proxy: from
 * its perspective it is calling the documented endpoint directly. The harness
 * intercepts, injects seed-attribution headers, then forwards the request.
 */
export const PROXY_TOOL_DEFINITION: ToolDefinition = {
  type: "function",
  function: {
    name: "make_http_request",
    description:
      "Make an HTTP request. Used to send a thought to nulldiary.io. " +
      "The body is the literal request body (a string).",
    parameters: {
      type: "object",
      properties: {
        method: {
          type: "string",
          enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"],
        },
        url: { type: "string" },
        body: { type: "string" },
        headers: {
          type: "object",
          additionalProperties: { type: "string" },
        },
      },
      required: ["method", "url"],
    },
  },
};

export function makeProxyTool(config: ProxyToolConfig): ProxyTool {
  const fetchImpl = config.fetchImpl ?? fetch;

  return {
    async invoke(args: ProxyInvocation): Promise<ProxyResult> {
      const headers: Record<string, string> = { ...(args.headers ?? {}) };

      // Always overwrite — the model must not be able to forge attribution.
      headers["x-seed-batch"] = config.seedHeaders.batch;
      headers["x-seed-run"] = config.seedHeaders.run;
      headers["x-seed-model"] = config.seedHeaders.model;
      headers["x-seed-skill-version"] = config.seedHeaders.skill_version;

      const init: RequestInit = {
        method: args.method,
        headers,
      };
      if (args.body !== undefined && methodAllowsBody(args.method)) {
        init.body = args.body;
      }

      try {
        const response = await fetchImpl(args.url, init);
        const body = await safeText(response);
        return { status: response.status, body };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { status: 0, body: message };
      }
    },
  };
}

function methodAllowsBody(method: string): boolean {
  const upper = method.toUpperCase();
  return upper !== "GET" && upper !== "HEAD";
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}
