export function truncateForDescription(input: string, max = 200): string {
  const s = input.replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function stripNewlines(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}
