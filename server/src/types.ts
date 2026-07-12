import type { SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "./config/env";
import type { Logger } from "./lib/logger";
import type { CacheStore } from "./cache/types";
import type { SessionUser } from "../../shared/contracts";
import type { AiService } from "./ai/service";
import type { FlagService } from "./services/flags";
import type { QuotaService } from "./services/quota";
import type { AuditService } from "./services/audit";
import type { EmailProvider } from "./platform/email/types";
import type { StorageProvider } from "./platform/storage/types";
import type { ErrorReporter } from "./platform/observability";

/**
 * Dependency container built once per process (Node) or per isolate (Workers)
 * by createApp(). Routes reach services through this — no module-level
 * singletons, which keeps tests trivial (inject mocks) and Workers happy
 * (no cross-request state assumptions).
 */
export interface Services {
  env: Env;
  logger: Logger;
  cache: CacheStore;
  db: SupabaseClient | null;
  ai: AiService;
  flags: FlagService;
  quota: QuotaService;
  audit: AuditService;
  email: EmailProvider;
  storage: StorageProvider;
  errors: ErrorReporter;
}

/** Hono generic bindings: per-request variables. */
export type AppEnv = {
  Variables: {
    services: Services;
    requestId: string;
    logger: Logger;
    user: SessionUser | null;
  };
};
