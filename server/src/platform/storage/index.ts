import type { SupabaseClient } from "@supabase/supabase-js";
import type { StorageProvider, StoredObject } from "./types";
import { ApiError } from "../../lib/errors";

export * from "./types";

/** Supabase Storage adapter. */
export class SupabaseStorageProvider implements StorageProvider {
  readonly name = "supabase";
  constructor(private db: SupabaseClient) {}

  async upload(bucket: string, path: string, data: Uint8Array, contentType: string): Promise<StoredObject> {
    const { error } = await this.db.storage.from(bucket).upload(path, data, {
      contentType,
      upsert: true,
    });
    if (error) throw new ApiError("upstream_error", "Upload failed.", { internal: error });
    const { data: pub } = this.db.storage.from(bucket).getPublicUrl(path);
    return { path, publicUrl: pub.publicUrl ?? null };
  }

  async signedUrl(bucket: string, path: string, expiresSeconds: number): Promise<string | null> {
    const { data, error } = await this.db.storage.from(bucket).createSignedUrl(path, expiresSeconds);
    if (error) return null;
    return data.signedUrl;
  }

  async remove(bucket: string, path: string): Promise<void> {
    await this.db.storage.from(bucket).remove([path]);
  }
}

/** No-op backend for demo mode — uploads are politely refused. */
export class NoopStorageProvider implements StorageProvider {
  readonly name = "noop";
  async upload(): Promise<StoredObject> {
    throw ApiError.unavailable("File storage isn't configured on this deployment.");
  }
  async signedUrl(): Promise<string | null> {
    return null;
  }
  async remove(): Promise<void> {}
}
