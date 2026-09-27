import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { bodyLimit } from "hono/body-limit";
import type { Env } from "./config/env";
import type { AppEnv, Services } from "./types";
import { createLogger } from "./lib/logger";
import { cacheBackendName, createCache } from "./cache";
import type { NewsHeadline } from "../../shared/contracts";
import type { KVNamespaceLike } from "./cache/kv";
import { createServiceClient } from "./db/supabase";
import { AiService, createAiProvider } from "./ai/service";
import { createDataProvider } from "./providers";
import { ProviderTraceStore } from "./providers/trace";
import { SnapshotStore } from "./services/snapshots";
import { JobRegistry } from "./jobs/registry";
import { registerJobs } from "./jobs";
import { FlagService } from "./services/flags";
import { QuotaService } from "./services/quota";
import { AuditService } from "./services/audit";
import { CatalogService } from "./services/catalog";
import { UserDataService } from "./services/user-data";
import { NotificationService } from "./services/notifications";
import { CommunityService } from "./services/community";
import { ConsoleEmailProvider } from "./platform/email/console";
import { NoopStorageProvider, SupabaseStorageProvider } from "./platform/storage";
import { createErrorReporter } from "./platform/observability";
import { ApiError } from "./lib/errors";
import { fail } from "./lib/respond";
import { optionalAuth } from "./middleware/auth";
import { rateLimit, rateLimits } from "./middleware/rate-limit";
import { metaRoutes } from "./routes/meta";
import { catalogRoutes } from "./routes/catalog";
import { recommendRoutes } from "./routes/recommend";
import { exportRoutes } from "./routes/export";
import { RecommendService } from "./services/recommend";
import { aiRoutes } from "./routes/ai";
import { authRoutes } from "./routes/auth";
import { settingsRoutes, userRoutes } from "./routes/users";
import { notificationRoutes } from "./routes/notifications";
import { communityRoutes } from "./routes/community";
import { adminRoutes } from "./routes/admin";

/**
 * App factory — builds the dependency container once, wires middleware in
 * the order that matters, mounts routes. Same factory serves Node, Workers,
 * and tests (tests pass a doctored env + mock services overrides).
 */
export function createApp(env: Env, opts?: { kv?: KVNamespaceLike; services?: Partial<Services>; fetchNews?: () => Promise<NewsHeadline[]> }) {
  return createServer(env, opts).app;
}

/** Full factory — app + the service container (worker cron and the Node sync loop need the job registry). */
export function createServer(env: Env, opts?: { kv?: KVNamespaceLike; services?: Partial<Services>; fetchNews?: () => Promise<NewsHeadline[]> }) {
  const logger = createLogger(env.LOG_LEVEL);
  const cache = opts?.services?.cache ?? createCache(env, opts?.kv);
  const db = opts?.services?.db !== undefined ? opts.services.db : createServiceClient(env);
  const email = opts?.services?.email ?? new ConsoleEmailProvider(logger);
  const traces = new ProviderTraceStore(cache, env.PROVIDER_TRACE, logger);
  const dataProvider = opts?.services?.dataProvider ?? createDataProvider(env, logger, traces);
  const snapshots = opts?.services?.snapshots ?? new SnapshotStore(cache, db, logger);
  const ai = opts?.services?.ai ?? new AiService(createAiProvider(env, logger), cache, logger, db, env.AI_GLOBAL_DAILY_LIMIT);
  const jobs = opts?.services?.jobs ?? new JobRegistry(cache, db, logger);
  if (!opts?.services?.jobs) registerJobs(jobs, { provider: dataProvider, snapshots, fetchNews: opts?.fetchNews });

  const services: Services = {
    env,
    logger,
    cache,
    db,
    email,
    ai,
    flags: opts?.services?.flags ?? new FlagService(env, cache, db),
    quota: opts?.services?.quota ?? new QuotaService(db, cache),
    audit: opts?.services?.audit ?? new AuditService(db, logger),
    storage:
      opts?.services?.storage ?? (db ? new SupabaseStorageProvider(db) : new NoopStorageProvider()),
    errors: opts?.services?.errors ?? createErrorReporter(env, logger),
    dataProvider,
    traces,
    snapshots,
    jobs,
  };

  const catalog = new CatalogService(cache, snapshots);
  const users = new UserDataService(db);
  const notifications = new NotificationService(db, email, logger);
  const community = new CommunityService(db, logger);

  const app = new Hono<AppEnv>();

  // ---- global middleware (order matters) ----------------------------------

  // 1. container + request id + per-request logger
  app.use("*", async (c, next) => {
    const requestId = crypto.randomUUID();
    c.set("services", services);
    c.set("requestId", requestId);
    c.set("logger", logger.child({ requestId }));
    c.set("user", null);
    c.header("X-Request-Id", requestId);
    await next();
  });

  // 2. security headers (API flavor: no sniff, no frame, cross-origin isolated)
  app.use(
    "*",
    secureHeaders({
      contentSecurityPolicy: { defaultSrc: ["'none'"] }, // pure JSON API — nothing should render
      crossOriginResourcePolicy: "cross-origin", // frontend on another origin fetches us
    }),
  );

  // 3. CORS — explicit allowlist from env; no wildcard with credentials
  const allowedOrigins = env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);
  app.use(
    "*",
    cors({
      origin: (origin) => (origin && allowedOrigins.includes(origin) ? origin : null),
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      exposeHeaders: ["X-Request-Id", "X-RateLimit-Limit", "X-RateLimit-Remaining", "Retry-After"],
      maxAge: 86400,
    }),
  );

  // 4. body size cap — cheap DoS guard ahead of JSON parsing
  app.use("*", bodyLimit({ maxSize: 256 * 1024, onError: (c) => fail(c, new ApiError("payload_too_large", "Request body too large.")) }));

  // 5. access log
  app.use("*", async (c, next) => {
    const start = Date.now();
    await next();
    c.get("logger").info("request", {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      ms: Date.now() - start,
      userId: c.get("user")?.id,
    });
  });

  // 6. identity (never rejects) + baseline rate limit
  app.use("*", optionalAuth());
  app.use("/api/*", rateLimit(rateLimits.api));

  // ---- routes --------------------------------------------------------------
  // Mounted at /api AND /api/v1: v1 is the stable versioned surface for
  // external clients; the unversioned mount stays as its alias so nothing
  // breaks. A future /api/v2 mounts breaking changes without touching v1.

  const startedAt = Date.now();
  const recommend = new RecommendService();
  for (const base of ["/api", "/api/v1"]) {
    app.route(base, metaRoutes(startedAt, cacheBackendName(env, opts?.kv), community));
    app.route(base, catalogRoutes(catalog));
    app.route(`${base}/recommendations`, recommendRoutes(recommend));
    app.route(`${base}/export`, exportRoutes(catalog));
    app.route(`${base}/ai`, aiRoutes(catalog));
    app.route(`${base}/auth`, authRoutes());
    app.route(`${base}/users`, userRoutes(users));
    app.route(`${base}/settings`, settingsRoutes(users));
    app.route(`${base}/notifications`, notificationRoutes(notifications));
    app.route(base, communityRoutes(community));
    app.route(`${base}/admin`, adminRoutes());
  }

  app.notFound((c) => fail(c, ApiError.notFound("Endpoint"), c.get("requestId")));

  // ---- global error handler -------------------------------------------------

  app.onError((err, c) => {
    const requestId = c.get("requestId");
    if (err instanceof ApiError) {
      // expected failure: log at warn with internals, respond with safe envelope
      c.get("logger").warn("request.failed", {
        code: err.code,
        message: err.message,
        internal: err.internal instanceof Error ? err.internal.message : err.internal,
      });
      return fail(c, err, requestId);
    }
    // unexpected: report with stack, respond opaque — never leak internals
    services.errors.capture(err, { requestId, path: c.req.path });
    return fail(c, new ApiError("internal_error", "Something went wrong on our side."), requestId);
  });

  return { app, services };
}
