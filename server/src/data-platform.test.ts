import { describe, expect, it, vi } from "vitest";
import { loadEnv } from "./config/env";
import { createApp, createServer } from "./app";
import { FootballDataOrgProvider } from "./providers/football-data";
import { MockProvider } from "./providers/demo";
import { mergeMatches, mergeStandings } from "./jobs/normalize";
import { JobRegistry } from "./jobs/registry";
import { MemoryCache } from "./cache/memory";
import { ProviderTraceStore } from "./providers/trace";
import { TieredCache } from "./cache/tiered";
import { createLogger } from "./lib/logger";
import * as demo from "./data/demo";

const testEnv = (extra: Record<string, string> = {}) =>
  loadEnv({ NODE_ENV: "test", CORS_ORIGINS: "http://localhost:5173", RATE_LIMIT_DISABLED: "true", ...extra });

const silent = createLogger("error");

/* eslint-disable @typescript-eslint/no-explicit-any */
const json = async (r: Response): Promise<{ ok: boolean; data: any; meta?: any }> =>
  (await r.json()) as { ok: boolean; data: any; meta?: any };

// ---- provider normalization --------------------------------------------------

/** Tests inject a no-op sleep, so throttling never actually delays a run. */
const WINDOW = { pastDays: 14, futureDays: 60 };

describe("FootballDataOrgProvider", () => {
  const rawStandings = {
    standings: [
      {
        type: "TOTAL",
        table: [
          {
            position: 1,
            team: { id: 57, name: "Arsenal FC", shortName: "Arsenal", tla: "ARS", crest: "https://x/57.png" },
            playedGames: 30,
            won: 22,
            draw: 5,
            lost: 3,
            points: 71,
            goalsFor: 70,
            goalsAgainst: 24,
            form: "W,W,D,W,L",
          },
        ],
      },
    ],
  };

  it("normalizes standings and validates the raw schema", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(rawStandings), { status: 200 }));
    const p = new FootballDataOrgProvider("key", ["PL"], WINDOW, fetchImpl as unknown as typeof fetch, async () => {});
    const rows = await p.fetchStandings();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Arsenal FC", tla: "ARS", position: 1, points: 71, form: "WWDWL" });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("throws ProviderError on schema drift instead of passing garbage", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ standings: [{ nope: true }] }), { status: 200 }));
    const p = new FootballDataOrgProvider("key", ["PL"], WINDOW, fetchImpl as unknown as typeof fetch, async () => {});
    await expect(p.fetchStandings()).rejects.toThrow(/schema drift/);
  });

  it("is unavailable without a key", () => {
    expect(new FootballDataOrgProvider(undefined, ["PL"], WINDOW).available()).toBe(false);
  });

  describe("provider traces", () => {
    const traceStore = (mode: "off" | "failures" | "all") =>
      new ProviderTraceStore(new MemoryCache(), mode, silent);

    it("keeps the raw payload of a DRIFTED response — the case raw-on-success can't cover", async () => {
      // The whole point: validation runs before normalization, so a drifted
      // payload produces no entity to hang `raw` off. The trace is filed
      // against the FETCH, so the evidence survives.
      const drifted = { standings: [{ nope: true }] };
      const traces = traceStore("failures");
      const p = new FootballDataOrgProvider(
        "key", ["PL"], WINDOW,
        vi.fn(async () => new Response(JSON.stringify(drifted), { status: 200 })) as unknown as typeof fetch,
        async () => {},
        traces,
      );

      await expect(p.fetchStandings()).rejects.toThrow(/schema drift/);

      const recorded = await traces.list();
      const failure = recorded.find((t) => !t.ok && t.error?.includes("schema drift"));
      expect(failure).toBeDefined();
      // The exact bytes that broke it, inspectable without re-requesting.
      expect(failure!.raw).toEqual(drifted);
      expect(failure!.endpoint).toBe("/competitions/PL/standings");
    });

    it("keeps a non-JSON error body verbatim", async () => {
      // An HTML 502 or a rate-limit page is exactly what you want to see;
      // res.json() would have thrown it away.
      const traces = traceStore("failures");
      const p = new FootballDataOrgProvider(
        "key", ["PL"], WINDOW,
        vi.fn(async () => new Response("<html>502 Bad Gateway</html>", { status: 502 })) as unknown as typeof fetch,
        async () => {},
        traces,
      );
      await expect(p.fetchStandings()).rejects.toThrow(/HTTP 502/);

      const failure = (await traces.list()).find((t) => !t.ok);
      expect(failure?.raw).toContain("502 Bad Gateway");
      expect(failure?.httpStatus).toBe(502);
    });

    it("records nothing on success in `failures` mode, but does in `all`", async () => {
      const okResponse = () =>
        vi.fn(async () => new Response(JSON.stringify(rawStandings), { status: 200 })) as unknown as typeof fetch;

      const quiet = traceStore("failures");
      await new FootballDataOrgProvider("key", ["PL"], WINDOW, okResponse(), async () => {}, quiet).fetchStandings();
      expect(await quiet.list()).toHaveLength(0); // zero steady-state cost

      const loud = traceStore("all");
      await new FootballDataOrgProvider("key", ["PL"], WINDOW, okResponse(), async () => {}, loud).fetchStandings();
      const [trace] = await loud.list();
      expect(trace.ok).toBe(true);
      expect(trace.raw).toEqual(rawStandings);
      expect(trace.bytes).toBeGreaterThan(0);
    });

    it("a drifted payload does NOT overwrite the last known-good trace", async () => {
      // The bug this pins: schema drift arrives with HTTP 200. Recording
      // success at the HTTP layer meant the drifted body was filed as "ok"
      // (evicting the real baseline) AND as "fail" — both slots holding the
      // same broken payload, so there was nothing left to diff against.
      // "ok" means the payload validated, not that the socket behaved.
      const traces = traceStore("all");
      const provider = (fetchImpl: typeof fetch) =>
        new FootballDataOrgProvider("key", ["PL"], WINDOW, fetchImpl, async () => {}, traces);

      await provider(
        vi.fn(async () => new Response(JSON.stringify(rawStandings), { status: 200 })) as unknown as typeof fetch,
      ).fetchStandings();

      const drifted = { standings: [{ nope: true }] };
      await expect(
        provider(
          vi.fn(async () => new Response(JSON.stringify(drifted), { status: 200 })) as unknown as typeof fetch,
        ).fetchStandings(),
      ).rejects.toThrow();

      const all = await traces.list();
      const success = all.find((t) => t.ok);
      const failure = all.find((t) => !t.ok);

      // The good payload survived the drift — this is the whole feature.
      expect(success?.raw).toEqual(rawStandings);
      expect(failure?.raw).toEqual(drifted);
    });
  });
});

describe("normalize merge", () => {
  it("overlays provider numbers onto a name-matched demo team, keeping its identity", () => {
    const merged = mergeStandings([
      { extId: "fd-57", name: "Arsenal FC", competition: "Premier League", tla: "ARS", position: 4, played: 30, won: 20, drawn: 6, lost: 4, gf: 66, ga: 30, points: 66, form: "WWLDW" },
    ]);
    const ars = merged.find((t) => t.id === "ars")!;
    expect(ars.position).toBe(4);
    expect(ars.points).toBe(66);
    expect(ars.name).toBe(demo.teamById.get("ars")!.name); // identity kept
    expect(ars.aiReport.length).toBeGreaterThan(0); // FootIQ depth kept
  });

  it("synthesizes a full Team for provider teams the demo has never seen", () => {
    const merged = mergeStandings([
      { extId: "fd-999", name: "Ipswich Town FC", competition: "Premier League", position: 18, played: 30, won: 5, drawn: 6, lost: 19, gf: 25, ga: 60, points: 21 },
    ]);
    const ipswich = merged.find((t) => t.name === "Ipswich Town FC")!;
    expect(ipswich.id).toBe("fd-999");
    expect(ipswich.style.tempo).toBeGreaterThan(0); // deterministic dials present
    // The snapshot is the synced competition and nothing else. It used to also
    // carry demo clubs from other leagues, which polluted the league table;
    // they stay reachable through the catalog, not through the standings.
    expect(merged).toHaveLength(1);
    expect(merged.map((t) => t.id)).not.toContain("rma");
  });

  it("maps matches onto known teams and discovers clubs the standings lack", () => {
    const { grouped, discoveredTeams } = mergeMatches(
      [
        { extId: "fd-1", homeExtId: "fd-57", awayExtId: "fd-64", homeName: "Arsenal FC", awayName: "Liverpool FC", competition: "PL", status: "finished", kickoffIso: "2026-07-05T16:30:00Z", homeScore: 2, awayScore: 1 },
        { extId: "fd-2", homeExtId: "fd-901", awayExtId: "fd-902", homeName: "Unknown XI", awayName: "Mystery FC", competition: "PL", status: "upcoming", kickoffIso: "2026-07-20T14:00:00Z" },
      ],
      demo.teams,
    );
    // Known clubs still resolve to their demo identity.
    expect(grouped.finished).toHaveLength(1);
    expect(grouped.finished[0]).toMatchObject({ homeId: "ars", awayId: "liv", homeScore: 2 });

    // Unknown clubs no longer cause the fixture to vanish. This used to be
    // asserted as `upcoming).toHaveLength(0)` — the behaviour that dropped 35
    // of 193 real fixtures, because standings roll over to a new season later
    // than fixtures do and every promoted club was therefore "unresolvable".
    expect(grouped.upcoming).toHaveLength(1);
    expect(discoveredTeams.map((t) => t.id).sort()).toEqual(["fd-901", "fd-902"]);
  });

  it("resolves a fixture by provider id even when our name for the club differs", () => {
    // Bayern is stored under the demo name "Bayern Munich"; the provider calls
    // it "FC Bayern München". Name canonicalization cannot bridge that, so id
    // resolution is the only thing keeping these fixtures alive.
    const teams = mergeStandings([
      { extId: "fd-5", name: "FC Bayern München", competition: "Bundesliga", tla: "FCB", position: 1, played: 1, won: 1, drawn: 0, lost: 0, gf: 3, ga: 0, points: 3 },
    ]);
    const { grouped, discoveredTeams } = mergeMatches(
      [
        { extId: "fd-9", homeExtId: "fd-5", awayExtId: "fd-5", homeName: "FC Bayern München", awayName: "FC Bayern München", competition: "Bundesliga", status: "upcoming", kickoffIso: "2026-08-22T14:00:00Z" },
      ],
      teams,
    );
    expect(grouped.upcoming).toHaveLength(1);
    expect(grouped.upcoming[0].homeId).toBe(teams[0].id);
    expect(discoveredTeams).toHaveLength(0); // matched, not re-invented
  });

  it("reports an empty provider window as empty — never as demo fixtures", () => {
    // The off-season regression, pinned. Both merges used to substitute the
    // bundled demo dataset when the provider returned zero rows, so a healthy
    // sync during a break in the calendar published a permanently-live 67th
    // minute demo match under provider provenance.
    expect(mergeStandings([])).toEqual([]);
    const { grouped: g } = mergeMatches([], demo.teams);
    expect(g.live).toEqual([]);
    expect(g.upcoming).toEqual([]);
    expect(g.finished).toEqual([]);
  });

  it("buckets postponed and cancelled fixtures instead of calling them upcoming", () => {
    const { grouped: g } = mergeMatches(
      [
        { extId: "fd-3", homeExtId: "fd-57", awayExtId: "fd-64", homeName: "Arsenal FC", awayName: "Liverpool FC", competition: "PL", status: "postponed", kickoffIso: "2026-08-22T14:00:00Z" },
        { extId: "fd-4", homeExtId: "fd-61", awayExtId: "fd-57", homeName: "Chelsea FC", awayName: "Arsenal FC", competition: "PL", status: "cancelled", kickoffIso: "2026-08-23T14:00:00Z" },
      ],
      demo.teams,
    );
    expect(g.postponed).toHaveLength(1);
    expect(g.cancelled).toHaveLength(1);
    expect(g.upcoming).toHaveLength(0);
  });

  it("stops calling a match live once it is past any possible final whistle", () => {
    // Production, 2026-09-17: football-data.org still reported Levante v
    // Athletic (fd-564685) IN_PLAY at 0-0 eight hours after kickoff, and the
    // app showed it live. We don't know the result, so it is not "finished"
    // either — it is unconfirmed, with no score.
    const now = Date.parse("2026-09-17T03:00:00Z");
    const live = (extId: string, kickoffIso: string) => ({
      extId, homeExtId: "fd-57", awayExtId: "fd-64", homeName: "Arsenal FC", awayName: "Liverpool FC",
      competition: "PL", status: "live" as const, kickoffIso, homeScore: 0, awayScore: 0,
    });
    const { grouped: g } = mergeMatches(
      [live("fd-stuck", "2026-09-16T19:30:00Z"), live("fd-real", "2026-09-17T01:15:00Z")],
      demo.teams,
      now,
    );
    expect(g.live.map((m) => m.id)).toEqual(["fd-real"]); // 1h45 in: extra time is still plausible
    expect(g.unconfirmed).toHaveLength(1);
    expect(g.unconfirmed[0]).toMatchObject({ id: "fd-stuck", status: "unconfirmed", homeScore: undefined, awayScore: undefined });
    expect(g.finished).toHaveLength(0);
  });
});

// ---- job registry --------------------------------------------------------------

describe("JobRegistry", () => {
  it("retries with backoff and records the failure after exhausting attempts", async () => {
    vi.useFakeTimers();
    const registry = new JobRegistry(new MemoryCache(), null, silent);
    let attempts = 0;
    registry.register({
      name: "flaky",
      description: "test",
      async run() {
        attempts++;
        throw new Error(`boom ${attempts}`);
      },
    });
    const promise = registry.runJob("flaky");
    await vi.runAllTimersAsync();
    const run = await promise;
    vi.useRealTimers();

    expect(attempts).toBe(3);
    expect(run.status).toBe("failed");
    expect(run.attempts).toBe(3);
    expect(run.detail).toContain("boom 3");
    expect((await registry.lastRuns())[0]?.status).toBe("failed");
  });

  it("succeeds on a later attempt and reports ok", async () => {
    vi.useFakeTimers();
    const registry = new JobRegistry(new MemoryCache(), null, silent);
    let attempts = 0;
    registry.register({
      name: "recovers",
      description: "test",
      async run() {
        attempts++;
        if (attempts < 2) throw new Error("transient");
        return "done";
      },
    });
    const promise = registry.runJob("recovers");
    await vi.runAllTimersAsync();
    const run = await promise;
    vi.useRealTimers();
    expect(run).toMatchObject({ status: "ok", attempts: 2, detail: "done" });
  });
});

// ---- tiered cache ---------------------------------------------------------------

describe("TieredCache", () => {
  it("serves repeat reads from the memory front without hitting the back", async () => {
    const back = new MemoryCache();
    const spy = vi.spyOn(back, "get");
    const tiered = new TieredCache(back);
    await tiered.set("k", { v: 1 }, 300);
    expect(await tiered.get("k")).toEqual({ v: 1 });
    expect(await tiered.get("k")).toEqual({ v: 1 });
    expect(spy).not.toHaveBeenCalled(); // front absorbed both reads
  });

  it("sends increments straight to the shared back (rate limiting correctness)", async () => {
    const back = new MemoryCache();
    const tiered = new TieredCache(back);
    await tiered.increment("rl", 60);
    expect(await back.increment("rl", 60)).toBe(2); // same counter
  });
});

// ---- pipeline end-to-end through the API -----------------------------------------

describe("sync pipeline → API", () => {
  it("serves provider-sourced teams after a sync, demo before", async () => {
    const provider = new MockProvider({
      standings: [
        { extId: "m-1", name: "Arsenal FC", competition: "Premier League", tla: "ARS", position: 9, played: 30, won: 10, drawn: 9, lost: 11, gf: 40, ga: 41, points: 39 },
      ],
    });
    const { app, services } = createServer(testEnv(), { services: { dataProvider: provider }, fetchNews: async () => [] });

    const before = await json(await app.request("/api/teams"));
    expect(before.meta.source).toBe("demo");

    const runs = await services.jobs.runAll();
    expect(runs.every((r) => r.status === "ok")).toBe(true);

    const after = await json(await app.request("/api/teams"));
    expect(after.meta.source).toBe("provider");
    expect(after.data.find((t: { id: string }) => t.id === "ars").position).toBe(9);

    // Demo clubs from other competitions stay reachable for lookup and search...
    expect(after.data.map((t: { id: string }) => t.id)).toContain("rma");

    // ...but must never appear in the league table. Real Madrid carries 73
    // fabricated demo points; ranking it inside a provider-sourced table put a
    // made-up number above every real one, under the emerald "fact" chip.
    const table = await json(await app.request("/api/teams/table"));
    const ids = table.data.map((t: { id: string }) => t.id);
    expect(ids).not.toContain("rma");
    expect(ids).toContain("ars");
    expect(new Set(table.data.map((t: { league: string }) => t.league)).size).toBe(1); // one league, always
  });
});

// ---- new API surface ----------------------------------------------------------------

describe("v1 alias + suggest + recommendations + export", () => {
  const app = createApp(testEnv());

  it("serves identical payloads at /api and /api/v1", async () => {
    const a = await json(await app.request("/api/players/saka"));
    const b = await json(await app.request("/api/v1/players/saka"));
    expect(a.data.id).toBe("saka");
    expect(b.data).toEqual(a.data);
  });

  it("suggest returns prefix matches including managers", async () => {
    const res = await json(await app.request("/api/search/suggest?q=art"));
    expect(res.ok).toBe(true);
    expect(res.data.some((r: { kind: string }) => r.kind === "manager")).toBe(true);
  });

  it("related articles come with reasons", async () => {
    const res = await json(await app.request("/api/recommendations/articles/n1"));
    expect(res.ok).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data[0].reason.length).toBeGreaterThan(3);
  });

  it("suggested comparisons stay within the player's position", async () => {
    const res = await json(await app.request("/api/recommendations/comparisons/saka"));
    const base = demo.playerById.get("saka")!;
    for (const r of res.data) expect(r.player.position).toBe(base.position);
  });

  it("export returns a JSON attachment with provenance", async () => {
    const res = await app.request("/api/export/players/saka");
    expect(res.headers.get("content-disposition")).toContain("footiq-player-saka.json");
    const body = JSON.parse(await res.text());
    expect(body.kind).toBe("player-report");
    expect(body.disclaimer).toContain("AI");
    expect(body.data.id).toBe("saka");
  });

  it("health v2 reports provider, cache backend and job state", async () => {
    const res = await json(await app.request("/api/health"));
    expect(res.data.dataProvider.name).toBe("demo");
    expect(res.data.cache).toBe("memory");
    expect(res.data.apiVersion).toBe("v1");
    expect(Array.isArray(res.data.jobs)).toBe(true);
  });
});
