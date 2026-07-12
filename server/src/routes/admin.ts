import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { ok } from "../lib/respond";
import { validate } from "../middleware/validate";
import { requireRole } from "../middleware/auth";
import { rateLimit, rateLimits } from "../middleware/rate-limit";
import { ApiError } from "../lib/errors";
import { cacheKeys } from "../cache/types";

/**
 * Admin backend — no frontend yet, consumed via authenticated API calls.
 * Every route: admin role + audit log. Additionally gated behind the
 * admin_tools flag so a leaked admin token still can't use these when the
 * flag is off (defense in depth).
 */
export function adminRoutes() {
  const r = new Hono<AppEnv>();
  r.use("*", requireRole("admin"));
  r.use("*", rateLimit(rateLimits.write));
  r.use("*", async (c, next) => {
    const { flags } = c.get("services");
    if (!(await flags.isEnabled("admin_tools"))) {
      throw ApiError.unavailable("Admin tools are disabled (admin_tools flag).");
    }
    await next();
  });

  const needDb = (c: { get: (k: "services") => AppEnv["Variables"]["services"] }) => {
    const { db } = c.get("services");
    if (!db) throw ApiError.unavailable("Admin endpoints need the database configured.");
    return db;
  };

  // --- overview stats
  r.get("/stats", async (c) => {
    const db = needDb(c);
    const count = async (table: string) => {
      const { count: n } = await db.from(table).select("*", { count: "exact", head: true });
      return n ?? 0;
    };
    return ok(c, {
      users: await count("profiles"),
      newsletterSubscribers: await count("newsletter_subscribers"),
      feedback: await count("feedback"),
      featureRequests: await count("feature_requests"),
      boards: await count("tactical_boards"),
    });
  });

  // --- user management
  r.get(
    "/users",
    validate("query", z.object({ cursor: z.string().datetime().optional() })),
    async (c) => {
      const db = needDb(c);
      const { cursor } = c.req.valid("query");
      let q = db
        .from("profiles")
        .select("id, display_name, role, plan, is_anonymous, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (cursor) q = q.lt("created_at", cursor);
      const { data, error } = await q;
      if (error) throw new ApiError("upstream_error", "Query failed.", { internal: error });
      const last = data?.at(-1);
      return ok(c, data ?? [], { cursor: last ? last.created_at : null });
    },
  );

  r.patch(
    "/users/:id",
    validate("param", z.object({ id: z.string().uuid() })),
    validate("json", z.object({ role: z.enum(["user", "admin"]).optional(), plan: z.enum(["free", "pro", "club"]).optional() })),
    async (c) => {
      const db = needDb(c);
      const { id } = c.req.valid("param");
      const patch = c.req.valid("json");
      const { error } = await db.from("profiles").update(patch).eq("id", id);
      if (error) throw new ApiError("upstream_error", "Update failed.", { internal: error });
      c.get("services").audit.log({
        actorId: c.get("user")!.id,
        action: "admin.user.update",
        target: `profiles/${id}`,
        detail: patch,
      });
      return ok(c, { updated: true });
    },
  );

  // --- feedback moderation
  r.get(
    "/feedback",
    validate("query", z.object({ status: z.enum(["new", "triaged", "resolved", "spam"]).optional() })),
    async (c) => {
      const db = needDb(c);
      let q = db
        .from("feedback")
        .select("id, user_id, email, category, message, page, status, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      const { status } = c.req.valid("query");
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw new ApiError("upstream_error", "Query failed.", { internal: error });
      return ok(c, data ?? []);
    },
  );

  r.patch(
    "/feedback/:id",
    validate("param", z.object({ id: z.string().uuid() })),
    validate("json", z.object({ status: z.enum(["new", "triaged", "resolved", "spam"]) })),
    async (c) => {
      const db = needDb(c);
      const { id } = c.req.valid("param");
      const { status } = c.req.valid("json");
      await db.from("feedback").update({ status }).eq("id", id);
      c.get("services").audit.log({
        actorId: c.get("user")!.id,
        action: "admin.feedback.status",
        target: `feedback/${id}`,
        detail: { status },
      });
      return ok(c, { updated: true });
    },
  );

  // --- newsletter management
  r.get("/newsletter", async (c) => {
    const db = needDb(c);
    const { data, error } = await db
      .from("newsletter_subscribers")
      .select("id, email, source, confirmed_at, unsubscribed_at, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new ApiError("upstream_error", "Query failed.", { internal: error });
    return ok(c, data ?? []);
  });

  // --- data platform operations (cache/registry-backed — work in demo mode too)
  r.get("/jobs", async (c) => {
    const { jobs } = c.get("services");
    return ok(c, { registered: jobs.names(), lastRuns: await jobs.lastRuns() });
  });

  r.post(
    "/jobs/:name/run",
    validate("param", z.object({ name: z.string().min(1).max(60).regex(/^[a-z_]+$/) })),
    async (c) => {
      const { jobs, audit } = c.get("services");
      const { name } = c.req.valid("param");
      if (!jobs.names().includes(name)) throw ApiError.notFound("Job");
      const run = await jobs.runJob(name);
      audit.log({ actorId: c.get("user")!.id, action: "admin.job.run", target: `job/${name}`, detail: { status: run.status } });
      return ok(c, run);
    },
  );

  r.post(
    "/cache/purge",
    validate("json", z.object({ target: z.enum(["teams", "matches", "flags"]) })),
    async (c) => {
      const { snapshots, cache, audit } = c.get("services");
      const { target } = c.req.valid("json");
      if (target === "flags") await cache.delete(cacheKeys.flags());
      else await snapshots.invalidate(target);
      audit.log({ actorId: c.get("user")!.id, action: "admin.cache.purge", target: `cache/${target}`, detail: {} });
      return ok(c, { purged: target });
    },
  );

  r.get("/providers", (c) => {
    const { dataProvider, ai, env } = c.get("services");
    return ok(c, {
      data: {
        active: dataProvider.name,
        available: dataProvider.available(),
        selected: env.DATA_PROVIDER,
        configured: {
          "football-data": Boolean(env.FOOTBALL_DATA_API_KEY),
          "api-football": Boolean(env.API_FOOTBALL_KEY),
        },
      },
      ai: { active: ai.providerName, selected: env.AI_PROVIDER },
      switching: "set DATA_PROVIDER / AI_PROVIDER env and redeploy — config, not code",
    });
  });

  r.get("/prompts", async (c) => {
    const { promptCatalog } = await import("../ai/prompts");
    return ok(c, promptCatalog);
  });

  // --- feature flags
  r.get("/flags", async (c) => {
    const db = needDb(c);
    const { data } = await db.from("feature_flags").select("key, enabled, rollout_pct, description, updated_at");
    return ok(c, data ?? []);
  });

  r.patch(
    "/flags/:key",
    validate("param", z.object({ key: z.string().min(1).max(60).regex(/^[a-z_]+$/) })),
    validate(
      "json",
      z.object({ enabled: z.boolean().optional(), rolloutPct: z.number().int().min(0).max(100).nullable().optional() }),
    ),
    async (c) => {
      const db = needDb(c);
      const { key } = c.req.valid("param");
      const body = c.req.valid("json");
      const { error } = await db
        .from("feature_flags")
        .update({
          ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
          ...(body.rolloutPct !== undefined ? { rollout_pct: body.rolloutPct } : {}),
        })
        .eq("key", key);
      if (error) throw new ApiError("upstream_error", "Flag update failed.", { internal: error });
      await c.get("services").cache.delete(cacheKeys.flags()); // land within this request, not TTL
      c.get("services").audit.log({
        actorId: c.get("user")!.id,
        action: "admin.flag.update",
        target: `feature_flags/${key}`,
        detail: body,
      });
      return ok(c, { updated: true });
    },
  );

  return r;
}
