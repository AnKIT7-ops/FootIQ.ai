import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "../lib/errors";
import type { NotificationDto } from "../../../shared/contracts";
import type { EmailProvider } from "../platform/email/types";
import type { Logger } from "../lib/logger";

/**
 * Notification infrastructure: in-app rows now, email fan-out behind the same
 * call, push (web push/FCM) as a future channel behind `channels`.
 */
export class NotificationService {
  constructor(
    private db: SupabaseClient | null,
    private email: EmailProvider,
    private logger: Logger,
  ) {}

  async list(userId: string, unreadOnly: boolean): Promise<NotificationDto[]> {
    if (!this.db) return [];
    let q = this.db
      .from("notifications")
      .select("id, kind, title, body, read_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (unreadOnly) q = q.is("read_at", null);
    const { data, error } = await q;
    if (error) throw new ApiError("upstream_error", "Couldn't load notifications.", { internal: error });
    return (data ?? []).map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      body: r.body,
      readAt: r.read_at,
      createdAt: r.created_at,
    }));
  }

  async markRead(userId: string, ids: string[]): Promise<void> {
    if (!this.db) return;
    await this.db
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .in("id", ids);
  }

  /** Server-internal: create a notification, optionally fanning out to email. */
  async notify(opts: {
    userId: string;
    kind: "system" | "match" | "transfer" | "ai";
    title: string;
    body: string;
    channels?: { email?: string };
  }): Promise<void> {
    if (this.db) {
      const { error } = await this.db.from("notifications").insert({
        user_id: opts.userId,
        kind: opts.kind,
        title: opts.title,
        body: opts.body,
      });
      if (error) this.logger.warn("notify.insert_failed", { error: error.message });
    }
    if (opts.channels?.email) {
      await this.email.send({
        to: opts.channels.email,
        template: { kind: "notification", title: opts.title, body: opts.body },
      });
    }
  }
}
