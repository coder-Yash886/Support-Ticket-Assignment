/**
 * Validates and safely returns a URL string if it uses http or https protocols.
 * Blocks dangerous schemes like javascript:, data:, vbscript:, etc.
 */
export function safeUrl(u?: string | null): string | null {
  if (!u) return null;
  try {
    const x = new URL(u);
    return ["http:", "https:"].includes(x.protocol) ? x.href : null;
  } catch {
    return null;
  }
}
