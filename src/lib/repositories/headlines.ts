/**
 * Real headlines (BBC Sport, the Guardian, Sky Sports RSS via the API).
 * LIVE-tier: seeded empty — there is no offline answer to "what's the news",
 * and the demo articles (invented quotes about real people) are retired.
 */
import type { NewsHeadline } from "@shared/contracts";
import { createRepoStore } from "./store";

const store = createRepoStore<NewsHeadline[]>({ name: "headlines", seed: [], endpoint: "/api/headlines" });

export let headlines: NewsHeadline[] = store.get();
store.onChange((next) => {
  headlines = next;
});

export const useHeadlines = store.use;
export const useHeadlinesState = store.useState;
