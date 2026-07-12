import "dotenv/config";
import { serve } from "@hono/node-server";
import { loadEnv } from "./config/env";
import { createApp } from "./app";

/** Node entrypoint — local dev, Railway, Render. */
const env = loadEnv(process.env);
const app = createApp(env);

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  // human-readable on purpose: this is the one line devs look for
  console.log(`FootIQ API listening on http://localhost:${info.port} (${env.NODE_ENV})`);
});
