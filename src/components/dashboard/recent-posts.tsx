import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import type { Post, Member } from "@/types";

interface RecentPostsProps {
  posts: (Post & { author: Member })[];
}

export function RecentPosts({ posts }: RecentPostsProps) {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold tracking-tight text-foreground">
            Recent on The Wall
          </CardTitle>
          <Link
            href="/feed"
            className="rounded-lg px-1 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            View all
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            The Wall is empty. Be the first to post.
          </p>
        ) : (
          <div className="space-y-2.5">
            {posts.map((post) => (
              <Link
                key={post.id}
                href="/feed"
                className="flex items-start gap-3 rounded-lg border border-border bg-secondary/20 p-3 transition-colors hover:border-foreground/20 hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={post.author.avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-secondary text-xs text-foreground">
                    {post.author.displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {post.author.displayName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(post.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
                    {post.content}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
