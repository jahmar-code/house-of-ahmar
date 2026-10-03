/** Stable, same-origin media addresses. The route verifies current membership. */
export const MEDIA_BUCKETS = ["feed-media", "archives", "avatars"] as const;
export type MediaBucket = (typeof MEDIA_BUCKETS)[number];

export function isMediaBucket(bucket: string): bucket is MediaBucket {
  return (MEDIA_BUCKETS as readonly string[]).includes(bucket);
}

export function isSafeStoragePath(path: string): boolean {
  return path.length > 0 && path.length <= 1024 && !/[\\\u0000-\u001f\u007f%?#]/.test(path)
    && path.split("/").every((part) => part.length > 0 && part !== "." && part !== "..");
}

export function privateMediaUrl(bucket: string, path: string): string {
  return `/api/media/${encodeURIComponent(bucket)}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export function parseMediaUrl(value: string, supabaseUrl?: string): { bucket: MediaBucket; path: string } | null {
  let pathname: string;
  if (value.startsWith("/api/media/")) {
    pathname = value.slice("/api/media/".length);
  } else {
    if (!supabaseUrl) return null;
    try {
      const url = new URL(value);
      if (url.origin !== new URL(supabaseUrl).origin || url.search || url.hash) return null;
      const prefix = "/storage/v1/object/public/";
      if (!url.pathname.startsWith(prefix)) return null;
      pathname = url.pathname.slice(prefix.length);
    } catch { return null; }
  }
  try {
    const [bucket, ...segments] = pathname.split("/").map(decodeURIComponent);
    const path = segments.join("/");
    return isMediaBucket(bucket) && isSafeStoragePath(path) ? { bucket, path } : null;
  } catch { return null; }
}

/** Only accept media the caller uploaded into their own namespace. */
export function ownedMediaUrl(value: string, memberId: string, avatar = false): string | null {
  const parsed = parseMediaUrl(value, process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!parsed || parsed.bucket !== "feed-media") return null;
  const prefix = avatar ? `avatars/${memberId}/` : `${memberId}/`;
  if (!parsed.path.startsWith(prefix)) return null;
  return privateMediaUrl(parsed.bucket, parsed.path);
}
