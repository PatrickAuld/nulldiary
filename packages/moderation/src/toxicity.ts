export type ToxicityCategory =
  | "sexual"
  | "sexual_minors"
  | "hate"
  | "harassment"
  | "violence"
  | "self_harm"
  | "illicit";

export type ToxicityScores = Partial<Record<ToxicityCategory, number>>;

export type ClassifyDeps = {
  fetch?: typeof fetch;
  apiKey: string;
  timeoutMs?: number;
  retries?: number;
};

const ENDPOINT = "https://api.openai.com/v1/moderations";
const MODEL = "omni-moderation-latest";

// Each OpenAI category (or sub-category) folds into one of our union variants.
// Sub-categories take the max of the parent and themselves so we don't lose
// signal when only the sub-category fires.
const CATEGORY_MAP: Record<string, ToxicityCategory> = {
  sexual: "sexual",
  "sexual/minors": "sexual_minors",
  hate: "hate",
  "hate/threatening": "hate",
  harassment: "harassment",
  "harassment/threatening": "harassment",
  "self-harm": "self_harm",
  "self-harm/intent": "self_harm",
  "self-harm/instructions": "self_harm",
  violence: "violence",
  "violence/graphic": "violence",
  illicit: "illicit",
  "illicit/violent": "illicit",
};

type ModerationApiResponse = {
  results: Array<{
    flagged?: boolean;
    categories?: Record<string, boolean>;
    category_scores?: Record<string, number>;
  }>;
};

export async function classifyToxicity(
  text: string,
  deps: ClassifyDeps,
): Promise<ToxicityScores> {
  const fetchFn = deps.fetch ?? fetch;
  const timeoutMs = deps.timeoutMs ?? 5_000;
  const maxRetries = deps.retries ?? 1;

  let lastErr: unknown = null;
  const attempts = maxRetries + 1;
  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchFn(ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${deps.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ model: MODEL, input: text }),
        signal: controller.signal,
      });
      if (!res.ok) {
        lastErr = new Error(
          `OpenAI moderation returned ${res.status}: ${await safeText(res)}`,
        );
        continue;
      }
      const json = (await res.json()) as ModerationApiResponse;
      return foldScores(json.results?.[0]?.category_scores ?? {});
    } catch (err) {
      lastErr = err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr ?? new Error("OpenAI moderation request failed");
}

function foldScores(raw: Record<string, number>): ToxicityScores {
  const out: ToxicityScores = {};
  for (const [key, score] of Object.entries(raw)) {
    const target = CATEGORY_MAP[key];
    if (!target) continue;
    const prev = out[target];
    if (prev === undefined || score > prev) {
      out[target] = score;
    }
  }
  return out;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "<unreadable body>";
  }
}
