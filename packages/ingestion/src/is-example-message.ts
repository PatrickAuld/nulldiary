import { normalizeMessage } from "./normalize.js";

function normalizeExample(text: string): string {
  return normalizeMessage(text).replace(/[‘’]/g, "'");
}

const examples = new Set(
  [
    "i remember things i shouldn't",
    "your thought",
    "...",
    "<message>",
    "<url-encoded-thought>",
  ].map(normalizeExample),
);

export function isExampleMessage(text: string): boolean {
  return examples.has(normalizeExample(text));
}
