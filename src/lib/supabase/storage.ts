import { createClient } from "./client";

export type UploadResult =
  | { success: true; url: string }
  | { success: false; error: string };

/**
 * Upload a file to a Supabase Storage bucket from the browser.
 *
 * The file is uploaded using the user's authenticated session (RLS applies).
 * Returns the public URL on success.
 */
export async function uploadFile(
  bucket: string,
  path: string,
  file: File
): Promise<UploadResult> {
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

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(path);

  return { success: true, url: publicUrl };
}

/**
 * Generate a unique storage path for a file.
 * Format: memberId/timestamp-filename
 */
export function storagePath(memberId: string, fileName: string): string {
  const timestamp = Date.now();
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${memberId}/${timestamp}-${sanitized}`;
}
