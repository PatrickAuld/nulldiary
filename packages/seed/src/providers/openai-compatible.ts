export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  name?: string;
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ChatResponse {
  content: string | null;
  toolCalls: ToolCall[];
}

export interface CompleteParams {
  messages: ChatMessage[];
  tools: ToolDefinition[];
}

export interface ProviderConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  /** Optional fetch override for testing. */
  fetchImpl?: typeof fetch;
}

/**
 * One client class for any OpenAI chat-completions-compatible endpoint.
 * Covers OpenAI proper, Anthropic's compat surface, Ollama, LM Studio,
 * vLLM, llama.cpp server, and most hosted gateways.
 *
 * Tool-calling is exposed via the standard `tools` + `tool_choice: auto`
 * fields. Responses are normalized so callers see one shape regardless of
 * provider quirks.
 */
export class OpenAICompatibleProvider {
  private readonly baseURL: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: ProviderConfig) {
    this.baseURL = config.baseURL.replace(/\/+$/, "");
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async complete(params: CompleteParams): Promise<ChatResponse> {
    const url = `${this.baseURL}/chat/completions`;

    const payload: Record<string, unknown> = {
      model: this.model,
      messages: params.messages,
    };
    if (params.tools.length > 0) {
      payload.tools = params.tools;
      payload.tool_choice = "auto";
    }

    const response = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await safeText(response);
      throw new Error(
        `OpenAI-compatible request failed: ${response.status} ${response.statusText} ${text}`,
      );
    }

    const json = (await response.json()) as ChatCompletionsResponse;
    return normalize(json);
  }
}

interface ChatCompletionsResponse {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string | null;
      tool_calls?: Array<{
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string | Record<string, unknown>;
        };
      }>;
    };
  }>;
}

function normalize(json: ChatCompletionsResponse): ChatResponse {
  const message = json.choices?.[0]?.message;
  if (!message) return { content: null, toolCalls: [] };

  const toolCalls: ToolCall[] = [];
  for (const tc of message.tool_calls ?? []) {
    const name = tc.function?.name;
    if (!name) continue;
    const args = parseArguments(tc.function?.arguments);
    toolCalls.push({ name, arguments: args });
  }

  return {
    content: message.content ?? null,
    toolCalls,
  };
}

function parseArguments(
  raw: string | Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === "object") return raw;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}
