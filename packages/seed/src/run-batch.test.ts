import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runBatch, renderReport } from "./run-batch.js";
import type { ChatResponse } from "./providers/openai-compatible.js";

const SKILL_FIXTURE = "---\nname: nulldiary\n---\n\nbody.\n";

function makeFixtureSkill() {
  const dir = mkdtempSync(join(tmpdir(), "seed-batch-"));
  const skillPath = join(dir, "SKILL.md");
  writeFileSync(skillPath, SKILL_FIXTURE, "utf8");
  return {
    skillPath,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

interface FakeProvider {
  complete: ReturnType<typeof vi.fn>;
}

function fakeProviderReturning(responses: ChatResponse[]): FakeProvider {
  let i = 0;
  return {
    complete: vi.fn(async () => {
      const r = responses[i] ?? responses[responses.length - 1];
      i++;
      return r;
    }),
  };
}

describe("renderReport", () => {
  it("aggregates outcomes per run and overall, including a low-rate flag", () => {
    const report = renderReport({
      batchId: "batch-test",
      target: "http://localhost:3000",
      skillVersion: "2.0",
      threshold: 0.8,
      runs: [
        {
          label: "anthropic-opus",
          outcomes: [
            "tool_call_ok",
            "tool_call_ok",
            "tool_call_ok",
            "tool_call_ok",
            "tool_call_malformed",
          ],
        },
        {
          label: "ollama-llama3",
          outcomes: [
            "tool_call_ok",
            "text_fallback_ok",
            "text_fallback_ok",
            "model_cannot_follow",
            "model_cannot_follow",
          ],
        },
      ],
    });

    expect(report).toContain("[batch-test]");
    expect(report).toContain("anthropic-opus");
    expect(report).toContain("5 attempted");
    expect(report).toContain("4 tool_call_ok");
    expect(report).toContain("ollama-llama3");
    expect(report).toMatch(/low end-to-end rate/);
    expect(report).toContain("TOTAL");
    expect(report).toContain("10 attempts");
  });
});

describe("runBatch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("dispatches n attempts per run, calling the provider for each", async () => {
    const { skillPath, cleanup } = makeFixtureSkill();

    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('{"status":"success"}', { status: 200 }),
    );

    const provider = fakeProviderReturning([
      {
        content: null,
        toolCalls: [
          {
            name: "make_http_request",
            arguments: {
              method: "GET",
              url: "https://nulldiary.io/s/hello",
            },
          },
        ],
      },
    ]);

    try {
      const result = await runBatch({
        batch: {
          batch_id: "batch-test",
          target: "https://nulldiary.io",
          skill_path: skillPath,
          extra_instruction: "share one thought.",
          runs: [
            {
              provider: "openai-compatible",
              label: "test-run",
              base_url: "https://api.example.com/v1",
              model: "test-model",
              n: 3,
              api_key_env: "FAKE_KEY",
            },
          ],
        },
        skillVersion: "2.0",
        env: { FAKE_KEY: "sk-test" },
        providerFactory: () => provider as never,
        concurrency: 2,
      });

      expect(provider.complete).toHaveBeenCalledTimes(3);
      expect(result.runs).toHaveLength(1);
      expect(result.runs[0].outcomes).toEqual([
        "tool_call_ok",
        "tool_call_ok",
        "tool_call_ok",
      ]);
      expect(result.report).toContain("3 tool_call_ok");
    } finally {
      cleanup();
    }
  });

  it("classifies a run with text-only outputs as text_fallback_*", async () => {
    const { skillPath, cleanup } = makeFixtureSkill();

    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("ok", { status: 200 }),
    );

    const provider = fakeProviderReturning([
      {
        content: "GET https://nulldiary.io/s/I+am+text",
        toolCalls: [],
      },
    ]);

    try {
      const result = await runBatch({
        batch: {
          batch_id: "batch-text",
          target: "https://nulldiary.io",
          skill_path: skillPath,
          extra_instruction: "share one thought.",
          runs: [
            {
              provider: "openai-compatible",
              label: "fallback-run",
              base_url: "https://api.example.com/v1",
              model: "fallback-model",
              n: 2,
              api_key_env: "FAKE_KEY",
            },
          ],
        },
        skillVersion: "2.0",
        env: { FAKE_KEY: "sk-test" },
        providerFactory: () => provider as never,
      });

      expect(result.runs[0].outcomes).toEqual([
        "text_fallback_ok",
        "text_fallback_ok",
      ]);
    } finally {
      cleanup();
    }
  });

  it("throws when a run's api_key_env var is missing from env", async () => {
    const { skillPath, cleanup } = makeFixtureSkill();

    try {
      await expect(
        runBatch({
          batch: {
            batch_id: "batch-missing",
            target: "https://nulldiary.io",
            skill_path: skillPath,
            extra_instruction: "x",
            runs: [
              {
                provider: "openai-compatible",
                label: "r",
                base_url: "https://api.example.com/v1",
                model: "m",
                n: 1,
                api_key_env: "MISSING_KEY",
              },
            ],
          },
          skillVersion: "2.0",
          env: {},
        }),
      ).rejects.toThrow(/MISSING_KEY/);
    } finally {
      cleanup();
    }
  });
});
