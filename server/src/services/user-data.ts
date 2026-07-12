import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "../lib/errors";
import type {
  BookmarkDto,
  FavoriteDto,
  SavedComparisonDto,
  TacticalBoardDto,
} from "../../../shared/contracts";

/**
 * User-owned records (favorites, bookmarks, boards, comparisons, settings).
 * Requires the database — in demo mode these endpoints return
 * service_unavailable and the frontend keeps its localStorage behavior.
 * All queries are user-scoped even though the service role bypasses RLS.
 */
export class UserDataService {
  constructor(private db: SupabaseClient | null) {}

  private need(): SupabaseClient {
    if (!this.db) throw ApiError.unavailable("Accounts aren't enabled on this deployment.");
    return this.db;
  }

  // --- favorites -----------------------------------------------------------

  async listFavorites(userId: string): Promise<FavoriteDto[]> {
    const { data, error } = await this.need()
      .from("favorites")
      .select("id, kind, ref_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new ApiError("upstream_error", "Couldn't load favorites.", { internal: error });
    return (data ?? []).map((r) => ({
      id: r.id,
      kind: r.kind,
      refId: r.ref_id,
      createdAt: r.created_at,
    }));
  }

  async addFavorite(userId: string, kind: "team" | "player", refId: string): Promise<void> {
    const { error } = await this.need()
      .from("favorites")
      .upsert({ user_id: userId, kind, ref_id: refId }, { onConflict: "user_id,kind,ref_id" });
    if (error) throw new ApiError("upstream_error", "Couldn't save favorite.", { internal: error });
  }

  async removeFavorite(userId: string, kind: "team" | "player", refId: string): Promise<void> {
    await this.need().from("favorites").delete().match({ user_id: userId, kind, ref_id: refId });
  }

  // --- bookmarks -----------------------------------------------------------

  async listBookmarks(userId: string): Promise<BookmarkDto[]> {
    const { data, error } = await this.need()
      .from("bookmarks")
      .select("id, kind, ref_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new ApiError("upstream_error", "Couldn't load bookmarks.", { internal: error });
    return (data ?? []).map((r) => ({
      id: r.id,
      kind: r.kind,
      refId: r.ref_id,
      createdAt: r.created_at,
    }));
  }

  async addBookmark(
    userId: string,
    kind: "news" | "match" | "player" | "team",
    refId: string,
  ): Promise<void> {
    const { error } = await this.need()
      .from("bookmarks")
      .upsert({ user_id: userId, kind, ref_id: refId }, { onConflict: "user_id,kind,ref_id" });
    if (error) throw new ApiError("upstream_error", "Couldn't save bookmark.", { internal: error });
  }

  async removeBookmark(userId: string, id: string): Promise<void> {
    await this.need().from("bookmarks").delete().match({ id, user_id: userId });
  }

  // --- tactical boards -----------------------------------------------------

  async listBoards(userId: string): Promise<TacticalBoardDto[]> {
    const { data, error } = await this.need()
      .from("tactical_boards")
      .select("id, name, formation, state, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new ApiError("upstream_error", "Couldn't load boards.", { internal: error });
    return (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      formation: r.formation,
      state: r.state,
      updatedAt: r.updated_at,
    }));
  }

  async saveBoard(
    userId: string,
    board: { id?: string; name: string; formation: string; state?: unknown },
    maxBoards: number,
  ): Promise<string> {
    const db = this.need();
    if (!board.id) {
      const { count } = await db
        .from("tactical_boards")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      if ((count ?? 0) >= maxBoards) {
        throw ApiError.quota(`Board limit reached (${maxBoards}). Upgrade to save more.`);
      }
    }
    const row = {
      ...(board.id ? { id: board.id } : {}),
      user_id: userId,
      name: board.name,
      formation: board.formation,
      state: board.state ?? {},
    };
    const { data, error } = await db
      .from("tactical_boards")
      .upsert(row)
      .eq("user_id", userId)
      .select("id")
      .single();
    if (error || !data) throw new ApiError("upstream_error", "Couldn't save board.", { internal: error });
    return data.id;
  }

  async deleteBoard(userId: string, id: string): Promise<void> {
    await this.need().from("tactical_boards").delete().match({ id, user_id: userId });
  }

  // --- saved comparisons ---------------------------------------------------

  async listComparisons(userId: string): Promise<SavedComparisonDto[]> {
    const { data, error } = await this.need()
      .from("saved_comparisons")
      .select("id, player_ids, note, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new ApiError("upstream_error", "Couldn't load comparisons.", { internal: error });
    return (data ?? []).map((r) => ({
      id: r.id,
      playerIds: r.player_ids,
      note: r.note,
      createdAt: r.created_at,
    }));
  }

  async saveComparison(
    userId: string,
    playerIds: string[],
    note: string | null,
    maxSaved: number,
  ): Promise<string> {
    const db = this.need();
    const { count } = await db
      .from("saved_comparisons")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if ((count ?? 0) >= maxSaved) {
      throw ApiError.quota(`Saved comparison limit reached (${maxSaved}).`);
    }
    const { data, error } = await db
      .from("saved_comparisons")
      .insert({ user_id: userId, player_ids: playerIds, note })
      .select("id")
      .single();
    if (error || !data) throw new ApiError("upstream_error", "Couldn't save comparison.", { internal: error });
    return data.id;
  }

  async deleteComparison(userId: string, id: string): Promise<void> {
    await this.need().from("saved_comparisons").delete().match({ id, user_id: userId });
  }

  // --- settings ------------------------------------------------------------

  async getSettings(userId: string): Promise<Record<string, unknown>> {
    const { data } = await this.need()
      .from("user_settings")
      .select("theme, language, email_news, email_match_alerts, extras")
      .eq("user_id", userId)
      .maybeSingle();
    return (
      data ?? { theme: "dark", language: "en", email_news: false, email_match_alerts: false, extras: {} }
    );
  }

  async updateSettings(userId: string, patch: Record<string, unknown>): Promise<void> {
    const { error } = await this.need()
      .from("user_settings")
      .upsert({ user_id: userId, ...patch });
    if (error) throw new ApiError("upstream_error", "Couldn't save settings.", { internal: error });
  }

  // --- profile -------------------------------------------------------------

  async getProfile(userId: string): Promise<Record<string, unknown> | null> {
    const { data } = await this.need()
      .from("profiles")
      .select("id, display_name, avatar_url, role, plan, favorite_team, country, created_at")
      .eq("id", userId)
      .maybeSingle();
    return data;
  }

  async updateProfile(
    userId: string,
    patch: { display_name?: string; favorite_team?: string; country?: string },
  ): Promise<void> {
    // role/plan are not in the type and would be rejected by column grants anyway
    const { error } = await this.need().from("profiles").update(patch).eq("id", userId);
    if (error) throw new ApiError("upstream_error", "Couldn't update profile.", { internal: error });
  }
}
