import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Calendar, MapPin, Users } from "lucide-react";
import type { Gathering, Member, Rsvp } from "@/types";

interface GatheringCardProps {
  gathering: Gathering & {
    creator: Member;
    rsvps: (Rsvp & { member: Member })[];
  };
  currentMemberId: string;
}

export function GatheringCard({ gathering, currentMemberId }: GatheringCardProps) {
  const attending = gathering.rsvps.filter((r) => r.status === "attending");
  const myRsvp = gathering.rsvps.find((r) => r.memberId === currentMemberId);

  return (
    <Link
      href={`/gatherings/${gathering.id}`}
      className="group block rounded-xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <Card className="p-0 transition-colors group-hover:border-foreground/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Date block */}
            <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-muted">
              <span className="text-[11px] font-medium uppercase leading-none tracking-wide text-muted-foreground">
                {format(new Date(gathering.startsAt), "MMM")}
              </span>
              <span className="mt-1 text-xl font-bold leading-none text-foreground tabular-nums">
                {format(new Date(gathering.startsAt), "d")}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate font-semibold text-foreground">
                  {gathering.title}
                </h3>
                {myRsvp && (
                  <Badge
                    variant="outline"
                    className={
                      myRsvp.status === "attending"
                        ? "border-emerald-500/30 text-emerald-400"
                        : myRsvp.status === "maybe"
                          ? "border-amber-500/30 text-amber-400"
                          : "border-border text-muted-foreground"
                    }
                  >
                    {myRsvp.status === "attending"
                      ? "Going"
                      : myRsvp.status === "maybe"
                        ? "Maybe"
                        : "Not going"}
                  </Badge>
                )}
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(new Date(gathering.startsAt), "EEE, h:mm a")}
                </span>
                {gathering.location && (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{gathering.location}</span>
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {attending.length} attending
                </span>
              </div>

              {gathering.description && (
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {gathering.description}
                </p>
              )}

              {/* Attending avatars */}
              {attending.length > 0 && (
                <div className="mt-3 flex -space-x-2">
                  {attending.slice(0, 8).map((rsvp) => (
                    <Avatar
                      key={rsvp.id}
                      size="sm"
                      className="ring-2 ring-card after:hidden"
                    >
                      <AvatarImage src={rsvp.member.avatarUrl ?? undefined} />
                      <AvatarFallback className="text-[10px] font-medium">
                        {rsvp.member.displayName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {attending.length > 8 && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-muted-foreground ring-2 ring-card">
                      +{attending.length - 8}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
