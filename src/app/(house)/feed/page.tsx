import { Suspense } from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { requirePageAuth } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { PostCard } from "@/components/feed/post-card";
import { PostForm } from "@/components/feed/post-form";
import { EmptyState } from "@/components/shared/empty-state";
import { PUBLIC_MEMBER_COLUMNS } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Scroll } from "lucide-react";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 50;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The Wall page that holds a live post, in the Wall's own order. A new post
 * sorts after every pinned post, so "page 1" is not always where it lands.
 * Compared in PostgreSQL: JS Dates drop the microseconds that order posts.
 */
async function pageContaining(postId: string): Promise<number | null> {
  const [row] = await db
    .select({
      ahead: sql<number>`count(*) filter (where (${posts.isPinned}, ${posts.createdAt}, ${posts.id}) > (target.is_pinned, target.created_at, target.id))::int`,
      joined: sql<number>`count(*)::int`,
    })
    .from(posts)
    .innerJoin(
      sql`(select p.is_pinned, p.created_at, p.id from public.posts as p where p.id = ${postId}::uuid and not p.is_deleted) as target`,
      sql`true`
    )
    .where(eq(posts.isDeleted, false));
  // Nothing joined means the post is gone: fall back to the asked-for page.
  return row && row.joined > 0 ? Math.floor(row.ahead / PAGE_SIZE) + 1 : null;
}

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ page?: string; post?: string }> }) {
  // Cheap and React-cached — the composer needs it, and PostList reuses the
  // same resolved context for free.
  const ctx = await requirePageAuth();
  const query = await searchParams;
  const parsedPage = Number(query.page ?? 1);
  const requested = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 10000) : 1;
  // `?post=` reveals one post — the composer sends people here after a success.
  const highlight = typeof query.post === "string" && UUID_RE.test(query.post) ? query.post : null;

  return (
    <div>
      <PageHeader
        title="The Wall"
        description="Family updates and announcements."
      />

      {ctx && ctx.role !== "guest" && (
        <PostForm memberId={ctx.memberId} role={ctx.role} />
      )}

      {/* The 50-post query with its nested comments, authors and reactions is
          the heaviest read in the app. Streaming it keeps the header and the
          composer — the only things a member can act on immediately — in the
          first byte instead of behind it. */}
      <Suspense key={`${requested}:${highlight}`} fallback={<PostListSkeleton />}>
        <PostList requested={requested} highlightId={highlight} />
      </Suspense>
    </div>
  );
}

async function PostList({ requested, highlightId }: { requested: number; highlightId: string | null }) {
  const ctx = await requirePageAuth();
  // Locating the post streams with the list, behind the header and composer.
  const page = (highlightId && (await pageContaining(highlightId))) || requested;

  const allPosts = await db.query.posts.findMany({
    where: eq(posts.isDeleted, false),
    orderBy: [desc(posts.isPinned), desc(posts.createdAt), desc(posts.id)],
    limit: PAGE_SIZE + 1,
    offset: (page - 1) * PAGE_SIZE,
    with: {
      // Byline projection only. A full member row would put every author's
      // email, phone, birthday, bio and auth_user_id into the RSC payload of
      // the app's most-visited screen — wider than the Data API itself grants.
      author: { columns: PUBLIC_MEMBER_COLUMNS },
      comments: {
        where: (comments, { eq }) => eq(comments.isDeleted, false),
        with: { author: { columns: PUBLIC_MEMBER_COLUMNS } },
        orderBy: (comments, { asc }) => [asc(comments.createdAt)],
      },
      reactions: true,
    },
  });

  return (
    <div className="mt-6 space-y-4">
      {allPosts.length === 0 ? (
        <EmptyState
          icon={Scroll}
          title={page === 1 ? "The Wall is empty" : "You've reached the end"}
          description={page === 1 ? "Be the first to write on The Wall." : "There are no more posts on this page."}
        />
      ) : (
        allPosts.slice(0, PAGE_SIZE).map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentMemberId={ctx?.memberId ?? ""}
            currentRole={ctx?.role ?? "guest"}
            highlighted={post.id === highlightId}
          />
        ))
      )}
      {(page > 1 || allPosts.length > PAGE_SIZE) && (
        <nav aria-label="Wall pages" className="flex items-center justify-between gap-3 pt-2">
          {page > 1 ? <Button variant="outline" className="h-11" render={<Link href={page === 2 ? "/feed" : `/feed?page=${page - 1}`} />}>Newer posts</Button> : <span />}
          <span className="text-xs text-muted-foreground">Page {page}</span>
          {allPosts.length > PAGE_SIZE ? <Button variant="outline" className="h-11" render={<Link href={`/feed?page=${page + 1}`} />}>Older posts</Button> : <span />}
        </nav>
      )}
    </div>
  );
}

function PostListSkeleton() {
  return (
    <div className="mt-6 space-y-4">
      <p role="status" className="sr-only">
        Loading posts
      </p>
      <Skeleton className="h-48 w-full rounded-xl" aria-hidden="true" />
      <Skeleton className="h-48 w-full rounded-xl" aria-hidden="true" />
      <Skeleton className="h-48 w-full rounded-xl" aria-hidden="true" />
    </div>
  );
}
