import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "../lib/errors";
import { cleanMultiline, cleanText, normalizeEmail } from "../lib/sanitize";
import type { Logger } from "../lib/logger";

/**
 * Newsletter, feedback, and feature requests — the public write surface.
 * Everything here is rate-limited at the route and sanitized before storage.
 * Without a DB, writes are accepted and logged (so beta signups on a
 * DB-less deploy aren't lost silently — they're recoverable from logs).
 */
export class CommunityService {
  constructor(
    private db: SupabaseClient | null,
    private logger: Logger,
  ) {}

  async subscribe(emailRaw: string, source: "waitlist" | "footer" | "settings"): Promise<void> {
    const email = normalizeEmail(emailRaw);
    if (!this.db) {
      this.logger.info("newsletter.subscribe.demo", { email });
      return;
    }
    const { error } = await this.db
      .from("newsletter_subscribers")
      .upsert({ email, source }, { onConflict: "email", ignoreDuplicates: true });
    if (error) throw new ApiError("upstream_error", "Couldn't subscribe right now.", { internal: error });
  }

  async unsubscribe(emailRaw: string): Promise<void> {
    if (!this.db) return;
    await this.db
      .from("newsletter_subscribers")
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq("email", normalizeEmail(emailRaw));
  }

  async submitFeedback(input: {
    userId: string | null;
    email: string | null;
    category: "general" | "bug" | "data" | "ai";
    message: string;
    page: string | null;
  }): Promise<void> {
    const message = cleanMultiline(input.message, 4000);
    if (message.length < 3) throw new ApiError("bad_request", "Feedback message is too short.");
    if (!this.db) {
      this.logger.info("feedback.demo", { category: input.category, message: message.slice(0, 200) });
      return;
    }
    const { error } = await this.db.from("feedback").insert({
      user_id: input.userId,
      email: input.email ? normalizeEmail(input.email) : null,
      category: input.category,
      message,
      page: input.page ? cleanText(input.page, 200) : null,
    });
    if (error) throw new ApiError("upstream_error", "Couldn't submit feedback.", { internal: error });
  }

  async submitFeatureRequest(input: {
    userId: string | null;
    title: string;
    description: string | null;
  }): Promise<void> {
    const title = cleanText(input.title, 120);
    if (title.length < 3) throw new ApiError("bad_request", "Title is too short.");
    if (!this.db) {
      this.logger.info("feature_request.demo", { title });
      return;
    }
    const { error } = await this.db.from("feature_requests").insert({
      user_id: input.userId,
      title,
      description: input.description ? cleanMultiline(input.description, 4000) : null,
    });
    if (error) throw new ApiError("upstream_error", "Couldn't submit request.", { internal: error });
  }
}
