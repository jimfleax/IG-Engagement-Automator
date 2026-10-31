/**
 * @file comment-deck.ts
 * @description Manages comment generation using Fisher-Yates shuffle bags and recursive spintax pattern parsing.
 * @architecture Connects to StorageService for queue persistence and supplies formatted comment text to WorkflowEngine.
 * @agent_note Ensure spintax recursion limit prevents stack overflow and boundary repeat logic is preserved during reshuffles.
 */
import { StorageService } from "./storage.ts";

export interface SpintaxContext {
  author?: string;
  primaryTopic?: string;
  topic?: string;
  category?: string;
  vibe?: string;
  [key: string]: any;
}

/**
 * Curated emoji list used for spintax {emoji} token expansion.
 */
export const CURATED_EMOJIS: string[] = ["🔥", "🙌", "✨", "💯", "👏", "⚡", "🚀", "👌", "🎯", "❤️"];

/**
 * Resolves spintax patterns ({optionA|optionB}), author tokens, and random emojis.
 * Supports arbitrary nesting: {Super {clean|nice}|Awesome} {shot|photo} {🔥|🙌}!
 *
 * @param text - The template string with spintax/tokens.
 * @param context - Context metadata (e.g. { author: "username" }).
 * @returns Evaluated text string.
 */
export function parseSpintax(text: string, context: SpintaxContext = {}): string {
  if (typeof text !== "string") return "";

  let result = text;

  // 1. Resolve {author} token
  if (result.includes("{author}")) {
    const rawAuthor = context.author ? String(context.author).trim() : "";
    if (rawAuthor) {
      result = result.replace(/\{author\}/g, rawAuthor);
    } else {
      // Remove orphaned @{author} or {author} cleanly without double spaces
      result = result.replace(/\s*@\{author\}\s*/g, " ").replace(/\{author\}/g, "");
    }
  }

  // 2. Resolve {emoji} token
  if (result.includes("{emoji}")) {
    result = result.replace(/\{emoji\}/g, () => {
      return CURATED_EMOJIS[Math.floor(Math.random() * CURATED_EMOJIS.length)];
    });
  }

  // 3. Resolve Vision Context tokens: {topic}, {category}, {vibe}
  if (result.match(/\{(topic|category|vibe)\}/i)) {
    const topic = context.primaryTopic || context.topic || "shot";
    result = result.replace(/\{(topic|category|vibe)\}/gi, topic);
  }

  // 4. Resolve Spintax groups from innermost out: {opt1|opt2|opt3}
  const spintaxRegex = /\{([^{}]+)\}/;
  let iterations = 20; // safety ceiling against malformed infinite brackets
  while (spintaxRegex.test(result) && iterations-- > 0) {
    result = result.replace(spintaxRegex, (_, options) => {
      const choices = options.split("|");
      return choices[Math.floor(Math.random() * choices.length)];
    });
  }

  // Normalize duplicate spaces, spaces before punctuation, and trim
  return result
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([!?,.:;])/g, "$1")
    .trim();
}

/**
 * Manages comment selection with shuffle-bag distribution and repeat prevention.
 */
export class CommentDeck {
  getPoolFn: () => string[];
  queue: string[];
  lastDrawn: string | null;
  poolHash: string;
  isInitialized: boolean;

  /**
   * Creates a new CommentDeck instance.
   * @param getPoolFn - Function returning the active pool of comment templates.
   */
  constructor(getPoolFn?: () => string[]) {
    this.getPoolFn = typeof getPoolFn === "function" ? getPoolFn : () => ["🔥🔥"];
    this.queue = [];
    this.lastDrawn = null;
    this.poolHash = "";
    this.isInitialized = false;
  }

  /**
   * Initializes deck state by restoring saved queue and pool metadata from storage.
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;
    try {
      const saved = await StorageService.loadDeck();
      this.queue = Array.isArray(saved?.queue) ? saved.queue : [];
      this.lastDrawn = saved?.lastDrawn || null;
      this.poolHash = saved?.poolHash || "";
    } catch (_) {}
    this.isInitialized = true;
  }

  /**
   * Persists current deck queue and shuffle state into StorageService.
   */
  async save(): Promise<void> {
    try {
      await StorageService.saveDeck({
        queue: this.queue,
        lastDrawn: this.lastDrawn,
        poolHash: this.poolHash,
      });
    } catch (_) {}
  }

  /**
   * Shuffles an array in place using the Fisher-Yates algorithm.
   * @param array - The array of items to shuffle.
   * @returns A new shuffled array.
   */
  shuffle(array: string[]): string[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Retrieves the next parsed spintax comment while preventing boundary duplicates.
   * @param context - Context metadata for token substitution.
   * @returns Fully evaluated comment string ready for insertion.
   */
  next(context: SpintaxContext = {}): string {
    const pool = this.getPoolFn();
    if (!pool || pool.length === 0) return "🔥🔥";
    if (pool.length === 1) return parseSpintax(pool[0], context);

    const currentHash = pool.join("||");

    if (this.poolHash !== currentHash || this.queue.length === 0) {
      this.poolHash = currentHash;
      this.queue = this.shuffle(pool);

      // Avoid boundary repeat across reshuffles
      if (this.queue.length > 1 && this.queue[0] === this.lastDrawn) {
        const swapIdx = 1 + Math.floor(Math.random() * (this.queue.length - 1));
        [this.queue[0], this.queue[swapIdx]] = [this.queue[swapIdx], this.queue[0]];
      }
    }

    const chosen = this.queue.shift()!;
    this.lastDrawn = chosen;
    this.save();
    return parseSpintax(chosen, context);
  }
}
