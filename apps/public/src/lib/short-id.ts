import { randomBytes } from "node:crypto";

const ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function encodeBase62(bytes: Uint8Array): string {
  // Interpret bytes as a big integer and encode to base62.
  let value = 0n;
  for (const b of bytes) value = (value << 8n) | BigInt(b);

  if (value === 0n) return "0";

  let out = "";
  const base = 62n;
  while (value > 0n) {
    const mod = value % base;
    out = ALPHABET[Number(mod)] + out;
    value = value / base;
  }

  return out;
}

export function randomShortId(length = 10): string {
  // 10 chars base62 ~= 62^10 ~= 8.4e17 (~60 bits). Good collision resistance.
  // Using random bytes then base62 keeps it URL-friendly.
  const bytes = randomBytes(8);
  const encoded = encodeBase62(bytes);

  // Left-pad to stable-ish length for nicer URLs.
  return encoded.padStart(length, "0").slice(0, length);
}
