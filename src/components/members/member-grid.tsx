import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PRESENCE_TIMEOUT_MS } from "@/lib/constants";
import type { Member } from "@/types";

interface MemberGridProps {
  members: Member[];
}

function isOnline(member: Member): boolean {
  if (!member.lastSeenAt) return false;
  return (
    new Date().getTime() - new Date(member.lastSeenAt).getTime() <
    PRESENCE_TIMEOUT_MS
  );
}

export function MemberGrid({ members }: MemberGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {members.map((member) => {
        const online = isOnline(member);
        return (
          <Link
            key={member.id}
            href={`/members/${member.id}`}
            className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Card className="h-full border-border bg-card transition-colors hover:border-foreground/20 hover:bg-secondary/20">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="relative shrink-0">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={member.avatarUrl ?? undefined} />
                    <AvatarFallback className="bg-secondary text-foreground">
                      {member.displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {online && (
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-emerald-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {member.displayName}
                  </p>
                  {member.bio && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {member.bio}
                    </p>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={`shrink-0 text-[10px] capitalize ${
                    member.role === "elder"
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {member.role}
                </Badge>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
