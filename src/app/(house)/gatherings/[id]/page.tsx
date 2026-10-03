import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { gatherings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requirePageAuth } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Archive, Ban, Calendar, MapPin } from "lucide-react";
import { RsvpButton } from "@/components/gatherings/rsvp-button";
import { GatheringActions } from "@/components/gatherings/gathering-actions";
import { GatheringDate } from "@/components/gatherings/gathering-date";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function GatheringDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // A stale or mistyped link is a 404, not a raw Postgres uuid cast error.
  if (!UUID_RE.test(id)) notFound();
  const ctx = await requirePageAuth();

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
    !gathering.archivedAt && (ctx.memberId === gathering.createdBy || ctx.role === "elder");

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={gathering.title}>
        {/* Still shown when cancelled — that's where "It's back on" lives. */}
        {canManage && (
          <GatheringActions
            gatheringId={gathering.id}
            title={gathering.title}
            isCancelled={gathering.isCancelled ?? false}
          />
        )}
      </PageHeader>

      {gathering.archivedAt && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          <Archive className="h-4 w-4 shrink-0" aria-hidden="true" />
          This gathering is archived. Its details and responses are kept here.
        </div>
      )}

      {gathering.isCancelled && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-foreground">
          <Ban className="h-4 w-4 shrink-0 text-destructive" />
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
                <GatheringDate startsAt={gathering.startsAt} endsAt={gathering.endsAt} isAllDay={gathering.isAllDay} style="long" />
              </span>
            </div>
            {gathering.location && (
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="break-words text-foreground">{gathering.location}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm">
              <Avatar size="sm" className="h-5 w-5">
                <AvatarImage src={gathering.creator.avatarUrl ?? undefined} alt="" />
                <AvatarFallback className="text-[10px] font-medium">
                  {gathering.creator.displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-muted-foreground">
                Organized by {gathering.creator.displayName}
              </span>
            </div>
          </div>

          {gathering.description && (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
              {gathering.description}
            </p>
          )}

          {/* RSVP — a cancelled gathering takes no answers */}
          {!gathering.isCancelled && !gathering.archivedAt && (
            <div className="border-t border-border pt-5">
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Can you make it?
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
                      <AvatarImage src={rsvp.member.avatarUrl ?? undefined} alt="" />
                      <AvatarFallback className="text-[10px] font-medium">
                        {rsvp.member.displayName.charAt(0).toUpperCase()}
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
                        <AvatarImage src={rsvp.member.avatarUrl ?? undefined} alt="" />
                        <AvatarFallback className="text-[10px] font-medium">
                          {rsvp.member.displayName.charAt(0).toUpperCase()}
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
