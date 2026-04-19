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
    <Link href={`/gatherings/${gathering.id}`}>
      <Card className="border-border bg-card transition-colors hover:bg-secondary/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Date badge */}
            <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-md border border-gold/20 bg-gold/5 text-gold">
              <span className="text-xs font-medium leading-none">
                {format(new Date(gathering.startsAt), "MMM")}
              </span>
              <span className="text-xl font-bold leading-none">
                {format(new Date(gathering.startsAt), "d")}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-foreground truncate">
                  {gathering.title}
                </h3>
                {myRsvp && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      myRsvp.status === "attending"
                        ? "border-emerald-500/30 text-emerald-400"
                        : myRsvp.status === "maybe"
                          ? "border-amber-500/30 text-amber-400"
                          : "border-border text-muted-foreground"
                    }`}
                  >
                    {myRsvp.status === "attending"
                      ? "Going"
                      : myRsvp.status === "maybe"
                        ? "Maybe"
                        : "Not going"}
                  </Badge>
                )}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(gathering.startsAt), "EEE, h:mm a")}
                </span>
                {gathering.location && (
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="h-3 w-3" />
                    {gathering.location}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {attending.length} attending
                </span>
              </div>

              {gathering.description && (
                <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                  {gathering.description}
                </p>
              )}

              {/* Attending avatars */}
              {attending.length > 0 && (
                <div className="mt-3 flex -space-x-2">
                  {attending.slice(0, 8).map((rsvp) => (
                    <Avatar key={rsvp.id} className="h-6 w-6 border-2 border-card">
                      <AvatarImage src={rsvp.member.avatarUrl ?? undefined} />
                      <AvatarFallback className="bg-gold/10 text-[10px] text-gold">
                        {rsvp.member.displayName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {attending.length > 8 && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-secondary text-[10px] text-muted-foreground">
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
