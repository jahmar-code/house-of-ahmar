import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Calendar, MapPin } from "lucide-react";
import { GatheringDate } from "@/components/gatherings/gathering-date";
import type { Gathering, Member } from "@/types";

interface UpcomingGatheringsProps {
  gatherings: (Gathering & { creator: Member })[];
  /** Guests can RSVP but not plan; never offer them a page that turns them away. */
  canPlan: boolean;
}

export function UpcomingGatherings({ gatherings, canPlan }: UpcomingGatheringsProps) {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold tracking-tight text-foreground">
            Upcoming Gatherings
          </CardTitle>
          <Link
            href="/gatherings"
            className="rounded-lg px-1 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            View all
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {gatherings.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Nothing on the calendar.
            </p>
            {canPlan && (
              <Link
                href="/gatherings/new"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                Plan a gathering
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {gatherings.map((gathering) => (
              <Link
                key={gathering.id}
                href={`/gatherings/${gathering.id}`}
                className="flex items-start gap-3 rounded-lg border border-border bg-secondary/20 p-3 transition-colors hover:border-foreground/20 hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-muted text-foreground">
                  <span className="text-[10px] font-medium uppercase leading-none tracking-wide">
                    <GatheringDate startsAt={gathering.startsAt} isAllDay={gathering.isAllDay} part="month" />
                  </span>
                  <span className="mt-0.5 text-sm font-bold leading-none">
                    <GatheringDate startsAt={gathering.startsAt} isAllDay={gathering.isAllDay} part="day" />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {gathering.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" aria-hidden="true" />
                      <GatheringDate startsAt={gathering.startsAt} endsAt={gathering.endsAt} isAllDay={gathering.isAllDay} style="short" />
                    </span>
                    {gathering.location && (
                      <span className="flex min-w-0 items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{gathering.location}</span>
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
