/**
 * @file vision-context.ts
 * @description Extracts and parses Instagram's automatic computer-vision image alt text to extract semantic keywords and contextual tokens.
 * @architecture Supplies content topic keywords and contextual parameters into the comment-generation spintax pipeline.
 * @agent_note Cleans stop words and generic camera descriptors; ensure regex handles multi-word tags and variations in Instagram's accessibility formatting.
 */

export interface PostVisionContext {
  keywords: string[];
  primaryTopic: string;
  hasVisionData: boolean;
}

export interface ContextualTokenParams {
  primaryTopic?: string;
  author?: string;
  [key: string]: any;
}

/**
 * Common English stop words filtered out during vision alt-text keyword parsing.
 */
const STOPWORDS: Set<string> = new Set(["and", "an", "a", "the", "image", "photo", "picture", "of", "in", "with"]);

/**
 * Parses and cleans Instagram's auto-generated image alt descriptions
 * into a list of specific keyword tags (e.g. ["sunset", "beach", "ocean"]).
 *
 * @param rawAlt - Raw image alt attribute string
 * @returns Array of cleaned keywords
 */
export function cleanAltKeywords(rawAlt: string = ""): string[] {
  if (!rawAlt || typeof rawAlt !== "string") return [];

  const text = rawAlt.trim();
  if (!text || text.toLowerCase().includes("no photo description available")) {
    return [];
  }

  // Instagram vision pattern: "May be an image of snow, mountain, nature, and outdoor."
  const marker = text.match(/May be an? (image|photo|drawing|video|cartoon) of (.*)/i);
  const targetText = marker && marker[2] ? marker[2] : text;

  // Remove trailing period and clean punctuation
  const clean = targetText.replace(/[.]+$/, "");

  // Split by comma or " and "
  const tokens = clean
    .split(/,|\band\b/i)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => Boolean(s) && !STOPWORDS.has(s) && s.length > 1);

  return Array.from(new Set(tokens));
}

/**
 * Extracts vision context, detected objects, and primary topic from the active post view.
 *
 * @param root - Post modal or container element
 * @returns Extracted vision keywords and topic
 */
export function extractPostVisionContext(root: HTMLElement | Document | null): PostVisionContext {
  if (!root || typeof root.querySelectorAll !== "function") {
    return { keywords: [], primaryTopic: "", hasVisionData: false };
  }

  const images = Array.from(root.querySelectorAll("img[alt]"));
  const allKeywords: string[] = [];

  for (const img of images) {
    const alt = img.getAttribute("alt") || "";
    const kw = cleanAltKeywords(alt);
    if (kw.length > 0) {
      allKeywords.push(...kw);
    }
  }

  const unique = Array.from(new Set(allKeywords));
  const primaryTopic = unique.length > 0 ? unique[0] : "";

  return {
    keywords: unique,
    primaryTopic,
    hasVisionData: unique.length > 0,
  };
}

/**
 * Resolves contextual tokens in a comment template string, including
 * `{topic}`, `{category}`, `{author}`, and `{vibe}`.
 *
 * @param template - The template string
 * @param context - Context containing author and primaryTopic
 * @returns Resolved comment string
 */
export function resolveContextualTokens(template: string, context: ContextualTokenParams = {}): string {
  if (!template || typeof template !== "string") return "";

  const topic = context.primaryTopic || "shot";
  const author = context.author ? String(context.author).trim().replace(/^@/, "") : "";

  let result = template;

  // Replace {topic}, {vibe}, {category}
  result = result.replace(/\{(topic|vibe|category)\}/gi, topic);

  // Replace {author}
  if (author) {
    result = result.replace(/\{author\}/gi, author);
  } else {
    result = result.replace(/@?\{author\}\s*/gi, "").trim();
  }

  return result;
}
