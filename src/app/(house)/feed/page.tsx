import { Suspense } from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requirePageAuth } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { PostCard } from "@/components/feed/post-card";
import { PostForm } from "@/components/feed/post-form";
import { EmptyState } from "@/components/shared/empty-state";
import { PUBLIC_MEMBER_COLUMNS } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Scroll } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  // Cheap and React-cached — the composer needs it, and PostList reuses the
  // same resolved context for free.
  const ctx = await requirePageAuth();
  const query = await searchParams;
  const parsedPage = Number(query.page ?? 1);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 10000) : 1;

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
      <Suspense key={page} fallback={<PostListSkeleton />}>
        <PostList page={page} />
      </Suspense>
    </div>
  );
}

async function PostList({ page }: { page: number }) {
  const ctx = await requirePageAuth();

  const allPosts = await db.query.posts.findMany({
    where: eq(posts.isDeleted, false),
    orderBy: [desc(posts.isPinned), desc(posts.createdAt), desc(posts.id)],
    limit: 51,
    offset: (page - 1) * 50,
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
        allPosts.slice(0, 50).map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentMemberId={ctx?.memberId ?? ""}
            currentRole={ctx?.role ?? "guest"}
          />
        ))
      )}
      {(page > 1 || allPosts.length > 50) && (
        <nav aria-label="Wall pages" className="flex items-center justify-between gap-3 pt-2">
          {page > 1 ? <Button variant="outline" className="h-11" render={<Link href={page === 2 ? "/feed" : `/feed?page=${page - 1}`} />}>Newer posts</Button> : <span />}
          <span className="text-xs text-muted-foreground">Page {page}</span>
          {allPosts.length > 50 ? <Button variant="outline" className="h-11" render={<Link href={`/feed?page=${page + 1}`} />}>Older posts</Button> : <span />}
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
