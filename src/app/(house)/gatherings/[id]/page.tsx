import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { gatherings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getAuthContext } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { Calendar, MapPin, User } from "lucide-react";
import { RsvpButton } from "@/components/gatherings/rsvp-button";
import { GatheringActions } from "@/components/gatherings/gathering-actions";

export default async function GatheringDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getAuthContext();

  const gathering = await db.query.gatherings.findFirst({
    where: eq(gatherings.id, id),
    with: {
      creator: true,
      rsvps: { with: { member: true } },
    },
  });
  if (!gathering) notFound();

  const myRsvp = gathering.rsvps.find((r) => r.memberId === ctx?.memberId);
  const attending = gathering.rsvps.filter((r) => r.status === "attending");
  const maybe = gathering.rsvps.filter((r) => r.status === "maybe");
  const canManage =
    ctx && (ctx.memberId === gathering.createdBy || ctx.role === "elder");

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={gathering.title}>
        {canManage && !gathering.isCancelled && (
          <GatheringActions gatheringId={gathering.id} />
        )}
      </PageHeader>

      {gathering.isCancelled && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          This gathering has been cancelled.
        </div>
      )}

      <Card className="border-border bg-card">
        <CardContent className="space-y-6 p-6">
          {/* Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-gold" />
              <span className="text-foreground">
                {format(new Date(gathering.startsAt), "EEEE, MMMM d, yyyy")}
                {" at "}
                {format(new Date(gathering.startsAt), "h:mm a")}
                {gathering.endsAt &&
                  ` — ${format(new Date(gathering.endsAt), "h:mm a")}`}
              </span>
            </div>
            {gathering.location && (
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-gold" />
                <span className="text-foreground">{gathering.location}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                Organized by {gathering.creator.displayName}
              </span>
            </div>
          </div>

          {gathering.description && (
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {gathering.description}
            </p>
          )}

          {/* RSVP */}
          {ctx?.role !== "guest" && (
            <div className="border-t border-border pt-4">
              <p className="mb-3 text-sm font-medium text-foreground">
                Your Response
              </p>
              <RsvpButton
                gatheringId={gathering.id}
                currentStatus={myRsvp?.status}
              />
            </div>
          )}

          {/* Attendees */}
          <div className="border-t border-border pt-4">
            <p className="mb-3 text-sm font-medium text-foreground">
              Attending ({attending.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {attending.map((rsvp) => (
                <div
                  key={rsvp.id}
                  className="flex items-center gap-2 rounded-md border border-border bg-secondary/30 px-3 py-1.5"
                >
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={rsvp.member.avatarUrl ?? undefined} />
                    <AvatarFallback className="bg-gold/10 text-[10px] text-gold">
                      {rsvp.member.displayName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-foreground">
                    {rsvp.member.displayName}
                  </span>
                </div>
              ))}
            </div>

            {maybe.length > 0 && (
              <>
                <p className="mb-3 mt-4 text-sm font-medium text-muted-foreground">
                  Maybe ({maybe.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {maybe.map((rsvp) => (
                    <div
                      key={rsvp.id}
                      className="flex items-center gap-2 rounded-md border border-border bg-secondary/20 px-3 py-1.5"
                    >
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={rsvp.member.avatarUrl ?? undefined} />
                        <AvatarFallback className="bg-gold/10 text-[10px] text-gold">
                          {rsvp.member.displayName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">
                        {rsvp.member.displayName}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
