import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { gatherings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getAuthContext } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { Ban, Calendar, MapPin } from "lucide-react";
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
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <Ban className="h-4 w-4 shrink-0" />
          This gathering has been cancelled.
        </div>
      )}

      <Card>
        <CardContent className="space-y-6 p-5 sm:p-6">
          {/* Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 shrink-0 text-primary" />
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
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-foreground">{gathering.location}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm">
              <Avatar size="sm" className="h-5 w-5">
                <AvatarImage src={gathering.creator.avatarUrl ?? undefined} />
                <AvatarFallback className="text-[10px] font-medium">
                  {gathering.creator.displayName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="text-muted-foreground">
                Organized by {gathering.creator.displayName}
              </span>
            </div>
          </div>

          {gathering.description && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {gathering.description}
            </p>
          )}

          {/* RSVP */}
          {ctx?.role !== "guest" && (
            <div className="border-t border-border pt-5">
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Your Response
              </p>
              <RsvpButton
                gatheringId={gathering.id}
                currentStatus={myRsvp?.status}
              />
            </div>
          )}

          {/* Attendees */}
          <div className="border-t border-border pt-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Attending
              <span className="ml-1.5 tabular-nums text-foreground/70">
                {attending.length}
              </span>
            </p>
            {attending.length === 0 ? (
              <p className="text-sm text-muted-foreground">No one yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {attending.map((rsvp) => (
                  <div
                    key={rsvp.id}
                    className="flex items-center gap-2 rounded-full border border-border bg-muted/40 py-1 pl-1 pr-3 transition-colors hover:border-foreground/20"
                  >
                    <Avatar size="sm" className="h-6 w-6">
                      <AvatarImage src={rsvp.member.avatarUrl ?? undefined} />
                      <AvatarFallback className="text-[10px] font-medium">
                        {rsvp.member.displayName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-foreground">
                      {rsvp.member.displayName}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {maybe.length > 0 && (
              <>
                <p className="mb-3 mt-5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Maybe
                  <span className="ml-1.5 tabular-nums text-foreground/70">
                    {maybe.length}
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {maybe.map((rsvp) => (
                    <div
                      key={rsvp.id}
                      className="flex items-center gap-2 rounded-full border border-border bg-muted/40 py-1 pl-1 pr-3 transition-colors hover:border-foreground/20"
                    >
                      <Avatar size="sm" className="h-6 w-6">
                        <AvatarImage src={rsvp.member.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-[10px] font-medium">
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
