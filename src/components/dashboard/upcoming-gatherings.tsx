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
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading text-lg">
            Upcoming Gatherings
          </CardTitle>
          <Link
            href="/gatherings"
            className="text-xs text-gold hover:text-gold/80"
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
          <div className="space-y-3">
            {gatherings.map((gathering) => (
              <Link
                key={gathering.id}
                href={`/gatherings/${gathering.id}`}
                className="flex items-start gap-3 rounded-md border border-border bg-secondary/20 p-3 transition-colors hover:bg-secondary/40"
              >
                <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-md border border-gold/20 bg-gold/5 text-gold">
                  <span className="text-xs font-medium leading-none">
                    {format(new Date(gathering.startsAt), "MMM")}
                  </span>
                  <span className="text-sm font-bold leading-none">
                    {format(new Date(gathering.startsAt), "d")}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground truncate">
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
