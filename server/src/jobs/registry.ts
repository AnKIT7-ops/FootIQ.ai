import type { SupabaseClient } from "@supabase/supabase-js";
import type { CacheStore } from "../cache/types";
import type { Logger } from "../lib/logger";

/**
 * Background job registry — named jobs, retry with backoff, run records.
 *
 * Runs from two triggers with identical semantics:
 *   Workers: `scheduled` handler (cron in wrangler.toml) → runAll()
 *   Node:    setInterval when SYNC_ENABLED=true → runAll()
 *
 * Run history goes to cache (last run per job, for /health and admin) and to
 * the job_runs table when a DB exists (durable, queryable).
 */

export interface JobRun {
  name: string;
  status: "ok" | "failed";
  ms: number;
  attempts: number;
  detail?: string;
  at: string;
}

export interface Job {
  name: string;
  /** Human line for docs/admin. */
  description: string;
  run(): Promise<string | void>;
}

const RETRIES = 3;
const lastRunKey = (name: string) => `job:last:${name}`;

export class JobRegistry {
  private jobs = new Map<string, Job>();
  private running = false;

  constructor(
    private cache: CacheStore,
    private db: SupabaseClient | null,
    private logger: Logger,
  ) {}

  register(job: Job): void {
    this.jobs.set(job.name, job);
  }

  names(): string[] {
    return [...this.jobs.keys()];
  }

  async lastRuns(): Promise<JobRun[]> {
    const runs = await Promise.all([...this.jobs.keys()].map((n) => this.cache.get<JobRun>(lastRunKey(n))));
    return runs.filter((r): r is JobRun => r !== null);
  }

  /** Run one job with retry/backoff; always records the outcome. */
  async runJob(name: string): Promise<JobRun> {
    const job = this.jobs.get(name);
    if (!job) throw new Error(`Unknown job: ${name}`);

    const started = Date.now();
    let attempts = 0;
    let lastError = "";
    let status: JobRun["status"] = "failed";
    let detail: string | undefined;

    while (attempts < RETRIES) {
      attempts++;
      try {
        detail = (await job.run()) ?? undefined;
        status = "ok";
        break;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        this.logger.warn("job.attempt_failed", { job: name, attempt: attempts, error: lastError });
        if (attempts < RETRIES) {
          await new Promise((r) => setTimeout(r, 400 * 2 ** (attempts - 1)));
        }
      }
    }

    const run: JobRun = {
      name,
      status,
      ms: Date.now() - started,
      attempts,
      detail: status === "ok" ? detail : lastError,
      at: new Date().toISOString(),
    };

    await this.cache.set(lastRunKey(name), run, 60 * 60 * 24 * 7);
    if (this.db) {
      const { error } = await this.db.from("job_runs").insert({
        name: run.name,
        status: run.status,
        ms: run.ms,
        attempts: run.attempts,
        detail: run.detail?.slice(0, 500) ?? null,
      });
      if (error) this.logger.warn("job.record_failed", { job: name, error: error.message });
    }

    this.logger[status === "ok" ? "info" : "error"]("job.finished", { ...run });
    return run;
  }

  /** Run every registered job sequentially (providers are rate-limited upstream — no parallel hammering). */
  async runAll(): Promise<JobRun[]> {
    if (this.running) return []; // overlapping cron tick — skip, the active pass owns it
    this.running = true;
    try {
      const out: JobRun[] = [];
      for (const name of this.jobs.keys()) out.push(await this.runJob(name));
      return out;
    } finally {
      this.running = false;
    }
  }
}
