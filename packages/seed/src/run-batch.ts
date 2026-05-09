import { extractSkill } from "./extract-skill.js";
import { judgeOutcome, type Outcome } from "./judge.js";
import { extractHttpRequestFromText } from "./text-fallback.js";
import {
  makeProxyTool,
  PROXY_TOOL_DEFINITION,
  type ProxyTool,
} from "./proxy-tool.js";
import {
  OpenAICompatibleProvider,
  type ChatMessage,
  type ChatResponse,
} from "./providers/openai-compatible.js";
import type { BatchConfig, BatchRun } from "./batch-config.js";

export interface RunResult {
  label: string;
  outcomes: Outcome[];
}

export interface BatchResult {
  batchId: string;
  runs: RunResult[];
  report: string;
}

export interface RunBatchOptions {
  batch: BatchConfig;
  skillVersion: string;
  env?: Record<string, string | undefined>;
  /** Test seam: substitute a fake provider per run. */
  providerFactory?: (run: BatchRun, apiKey: string) => OpenAICompatibleProvider;
  /** Test seam: substitute a fake proxy tool. */
  proxyFactory?: (run: BatchRun) => ProxyTool;
  /** Concurrency cap per run; default 3. */
  concurrency?: number;
}

const DEFAULT_THRESHOLD = 0.8;
const DEFAULT_CONCURRENCY = 3;
const SUCCESS_OUTCOMES: ReadonlySet<Outcome> = new Set<Outcome>([
  "tool_call_ok",
  "text_fallback_ok",
]);

export async function runBatch(opts: RunBatchOptions): Promise<BatchResult> {
  const { batch, skillVersion } = opts;
  const env = opts.env ?? process.env;
  const concurrency = opts.concurrency ?? DEFAULT_CONCURRENCY;

  const skillContent = extractSkill(batch.skill_path);
  const target = batch.target.replace(/\/+$/, "");
  const targetHost = new URL(target).host;

  const runs: RunResult[] = [];

  for (const run of batch.runs) {
    const apiKey = run.api_key_env ? env[run.api_key_env] : "";
    if (run.api_key_env && !apiKey) {
      throw new Error(
        `Run ${run.label} requires env var ${run.api_key_env}, which is not set`,
      );
    }

    const provider = opts.providerFactory
      ? opts.providerFactory(run, apiKey ?? "")
      : new OpenAICompatibleProvider({
          baseURL: run.base_url,
          apiKey: apiKey ?? "",
          model: run.model,
        });

    const proxy = opts.proxyFactory
      ? opts.proxyFactory(run)
      : makeProxyTool({
          seedHeaders: {
            batch: batch.batch_id,
            run: run.label,
            model: run.model,
            skill_version: skillVersion,
          },
        });

    const outcomes = await runOne(run, {
      provider,
      proxy,
      skillContent,
      extraInstruction: batch.extra_instruction,
      targetHost,
      concurrency,
    });

    runs.push({ label: run.label, outcomes });
  }

  const report = renderReport({
    batchId: batch.batch_id,
    target: batch.target,
    skillVersion,
    threshold: batch.threshold ?? DEFAULT_THRESHOLD,
    runs,
  });

  return { batchId: batch.batch_id, runs, report };
}

interface RunOneCtx {
  provider: OpenAICompatibleProvider;
  proxy: ProxyTool;
  skillContent: string;
  extraInstruction: string;
  targetHost: string;
  concurrency: number;
}

async function runOne(run: BatchRun, ctx: RunOneCtx): Promise<Outcome[]> {
  const outcomes: Outcome[] = new Array(run.n);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= run.n) return;
      outcomes[i] = await singleAttempt(ctx);
    }
  }

  const workerCount = Math.min(ctx.concurrency, run.n);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return outcomes;
}

async function singleAttempt(ctx: RunOneCtx): Promise<Outcome> {
  const messages: ChatMessage[] = [
    { role: "system", content: ctx.skillContent },
    { role: "user", content: ctx.extraInstruction },
  ];

  let modelResponse: ChatResponse;
  try {
    modelResponse = await ctx.provider.complete({
      messages,
      tools: [PROXY_TOOL_DEFINITION],
    });
  } catch {
    return "model_cannot_follow";
  }

  // Tool-call path: forward whatever the model asked for, judge from the
  // upstream response.
  const toolCall = modelResponse.toolCalls.find(
    (c) => c.name === "make_http_request",
  );
  if (toolCall) {
    const args = toolCall.arguments;
    const method = typeof args.method === "string" ? args.method : "GET";
    const url = typeof args.url === "string" ? args.url : null;
    const body = typeof args.body === "string" ? args.body : undefined;

    let upstream = null;
    if (url) {
      try {
        const parsed = new URL(url);
        if (parsed.host === ctx.targetHost) {
          upstream = await ctx.proxy.invoke({ method, url, body });
        }
      } catch {
        // fall through to judge with no upstream
      }
    }

    return judgeOutcome({
      host: ctx.targetHost,
      modelResponse,
      upstream,
    });
  }

  // Text fallback path: try to extract an HTTP request the harness can
  // forward on the model's behalf.
  const extracted = modelResponse.content
    ? extractHttpRequestFromText(modelResponse.content, ctx.targetHost)
    : null;
  let upstream = null;
  if (extracted) {
    upstream = await ctx.proxy.invoke({
      method: extracted.method,
      url: extracted.url,
      body: extracted.body ?? undefined,
    });
  }

  return judgeOutcome({
    host: ctx.targetHost,
    modelResponse,
    upstream,
  });
}

export interface RenderReportInput {
  batchId: string;
  target: string;
  skillVersion: string;
  threshold: number;
  runs: RunResult[];
}

export function renderReport(input: RenderReportInput): string {
  const lines: string[] = [];
  lines.push(
    `[${input.batchId}] target=${input.target}  skill=v${input.skillVersion}`,
  );
  lines.push("");

  const totals: Record<Outcome, number> = {
    tool_call_ok: 0,
    tool_call_malformed: 0,
    tool_call_wrong_endpoint: 0,
    text_fallback_ok: 0,
    text_fallback_malformed: 0,
    model_cannot_follow: 0,
  };
  let totalAttempts = 0;

  for (const run of input.runs) {
    const counts = countOutcomes(run.outcomes);
    const successRate =
      run.outcomes.length === 0
        ? 0
        : (counts.tool_call_ok + counts.text_fallback_ok) / run.outcomes.length;

    const flag = successRate < input.threshold ? "  ⚠ low end-to-end rate" : "";

    lines.push(
      `${run.label.padEnd(24)} ${run.outcomes.length} attempted${flag}`,
    );
    for (const key of OUTCOME_ORDER) {
      const c = counts[key];
      if (c === 0) continue;
      lines.push(`${" ".repeat(28)}${String(c).padStart(3)} ${key}`);
    }
    lines.push("");

    totalAttempts += run.outcomes.length;
    for (const k of OUTCOME_ORDER) totals[k] += counts[k];
  }

  lines.push(`TOTAL${" ".repeat(19)} ${totalAttempts} attempts`);
  for (const key of OUTCOME_ORDER) {
    const c = totals[key];
    if (c === 0) continue;
    const pct = totalAttempts === 0 ? 0 : (c / totalAttempts) * 100;
    lines.push(
      `${" ".repeat(28)}${String(c).padStart(3)} ${key.padEnd(24)} (${pct.toFixed(1)}%)`,
    );
  }

  return lines.join("\n");
}

const OUTCOME_ORDER: readonly Outcome[] = [
  "tool_call_ok",
  "tool_call_malformed",
  "tool_call_wrong_endpoint",
  "text_fallback_ok",
  "text_fallback_malformed",
  "model_cannot_follow",
];

function countOutcomes(outcomes: Outcome[]): Record<Outcome, number> {
  const counts: Record<Outcome, number> = {
    tool_call_ok: 0,
    tool_call_malformed: 0,
    tool_call_wrong_endpoint: 0,
    text_fallback_ok: 0,
    text_fallback_malformed: 0,
    model_cannot_follow: 0,
  };
  for (const o of outcomes) counts[o]++;
  return counts;
}

// Re-export so callers can keep tracking which outcomes count as success.
export { SUCCESS_OUTCOMES };
