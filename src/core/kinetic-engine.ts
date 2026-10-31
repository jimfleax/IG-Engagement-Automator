/**
 * @file kinetic-engine.ts
 * @description Simulates authentic human kinetic behavior including keystroke physics, natural mouse trajectories, and randomized delay distributions.
 * @architecture Serves as the behavioral humanization tier consumed by InstagramDOMAdapter to mimic genuine user interaction and evade heuristic detection.
 * @agent_note Ensure coordinate calculations stay within bounding box safety zones and timing distributions maintain non-deterministic variance.
 */

export interface SimulateTypeOptions {
  minDelayMs?: number;
  maxDelayMs?: number;
}

/**
 * Common two-letter English digraph sequences used to model neuromuscular typing acceleration.
 */
export const COMMON_DIGRAPHS: Set<string> = new Set([
  "th", "he", "in", "er", "an", "re", "on", "at", "en", "nd",
  "ti", "es", "or", "te", "of", "ed", "is", "it", "al", "ar",
  "st", "to", "nt", "ng", "se", "ha", "as", "ou", "io", "le",
  "ve", "co", "me", "de", "hi", "ri", "ro", "ic", "ne", "ea",
]);

/**
 * Punctuation characters that trigger natural post-punctuation cognitive thinking pauses.
 */
export const PUNCTUATION_SET: Set<string> = new Set([".", "!", "?", ",", ";", ":", "\n"]);

/**
 * Computes an organic, human-like delay between keystrokes.
 *
 * @param prevChar - The preceding character typed
 * @param currentChar - The current character to type
 * @returns Delay in milliseconds
 */
export function computeKeystrokeDelay(prevChar: string = "", currentChar: string = ""): number {
  // Base gaussian-like distribution around 105ms (std dev ~22ms)
  const u1 = Math.random() || 0.001;
  const u2 = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  let delay = Math.round(105 + z * 24);

  // Clamp within human limits
  delay = Math.max(55, Math.min(230, delay));

  // Digraph acceleration: common letter sequences are typed faster
  const pair = (String(prevChar) + String(currentChar)).toLowerCase();
  if (COMMON_DIGRAPHS.has(pair)) {
    delay = Math.round(delay * 0.72);
  }

  // Punctuation thinking pause
  if (PUNCTUATION_SET.has(prevChar)) {
    const pause = Math.round(160 + Math.random() * 140);
    delay += pause;
  }

  return Math.max(45, Math.min(350, delay));
}

/**
 * Creates a PointerEvent, MouseEvent, or fallback standard Event based on environment support.
 */
function createPointerOrMouseEvent(type: string, opts: any): Event {
  if (typeof PointerEvent !== "undefined" && type.startsWith("pointer")) {
    try {
      return new PointerEvent(type, opts);
    } catch (_) {}
  }
  if (typeof MouseEvent !== "undefined") {
    try {
      return new MouseEvent(type, opts);
    } catch (_) {}
  }
  return new Event(type, opts);
}

/**
 * Dispatches a complete, authentic human pointer interaction sequence
 * with randomized coordinates within the target element's bounding box.
 *
 * @param element - The target DOM element
 */
export function dispatchHumanClick(element: HTMLElement | null): void {
  if (!element) return;

  const rect = typeof element.getBoundingClientRect === "function"
    ? element.getBoundingClientRect()
    : { left: 0, top: 0, width: 20, height: 20 };

  // Organic jitter between 25% and 75% of element dimensions (avoiding dead-center bot signature)
  const offsetX = rect.width * (0.25 + Math.random() * 0.5);
  const offsetY = rect.height * (0.25 + Math.random() * 0.5);
  const clientX = Math.round(rect.left + offsetX);
  const clientY = Math.round(rect.top + offsetY);

  const eventOpts = {
    bubbles: true,
    cancelable: true,
    view: typeof window !== "undefined" ? window : undefined,
    clientX,
    clientY,
    screenX: clientX + 50,
    screenY: clientY + 120,
    buttons: 1,
  };

  // Dispatch full pointer and mouse lifecycle
  try {
    element.dispatchEvent(createPointerOrMouseEvent("pointerover", eventOpts));
    element.dispatchEvent(createPointerOrMouseEvent("pointerenter", eventOpts));
    element.dispatchEvent(createPointerOrMouseEvent("pointerdown", eventOpts));
    element.dispatchEvent(createPointerOrMouseEvent("mousedown", eventOpts));

    if (typeof element.focus === "function") {
      element.focus();
    }

    element.dispatchEvent(createPointerOrMouseEvent("pointerup", eventOpts));
    element.dispatchEvent(createPointerOrMouseEvent("mouseup", eventOpts));
    element.dispatchEvent(createPointerOrMouseEvent("click", eventOpts));
  } catch (_) {
    try {
      element.click();
    } catch (_) {}
  }
}

/**
 * Types text character-by-character into an input or textarea element with
 * humanized variable keystroke delays and standard InputEvents.
 *
 * @param inputEl - Target input field
 * @param text - Text to type
 * @param options - Optional speed overrides
 */
export async function simulateHumanType(
  inputEl: HTMLInputElement | HTMLTextAreaElement | HTMLElement | null,
  text: string,
  options: SimulateTypeOptions = {}
): Promise<void> {
  if (!inputEl || !text) return;

  const minDelay = options.minDelayMs ?? null;
  const maxDelay = options.maxDelayMs ?? null;

  if (typeof inputEl.focus === "function") {
    inputEl.focus();
  }

  let accumulated = "";
  let prevChar = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    accumulated += char;

    // Calculate delay
    let delay = computeKeystrokeDelay(prevChar, char);
    if (minDelay !== null && maxDelay !== null) {
      delay = Math.round(minDelay + Math.random() * (maxDelay - minDelay));
    }

    // Set value natively to trigger React's internal state tracker
    const prototype =
      inputEl.tagName === "TEXTAREA"
        ? (typeof HTMLTextAreaElement !== "undefined" ? HTMLTextAreaElement.prototype : Object.getPrototypeOf(inputEl))
        : (typeof HTMLInputElement !== "undefined" ? HTMLInputElement.prototype : Object.getPrototypeOf(inputEl));

    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) {
      setter.call(inputEl, accumulated);
    } else {
      (inputEl as any).value = accumulated;
    }

    // Dispatch input events
    try {
      inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    } catch (_) {}

    prevChar = char;

    // Non-blocking sleep between characters
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  // Final change event
  try {
    inputEl.dispatchEvent(new Event("change", { bubbles: true }));
  } catch (_) {}
}
