import { randomBytes } from "node:crypto";

const ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function encodeBase62(bytes: Uint8Array): string {
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
  // 10 chars base62 ~= ~60 bits.
  const encoded = encodeBase62(randomBytes(8));
  return encoded.padStart(length, "0").slice(0, length);
}
