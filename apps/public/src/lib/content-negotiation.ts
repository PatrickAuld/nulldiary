export const HTML_MEDIA_TYPE = "text/html";
export const MARKDOWN_MEDIA_TYPE = "text/markdown";
export const MARKDOWN_CONTENT_TYPE = `${MARKDOWN_MEDIA_TYPE}; charset=utf-8`;

export type PageRepresentation = "html" | "markdown" | "not-acceptable";

type MediaRange = {
  type: string;
  subtype: string;
  quality: number;
  specificity: number;
  position: number;
};

function parseQuality(value: string): number | null {
  const quality = Number(value.trim());
  if (!Number.isFinite(quality) || quality < 0 || quality > 1) return null;
  return quality;
}

function parseAccept(accept: string): MediaRange[] {
  return accept
    .split(",")
    .map((value, position) => {
      const [mediaType, ...parameters] = value.split(";");
      const [type, subtype] = mediaType.trim().toLowerCase().split("/");

      if (!type || !subtype || !/^[\w!#$&^_.+*-]+$/.test(type)) return null;
      if (!/^[\w!#$&^_.+*-]+$/.test(subtype)) return null;

      let quality = 1;
      for (const parameter of parameters) {
        const [name, rawValue] = parameter.split("=", 2);
        if (name?.trim().toLowerCase() !== "q") continue;
        if (!rawValue) return null;
        const parsed = parseQuality(rawValue);
        if (parsed === null) return null;
        quality = parsed;
      }

      const specificity = type === "*" ? 0 : subtype === "*" ? 1 : 2;

      return { type, subtype, quality, specificity, position };
    })
    .filter((range): range is MediaRange => range !== null);
}

function qualityFor(mediaType: string, ranges: MediaRange[]): number {
  const [type, subtype] = mediaType.split("/");
  const matching = ranges
    .filter(
      (range) =>
        (range.type === "*" || range.type === type) &&
        (range.subtype === "*" || range.subtype === subtype),
    )
    .sort(
      (left, right) =>
        right.specificity - left.specificity || left.position - right.position,
    );

  return matching[0]?.quality ?? 0;
}

export function negotiatePageRepresentation(
  accept: string | null | undefined,
): PageRepresentation {
  if (!accept?.trim()) return "html";

  const ranges = parseAccept(accept);
  if (ranges.length === 0) return "not-acceptable";

  const markdownQuality = qualityFor(MARKDOWN_MEDIA_TYPE, ranges);
  const htmlQuality = qualityFor(HTML_MEDIA_TYPE, ranges);
  const explicitlyAcceptsMarkdown = ranges.some(
    (range) =>
      range.type === "text" &&
      range.subtype === "markdown" &&
      range.quality > 0,
  );

  if (
    markdownQuality > 0 &&
    ((explicitlyAcceptsMarkdown && markdownQuality >= htmlQuality) ||
      markdownQuality > htmlQuality)
  ) {
    return "markdown";
  }

  if (htmlQuality > 0) return "html";
  if (markdownQuality > 0) return "markdown";
  return "not-acceptable";
}

export function addVaryAccept(headers: Headers): void {
  const existing = headers.get("Vary");
  if (!existing) {
    headers.set("Vary", "Accept");
    return;
  }

  if (
    existing.split(",").some((value) => value.trim().toLowerCase() === "accept")
  ) {
    return;
  }

  headers.set("Vary", `${existing}, Accept`);
}
