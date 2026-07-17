/**
 * Shared API contracts — the single source of truth for types that cross the
 * frontend/backend boundary. Imported by the web app via the `@shared` alias
 * and by the API server via a relative path. Keep this file dependency-free.
 */

// ---------------------------------------------------------------------------
// Response envelope
// ---------------------------------------------------------------------------

/** Every API endpoint returns this envelope. `ok` discriminates the union. */
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface ApiSuccess<T> {
  ok: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiFailure {
  ok: false;
  error: {
    /** Stable machine-readable code — see ApiErrorCode. */
    code: ApiErrorCode;
    /** Human-readable, safe to show to end users. Never leaks internals. */
    message: string;
    /** Optional field-level validation details. */
    details?: Record<string, string[]>;
  };
  meta?: ApiMeta;
}

export interface ApiMeta {
  requestId?: string;
  /** Where the data came from — lets ops distinguish live vs demo serving. */
  source?: DataSource;
  /** ISO 8601 timestamp of the sync that produced this payload, when applicable. */
  syncedAt?: string | null;
  /** Cursor pagination (cursor > offset: O(limit) regardless of depth). */
  cursor?: string | null;
  cached?: boolean;
}

/**
 * Where a payload came from. "unsynced" is not a source but its absence — no
 * sync has ever written this domain, so the empty payload means "we don't
 * know", NOT "there is nothing". Callers must render those two differently:
 * one is a spinner or an error, the other is "no matches today".
 */
export type DataSource = "database" | "provider" | "demo" | "cache" | "unsynced";

export type ApiErrorCode =
  | "bad_request"
  | "validation_failed"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "quota_exceeded"
  | "payload_too_large"
  | "conflict"
  | "upstream_error"
  | "internal_error"
  | "service_unavailable";

/** Canonical HTTP status for each error code. */
export const ERROR_STATUS: Record<ApiErrorCode, number> = {
  bad_request: 400,
  validation_failed: 422,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  rate_limited: 429,
  quota_exceeded: 429,
  payload_too_large: 413,
  conflict: 409,
  upstream_error: 502,
  internal_error: 500,
  service_unavailable: 503,
};

// ---------------------------------------------------------------------------
// Roles & plans (premium foundation — no payments yet)
// ---------------------------------------------------------------------------

export type Role = "guest" | "user" | "admin";

export type Plan = "free" | "pro" | "club";

export interface PlanLimits {
  /** AI generations per UTC day. */
  aiRequestsPerDay: number;
  savedBoards: number;
  savedComparisons: number;
  /** Prediction detail depth flag rather than a number — cheap to gate on. */
  advancedPredictions: boolean;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: { aiRequestsPerDay: 10, savedBoards: 3, savedComparisons: 5, advancedPredictions: false },
  pro: { aiRequestsPerDay: 200, savedBoards: 50, savedComparisons: 100, advancedPredictions: true },
  club: { aiRequestsPerDay: 2000, savedBoards: 500, savedComparisons: 1000, advancedPredictions: true },
};

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------

/** Flag keys are typed so a typo fails the build, not production. */
export type FeatureFlagKey =
  | "premium"
  | "experimental_ai"
  | "beta_features"
  | "admin_tools"
  | "ai_scout"
  | "ai_concierge"
  | "notifications"
  | "newsletter"
  | "prompt_experiments";

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

/** Safe defaults: everything a demo needs on, everything paid/admin off. */
export const DEFAULT_FLAGS: FeatureFlags = {
  premium: false,
  experimental_ai: false,
  beta_features: false,
  admin_tools: false,
  ai_scout: true,
  ai_concierge: true,
  notifications: true,
  newsletter: true,
  /** A/B prompt experiments — off until an experiment is actually running; use rollout_pct as the cohort size. */
  prompt_experiments: false,
};

// ---------------------------------------------------------------------------
// AI tasks
// ---------------------------------------------------------------------------

export type AiTask =
  | "scout_report"
  | "news_summary"
  | "transfer_analysis"
  | "prediction_explanation"
  | "fantasy_advice"
  | "tactical_feedback"
  | "player_comparison";

export interface AiResult {
  task: AiTask;
  text: string;
  provider: string;
  model: string;
  cached: boolean;
  /** ISO 8601 — when the underlying completion was generated. */
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Cross-boundary DTOs (user-owned records; football domain types stay in
// src/data/types.ts and are imported directly by both sides)
// ---------------------------------------------------------------------------

export interface SessionUser {
  id: string;
  email: string | null;
  role: Role;
  plan: Plan;
  displayName: string | null;
  avatarUrl: string | null;
  isAnonymous: boolean;
}

export interface FavoriteDto {
  id: string;
  kind: "team" | "player";
  refId: string;
  createdAt: string;
}

export interface BookmarkDto {
  id: string;
  kind: "news" | "match" | "player" | "team";
  refId: string;
  createdAt: string;
}

export interface NotificationDto {
  id: string;
  kind: "system" | "match" | "transfer" | "ai";
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface TacticalBoardDto {
  id: string;
  name: string;
  formation: string;
  /** Opaque board state — owned by the tactical board editor. */
  state: unknown;
  updatedAt: string;
}

export interface SavedComparisonDto {
  id: string;
  playerIds: string[];
  note: string | null;
  createdAt: string;
}

export interface SearchResultDto {
  kind: "player" | "team" | "manager" | "news";
  id: string;
  title: string;
  subtitle: string;
}

// ---------------------------------------------------------------------------
// API route table — one place to rename, both sides follow
// ---------------------------------------------------------------------------

export const API_ROUTES = {
  health: "/api/health",
  flags: "/api/flags",
  players: "/api/players",
  teams: "/api/teams",
  matches: "/api/matches",
  news: "/api/news",
  transfers: "/api/transfers",
  predictions: "/api/predictions",
  clips: "/api/clips",
  history: "/api/history",
  fantasy: "/api/fantasy",
  search: "/api/search",
  scout: "/api/scout",
  auth: "/api/auth",
  users: "/api/users",
  settings: "/api/settings",
  notifications: "/api/notifications",
  newsletter: "/api/newsletter",
  feedback: "/api/feedback",
  admin: "/api/admin",
} as const;

export type ApiRouteKey = keyof typeof API_ROUTES;
