import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MapPin } from "lucide-react";
import { format } from "date-fns";
import type { Gathering, Member } from "@/types";

interface UpcomingGatheringsProps {
  gatherings: (Gathering & { creator: Member })[];
}

export function UpcomingGatherings({ gatherings }: UpcomingGatheringsProps) {
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
          <p className="text-sm text-muted-foreground">
            No gatherings planned yet.
          </p>
        ) : (
          <div className="space-y-2.5">
            {gatherings.map((gathering) => (
              <Link
                key={gathering.id}
                href={`/gatherings/${gathering.id}`}
                className="flex items-start gap-3 rounded-lg border border-border bg-secondary/20 p-3 transition-colors hover:border-foreground/20 hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                  <span className="text-[10px] font-medium uppercase leading-none tracking-wide">
                    {format(new Date(gathering.startsAt), "MMM")}
                  </span>
                  <span className="mt-0.5 text-sm font-bold leading-none">
                    {format(new Date(gathering.startsAt), "d")}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {gathering.title}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(gathering.startsAt), "h:mm a")}
                    </span>
                    {gathering.location && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3" />
                        {gathering.location}
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
