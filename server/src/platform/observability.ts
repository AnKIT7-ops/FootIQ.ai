import type { Logger } from "../lib/logger";
import type { Env } from "../config/env";

/**
 * Observability hooks — vendor-neutral seams. Structured logging is live;
 * error reporting and metrics are interfaces with console implementations,
 * so wiring Sentry/Axiom/PostHog later is one adapter each, zero call-site
 * churn.
 */

export interface ErrorReporter {
  capture(error: unknown, context?: Record<string, unknown>): void;
}

export interface MetricsHook {
  timing(name: string, ms: number, tags?: Record<string, string>): void;
  count(name: string, delta?: number, tags?: Record<string, string>): void;
}

export interface AnalyticsHook {
  track(event: string, props?: Record<string, unknown>): void;
}

export function createErrorReporter(env: Env, logger: Logger): ErrorReporter {
  // SENTRY_DSN present -> swap in a Sentry adapter here later. The seam exists
  // now so the swap is additive.
  void env.SENTRY_DSN;
  return {
    capture(error, context) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      logger.error("error.captured", { message, stack, ...context });
    },
  };
}

export function createMetrics(logger: Logger): MetricsHook {
  return {
    timing(name, ms, tags) {
      logger.debug("metric.timing", { name, ms, ...tags });
    },
    count(name, delta = 1, tags) {
      logger.debug("metric.count", { name, delta, ...tags });
    },
  };
}
