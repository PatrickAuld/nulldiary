import { parse as parseYaml } from "yaml";
import { readFileSync } from "node:fs";

export interface BatchRun {
  provider: "openai-compatible";
  label: string;
  base_url: string;
  model: string;
  n: number;
  api_key_env?: string;
}

export interface BatchConfig {
  batch_id: string;
  target: string;
  skill_path: string;
  extra_instruction: string;
  threshold?: number;
  runs: BatchRun[];
}

/**
 * Load and validate a batch YAML file. Errors out loudly on missing or
 * malformed required fields — running a batch with junk config is more
 * expensive than failing fast.
 */
export function loadBatchConfig(path: string): BatchConfig {
  const raw = readFileSync(path, "utf8");
  const parsed = parseYaml(raw) as Partial<BatchConfig>;

  const required: Array<keyof BatchConfig> = [
    "batch_id",
    "target",
    "skill_path",
    "extra_instruction",
    "runs",
  ];
  for (const field of required) {
    if (!(field in parsed) || parsed[field] === undefined) {
      throw new Error(`Batch config ${path} missing required field: ${field}`);
    }
  }

  if (!Array.isArray(parsed.runs) || parsed.runs.length === 0) {
    throw new Error(`Batch config ${path} must define at least one run`);
  }

  for (const run of parsed.runs) {
    for (const field of [
      "provider",
      "label",
      "base_url",
      "model",
      "n",
    ] as const) {
      if (run[field] === undefined) {
        throw new Error(
          `Batch config ${path} run is missing required field: ${field}`,
        );
      }
    }
  }

  return parsed as BatchConfig;
}
