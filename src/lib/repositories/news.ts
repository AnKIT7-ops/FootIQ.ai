/** News repository — see players.ts for the pattern. */
import { news as seed } from "@/data/news";
import type { NewsArticle } from "@/data/types";
import { createRepoStore } from "./store";

const store = createRepoStore<NewsArticle[]>({ name: "news", seed, endpoint: "/api/news" });

export let news: NewsArticle[] = store.get();
export let newsById = new Map(news.map((n) => [n.id, n]));
export let breakingNews = news.filter((n) => n.minutesAgo < 120);

store.onChange((next) => {
  news = next;
  newsById = new Map(next.map((n) => [n.id, n]));
  breakingNews = next.filter((n) => n.minutesAgo < 120);
});

export const useNews = store.use;
export const refreshNews = store.refresh;
