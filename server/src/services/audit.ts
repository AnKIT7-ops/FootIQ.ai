import type { SupabaseClient } from "@supabase/supabase-js";
import type { Logger } from "../lib/logger";

/**
 * Append-only audit trail for security-relevant events: logins, admin
 * actions, permission denials, quota exhaustion. Writes are fire-and-forget —
 * an audit outage must never fail the user's request — but always logged.
 */
export class AuditService {
  constructor(
    private db: SupabaseClient | null,
    private logger: Logger,
  ) {}

  log(entry: {
    actorId?: string | null;
    action: string;
    target?: string;
    detail?: Record<string, unknown>;
    ipHash?: string;
  }): void {
    this.logger.info("audit", { ...entry });
    if (!this.db) return;
    void this.db
      .from("audit_logs")
      .insert({
        actor_id: entry.actorId ?? null,
        action: entry.action,
        target: entry.target ?? null,
        detail: entry.detail ?? {},
        ip_hash: entry.ipHash ?? null,
      })
      .then(({ error }) => {
        if (error) this.logger.warn("audit.write_failed", { error: error.message });
      });
  }
}
