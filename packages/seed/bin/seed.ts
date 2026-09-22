#!/usr/bin/env tsx
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { loadBatchConfig } from "../src/batch-config.js";
import { runBatch } from "../src/run-batch.js";

interface Cli {
  batch: string;
  logsDir: string;
  skillVersion: string;
}

function parseArgs(argv: string[]): Cli {
  let batch = "";
  let logsDir = "ops/seeds/logs";
  let skillVersion: string | null = null;

  for (const arg of argv.slice(2)) {
    if (arg.startsWith("--batch=")) batch = arg.slice("--batch=".length);
    else if (arg.startsWith("--logs-dir="))
      logsDir = arg.slice("--logs-dir=".length);
    else if (arg.startsWith("--skill-version="))
      skillVersion = arg.slice("--skill-version=".length);
  }

  if (!batch) {
    console.error(
      "Usage: pnpm seed --batch=<path> [--logs-dir=ops/seeds/logs] [--skill-version=2.0]",
    );
    process.exit(2);
  }

  return {
    batch,
    logsDir,
    skillVersion: skillVersion ?? detectSkillVersion(batch),
  };
}

function detectSkillVersion(batchPath: string): string {
  // Best-effort: read the skill file referenced in the batch and parse the
  // metadata.version line out of frontmatter. Fall back to "unknown" so the
  // CLI never blocks on detection.
  try {
    const cfg = loadBatchConfig(batchPath);
    const skillPath = resolve(dirname(batchPath), cfg.skill_path);
    const content = readFileSync(skillPath, "utf8");
    const m = /version:\s*"?([^"\n]+)"?/.exec(content);
    return m?.[1]?.trim() ?? "unknown";
  } catch {
    return "unknown";
  }
}

async function main() {
  const cli = parseArgs(process.argv);
  const config = loadBatchConfig(cli.batch);

  console.error(
    `[seed] running batch ${config.batch_id} target=${config.target} skill=v${cli.skillVersion}`,
  );

  const result = await runBatch({
    batch: config,
    skillVersion: cli.skillVersion,
  });

  console.log(result.report);

  mkdirSync(cli.logsDir, { recursive: true });
  const logPath = join(cli.logsDir, `${config.batch_id}.md`);
  writeFileSync(logPath, "```\n" + result.report + "\n```\n", "utf8");
  console.error(`[seed] wrote report to ${logPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
