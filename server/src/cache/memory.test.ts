import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryCache } from "./memory";

describe("MemoryCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores and retrieves values", async () => {
    const cache = new MemoryCache();
    await cache.set("k", { a: 1 }, 60);
    expect(await cache.get("k")).toEqual({ a: 1 });
  });

  it("expires values after their TTL", async () => {
    const cache = new MemoryCache();
    await cache.set("k", "v", 10);
    vi.advanceTimersByTime(9_999);
    expect(await cache.get("k")).toBe("v");
    vi.advanceTimersByTime(2);
    expect(await cache.get("k")).toBeNull();
  });

  it("deletes values", async () => {
    const cache = new MemoryCache();
    await cache.set("k", "v", 60);
    await cache.delete("k");
    expect(await cache.get("k")).toBeNull();
  });

  it("evicts the least recently used entry at capacity", async () => {
    const cache = new MemoryCache(2);
    await cache.set("a", 1, 60);
    await cache.set("b", 2, 60);
    await cache.get("a"); // refresh recency of a
    await cache.set("c", 3, 60); // evicts b
    expect(await cache.get("a")).toBe(1);
    expect(await cache.get("b")).toBeNull();
    expect(await cache.get("c")).toBe(3);
  });

  it("increments atomically with TTL on first write", async () => {
    const cache = new MemoryCache();
    expect(await cache.increment("n", 30)).toBe(1);
    expect(await cache.increment("n", 30)).toBe(2);
    expect(await cache.increment("n", 30)).toBe(3);
    vi.advanceTimersByTime(30_001);
    expect(await cache.increment("n", 30)).toBe(1); // window reset
  });
});
