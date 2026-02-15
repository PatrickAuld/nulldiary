export function getSiteUrl(): string {
  // Prefer explicit configuration.
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || null;
  if (explicit) return explicit.replace(/\/$/, "");

  // Vercel provides VERCEL_URL without protocol.
  const vercel = process.env.VERCEL_URL || null;
  if (vercel) return `https://${vercel}`;

  // Sensible default.
  return "https://nulldiary.io";
}
