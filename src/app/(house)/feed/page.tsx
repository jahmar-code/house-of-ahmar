import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getAuthContext } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { PostCard } from "@/components/feed/post-card";
import { PostForm } from "@/components/feed/post-form";
import { EmptyState } from "@/components/shared/empty-state";
import { Scroll } from "lucide-react";

export default async function FeedPage() {
  const ctx = await getAuthContext();

  const allPosts = await db.query.posts.findMany({
    where: eq(posts.isDeleted, false),
    orderBy: [desc(posts.isPinned), desc(posts.createdAt)],
    limit: 50,
    with: {
      author: true,
      comments: {
        where: (comments, { eq }) => eq(comments.isDeleted, false),
        with: { author: true },
        orderBy: (comments, { asc }) => [asc(comments.createdAt)],
      },
      reactions: true,
    },
  });

  return (
    <div>
      <PageHeader
        title="The Wall"
        description="Family updates and announcements."
      />

      {ctx && ctx.role !== "guest" && (
        <PostForm memberId={ctx.memberId} role={ctx.role} />
      )}

      <div className="mt-6 space-y-4">
        {allPosts.length === 0 ? (
          <EmptyState
            icon={Scroll}
            title="The Wall is empty"
            description="Be the first to write on The Wall."
          />
        ) : (
          allPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentMemberId={ctx?.memberId ?? ""}
              currentRole={ctx?.role ?? "guest"}
            />
          ))
        )}
      </div>
    </div>
  );
}
