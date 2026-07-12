import "dotenv/config";
import { serve } from "@hono/node-server";
import { loadEnv } from "./config/env";
import { createServer } from "./app";

/** Node entrypoint — local dev, Railway, Render. */
const env = loadEnv(process.env);
const { app, services } = createServer(env);

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  // human-readable on purpose: this is the one line devs look for
  console.log(`FootIQ API listening on http://localhost:${info.port} (${env.NODE_ENV})`);
});

// Background sync loop (Workers use the cron trigger instead). One pass at
// boot, then on the configured interval; the registry serializes overlaps.
if (env.SYNC_ENABLED) {
  void services.jobs.runAll();
  setInterval(() => void services.jobs.runAll(), env.SYNC_INTERVAL_MINUTES * 60_000);
  console.log(`Sync jobs enabled: [${services.jobs.names().join(", ")}] every ${env.SYNC_INTERVAL_MINUTES}m`);
}
