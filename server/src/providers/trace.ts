import type { CacheStore } from "../cache/types";
import type { Logger } from "../lib/logger";

/**
 * Provider request traces — the raw payload, kept for diagnosis.
 *
 * WHY THIS IS PER-FETCH AND NOT PER-ENTITY
 *
 * The obvious shape is a `raw` field on each NormalizedTeam. It's the wrong
 * one twice over:
 *
 *   1. Schema drift never reaches an entity. Validation runs on the whole
 *      response BEFORE normalization, so a drifted payload throws and produces
 *      zero entities — the raw data for the one request you actually want to
 *      inspect is exactly the one that never gets written. Raw belongs to the
 *      FETCH, which exists whether or not parsing succeeded.
 *   2. It costs 20x for less. Per-entity raw across 132 clubs is ~0.49 MB, of
 *      which 78% is `squad` arrays we never read, and it rides on the
 *      team_identity snapshot that every standings sync loads. A per-fetch
 *      trace is ~77 KB per response, sits off the hot path entirely, and keeps
 *      MORE (the envelope and filters, not just the rows we kept).
 *
 * WHAT IT CAPTURES
 *
 *   failures (default) — every failed fetch or parse. This is the drift case,
 *     it is rare, and it is the evidence you want. Steady-state cost: zero.
 *   all — every fetch, success included, for diffing "what it looks like when
 *     it works" against a future break. Debugging only: on Cloudflare's free
 *     KV tier this is ~900 writes/day against a 1,000/day cap, so it is not a
 *     production default.
 *   off — no traces.
 *
 * Traces are read by /api/admin/traces, never by the sync path.
 */

export type TraceMode = "off" | "failures" | "all";

export interface ProviderTrace {
  provider: string;
  /** Path as requested, e.g. "/competitions/PL/teams". */
  endpoint: string;
  fetchedAt: string;
  ok: boolean;
  httpStatus?: number;
  bytes?: number;
  /** Parse/network error, when the fetch or validation failed. */
  error?: string;
  /** The response body verbatim, truncated past RAW_CAP_BYTES. */
  raw?: unknown;
  /** True when `raw` was cut — a truncated payload can still show the shape. */
  rawTruncated?: boolean;
}

/** One PL /teams response is ~77 KB; this keeps a pathological payload from filling the store. */
const RAW_CAP_BYTES = 256 * 1024;
const TRACE_TTL_SECONDS = 7 * 24 * 60 * 60;

const key = (provider: string, endpoint: string, ok: boolean) =>
  `trace:v1:${ok ? "ok" : "fail"}:${provider}:${endpoint}`;
const INDEX_KEY = "trace:v1:index";

export class ProviderTraceStore {
  constructor(
    private cache: CacheStore,
    private mode: TraceMode,
    private logger: Logger,
  ) {}

  enabled(forOk: boolean): boolean {
    if (this.mode === "off") return false;
    return this.mode === "all" || !forOk;
  }

  /**
   * Success and failure are stored under SEPARATE keys, so a failure never
   * evicts the last known-good payload. Diffing the two is the whole point:
   * one shows what the schema was, the other what it became.
   */
  async record(trace: ProviderTrace): Promise<void> {
    if (!this.enabled(trace.ok)) return;
    try {
      const stored = { ...trace, ...this.capRaw(trace.raw) };
      await this.cache.set(key(trace.provider, trace.endpoint, trace.ok), stored, TRACE_TTL_SECONDS);
      const index = (await this.cache.get<string[]>(INDEX_KEY)) ?? [];
      const id = `${trace.ok ? "ok" : "fail"}:${trace.provider}:${trace.endpoint}`;
      if (!index.includes(id)) {
        await this.cache.set(INDEX_KEY, [...index, id], TRACE_TTL_SECONDS);
      }
    } catch (err) {
      // Diagnostics must never break the sync they are diagnosing.
      this.logger.warn("trace.write_failed", { error: err instanceof Error ? err.message : "unknown" });
    }
  }

  private capRaw(raw: unknown): { raw?: unknown; rawTruncated?: boolean } {
    if (raw === undefined) return {};
    let text: string;
    try {
      text = JSON.stringify(raw);
    } catch {
      return { raw: "[unserializable]", rawTruncated: true };
    }
    if (text.length <= RAW_CAP_BYTES) return { raw };
    return { raw: `${text.slice(0, RAW_CAP_BYTES)}…[truncated ${text.length - RAW_CAP_BYTES}B]`, rawTruncated: true };
  }

  async list(): Promise<ProviderTrace[]> {
    const index = (await this.cache.get<string[]>(INDEX_KEY)) ?? [];
    const rows = await Promise.all(index.map((id) => this.cache.get<ProviderTrace>(`trace:v1:${id}`)));
    return rows
      .filter((r): r is ProviderTrace => r !== null)
      .sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt));
  }
}

/** No-op store — what a provider gets when tracing is off or unconfigured. */
export const noopTraceStore = {
  enabled: () => false,
  record: async () => {},
  list: async () => [],
} as unknown as ProviderTraceStore;
