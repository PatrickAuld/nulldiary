const FONT_URL =
  "https://fonts.gstatic.com/s/ibmplexmono/v19/-F63fjptAgt5VM-kVkqdyU8n3kwq0n1hj-sNFQ.woff2";

let cached: ArrayBuffer | null = null;

export async function loadPlexMono(): Promise<ArrayBuffer | null> {
  if (cached) return cached;
  try {
    const res = await fetch(FONT_URL);
    if (!res.ok) return null;
    cached = await res.arrayBuffer();
    return cached;
  } catch {
    return null;
  }
}
