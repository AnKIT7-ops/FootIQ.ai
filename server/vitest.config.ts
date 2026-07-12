import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // memory cache tests use fake timers; keep them isolated
    isolate: true,
  },
});
