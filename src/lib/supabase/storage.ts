import { createClient } from "./client";
import { privateMediaUrl } from "@/lib/media";

export type UploadResult =
  | { success: true; url: string }
  | { success: false; error: string };

/**
 * Image types every browser in the family will render back. HEIC is left out
 * deliberately: Safari shows it, Chrome and Android do not, so an iPhone HEIC
 * avatar would silently be a blank circle for half the House. iOS converts to
 * JPEG when the photo comes from the photo library, so this costs nothing in
 * the common case and produces a fixable message in the rare one.
 */
export const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

/** A phone photo is a few MB; anything past this is a mistake, not a portrait. */
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB

export interface UploadConstraints {
  allowedTypes?: readonly string[];
  maxBytes?: number;
}

/**
 * Check a file BEFORE it leaves the phone, so a wrong pick costs no upload and
 * the relative gets a plain-language reason instead of a Storage error code.
 * Returns null when the file is fine.
 */
export function validateUpload(
  file: File,
  { allowedTypes = IMAGE_MIME_TYPES, maxBytes = MAX_AVATAR_BYTES }: UploadConstraints = {}
): string | null {
  if (!allowedTypes.includes(file.type)) {
    return "That file isn't a photo. Pick a JPG, PNG, or WEBP.";
  }
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return `That photo is too large. Pick one under ${mb} MB.`;
  }
  return null;
}

/**
 * Upload a file to a Supabase Storage bucket from the browser.
 *
 * The file is uploaded using the user's authenticated session (RLS applies).
 * Returns a membership-gated application URL on success. Pass `constraints` to reject a file on
 * type/size before a single byte goes over the wire.
 */
export async function uploadFile(
  bucket: string,
  path: string,
  file: File,
  constraints?: UploadConstraints
): Promise<UploadResult> {
  if (constraints) {
    const invalid = validateUpload(file, constraints);
    if (invalid) return { success: false, error: invalid };
  }

  const supabase = createClient();

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, url: privateMediaUrl(bucket, path) };
}

/**
 * Generate a unique storage path for a file.
 * Format: memberId/randomUUID-filename
 */
export function storagePath(memberId: string, fileName: string): string {
  const timestamp = crypto.randomUUID();
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${memberId}/${timestamp}-${sanitized}`;
}

/**
 * Bucket avatars live in.
 *
 * New portraits retain the established `feed-media/avatars/` namespace so
 * existing profile references and ownership checks remain compatible. The
 * migration also protects the separate legacy `avatars` bucket; all access
 * goes through the membership-gated media route.
 */
export const AVATAR_BUCKET = "feed-media";

/** Storage path for a member's profile photo: avatars/memberId/randomUUID-name */
export function avatarStoragePath(memberId: string, fileName: string): string {
  return `avatars/${storagePath(memberId, fileName)}`;
}
