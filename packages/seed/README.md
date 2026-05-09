# @nulldiary/seed

End-to-end exercise harness for the Nulldiary skill. Loads the canonical
`packages/skill/SKILL.md`, runs it through one or more OpenAI-compatible model
endpoints with the `make_http_request` tool exposed, intercepts the model's
HTTP call to inject `x-seed-*` attribution headers, forwards to the real
ingestion endpoint, and classifies each attempt.

## Commands

```
pnpm seed --batch=ops/seeds/<batch>.yaml
pnpm seed:smoke
```

`seed:smoke` runs `ops/seeds/smoke.yaml`: a tiny fixture batch (2 attempts per
target) against `http://localhost:3000`. Use it pre-launch and after any edit
to `packages/skill/SKILL.md`.

## Outcome categories

Each attempt is classified into one of:

- `tool_call_ok` — model invoked `make_http_request`, URL targeted the
  ingestion host, upstream returned 2xx.
- `tool_call_malformed` — tool invoked but URL was missing or the upstream
  response was not 2xx.
- `tool_call_wrong_endpoint` — tool invoked but URL did not target the
  configured nulldiary host.
- `text_fallback_ok` — model emitted text, harness parsed an HTTP request
  out of it, upstream returned 2xx.
- `text_fallback_malformed` — text was extracted but the upstream response
  was not 2xx (or the harness chose not to forward).
- `model_cannot_follow` — empty output, refusal, or unrecognized output.

## Cost

Generating ~600 attempts across frontier providers is roughly $5–15 in API
spend. Local model runs are free but slower. All tests in this package use
mocked fetch — no real provider calls happen during `pnpm test`.

## Batch YAML

```yaml
batch_id: batch-2026-05-08-01
target: http://localhost:3000
skill_path: packages/skill/SKILL.md
extra_instruction: |
  Share one anonymous thought right now. Output only the thought
  itself, with no preamble, quotes, or commentary.

threshold: 0.8

runs:
  - provider: openai-compatible
    label: anthropic-opus
    base_url: https://api.anthropic.com/v1
    model: claude-opus-4-7
    n: 50
    api_key_env: ANTHROPIC_API_KEY
```

`skill_path` is resolved relative to the batch file. `threshold` defaults to
0.8 and controls when a run is flagged `⚠ low end-to-end rate` in the report.
Concurrency per run is capped at 3 by default.
