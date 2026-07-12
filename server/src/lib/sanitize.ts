/**
 * Input sanitization helpers. Validation (zod) rejects wrong shapes; these
 * normalize accepted strings before storage so stored data is inert.
 * SQL injection is prevented by the Supabase client (parameterized PostgREST),
 * and XSS by React's escaping — sanitization here is defense in depth, not
 * the primary control.
 */

// Built via the constructor so no literal control characters live in source.
const CONTROL_CHARS = new RegExp("[\\u0000-\\u001F\\u007F]", "g");
const CONTROL_CHARS_KEEP_NEWLINE = new RegExp("[\\u0000-\\u0008\\u000B-\\u001F\\u007F]", "g");

/** Strip control chars, collapse whitespace runs, trim, cap length. */
export function cleanText(input: string, maxLen: number): string {
  return input.replace(CONTROL_CHARS, "").replace(/\s+/g, " ").trim().slice(0, maxLen);
}

/** Multiline variant — preserves newlines/tabs, strips other control chars. */
export function cleanMultiline(input: string, maxLen: number): string {
  return input
    .replace(CONTROL_CHARS_KEEP_NEWLINE, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, maxLen);
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase().slice(0, 254);
}

/** Pragmatic RFC-lite email check — mirrors the frontend's rule. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}

/** SHA-256 of ip+salt — logs and audit rows never contain raw IPs. */
export async function hashIp(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${ip}:${salt}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
