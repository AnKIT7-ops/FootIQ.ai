/**
 * File storage abstraction — prepared for avatars, exported reports, and
 * tactical board images. Supabase Storage (1GB free) is the first real
 * backend; the interface stays provider-neutral.
 */

export interface StoredObject {
  path: string;
  publicUrl: string | null;
}

export interface StorageProvider {
  readonly name: string;
  upload(bucket: string, path: string, data: Uint8Array, contentType: string): Promise<StoredObject>;
  /** Time-limited URL for private objects. */
  signedUrl(bucket: string, path: string, expiresSeconds: number): Promise<string | null>;
  remove(bucket: string, path: string): Promise<void>;
}

/** Allowed buckets — anything else is a programming error. */
export const BUCKETS = {
  avatars: "avatars",
  boards: "boards",
  exports: "exports",
} as const;
