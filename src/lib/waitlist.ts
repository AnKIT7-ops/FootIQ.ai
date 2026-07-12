/**
 * Waitlist storage abstraction.
 * The UI only talks to `waitlist` (the active provider). Swapping local storage
 * for Supabase/API later means implementing WaitlistProvider once, here.
 */

export interface WaitlistProvider {
  /** Persist an email. Resolves on success, rejects with a user-safe Error on failure. */
  join(email: string): Promise<void>;
  /** Whether this email is already on the list. */
  has(email: string): Promise<boolean>;
}

export function isValidEmail(raw: string): boolean {
  const email = raw.trim();
  // pragmatic RFC-lite check: one @, non-empty local part, dotted domain
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}

const STORAGE_KEY = "footiq-waitlist";

function readLocal(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((e): e is string => typeof e === "string") : [];
  } catch {
    return [];
  }
}

/** Beta provider: keeps signups in localStorage until a real backend lands. */
const localWaitlistProvider: WaitlistProvider = {
  async join(email: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    if (!isValidEmail(normalized)) throw new Error("That doesn't look like a valid email address.");
    const list = readLocal();
    if (!list.includes(normalized)) {
      list.push(normalized);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      } catch {
        throw new Error("Couldn't save your email on this device — storage is unavailable.");
      }
    }
    // simulate network latency so the UI's loading state is honest about the future backend
    await new Promise((r) => setTimeout(r, 450));
  },

  async has(email: string): Promise<boolean> {
    return readLocal().includes(email.trim().toLowerCase());
  },
};

/**
 * Backend provider: posts to the FootIQ API (which stores in Supabase and
 * rate-limits abuse). Falls back to localStorage when the backend is
 * unreachable so a signup is never dropped on the floor.
 */
const apiWaitlistProvider: WaitlistProvider = {
  async join(email: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    if (!isValidEmail(normalized)) throw new Error("That doesn't look like a valid email address.");
    const { api, ApiUnavailableError, ApiRequestError } = await import("@/lib/api/client");
    try {
      await api.post("/api/newsletter/subscribe", { email: normalized, source: "waitlist" });
    } catch (err) {
      if (err instanceof ApiUnavailableError) {
        return localWaitlistProvider.join(normalized); // offline-tolerant
      }
      if (err instanceof ApiRequestError) throw new Error(err.message);
      throw new Error("Couldn't sign you up right now — please try again.");
    }
  },
  async has(email: string): Promise<boolean> {
    // membership isn't exposed publicly (email enumeration); local echo only
    return localWaitlistProvider.has(email);
  },
};

import { backendConfigured } from "@/lib/config";

export const waitlist: WaitlistProvider = backendConfigured
  ? apiWaitlistProvider
  : localWaitlistProvider;
