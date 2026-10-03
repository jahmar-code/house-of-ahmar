import { getAuthContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isMediaBucket, isSafeStoragePath } from "@/lib/media";

const HEADERS = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Vary": "Cookie" };

/** No public optimizer/CDN cache and no reusable signed URLs for family photos. */
export async function GET(_request: Request, { params }: { params: Promise<{ bucket: string; path: string[] }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return new Response("Not authorized", { status: 401, headers: HEADERS });

  const { bucket, path: segments } = await params;
  const path = segments.join("/");
  if (!isMediaBucket(bucket) || !isSafeStoragePath(path)) {
    return new Response("Not found", { status: 404, headers: HEADERS });
  }
  // Archives have no current UI or album permission flow. Keep retained files
  // Elder-only until that feature and its per-album permissions are restored.
  if (bucket === "archives" && ctx.role !== "elder") {
    return new Response("Not found", { status: 404, headers: HEADERS });
  }

  const supabase = await createClient();
  // Uses the user's session: Storage RLS independently checks active membership.
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) return new Response("Not found", { status: 404, headers: HEADERS });
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(data.type)) {
    return new Response("Unsupported media", { status: 415, headers: HEADERS });
  }
  return new Response(data, { headers: { ...HEADERS, "Content-Type": data.type, "Content-Disposition": "inline" } });
}
