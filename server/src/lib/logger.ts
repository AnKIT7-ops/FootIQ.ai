/**
 * Structured JSON logger — one line per event, machine-parseable, vendor-free.
 * Works on Node and Workers (console.* maps to the platform's log sink; on
 * Workers these land in `wrangler tail` / dashboard logs).
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  /** New logger with fields merged into every line (e.g. requestId). */
  child(fields: Record<string, unknown>): Logger;
}

export function createLogger(minLevel: LogLevel = "info", base: Record<string, unknown> = {}): Logger {
  const emit = (level: LogLevel, msg: string, fields?: Record<string, unknown>) => {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      msg,
      ...base,
      ...fields,
    });
    // console.error for error level keeps severity visible to platform log routers
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  };
  return {
    debug: (m, f) => emit("debug", m, f),
    info: (m, f) => emit("info", m, f),
    warn: (m, f) => emit("warn", m, f),
    error: (m, f) => emit("error", m, f),
    child: (fields) => createLogger(minLevel, { ...base, ...fields }),
  };
}
