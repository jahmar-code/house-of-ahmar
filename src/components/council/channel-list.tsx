import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import {
  CHANNEL_ICONS,
  CHANNEL_ICON_CLASS,
  CHANNEL_LABELS,
} from "./channel-meta";
import type { Channel } from "@/types";

interface ChannelListProps {
  channels: Channel[];
}

export function ChannelList({ channels }: ChannelListProps) {
  return (
    <div className="space-y-3">
      {channels.map((channel) => {
        const Icon = CHANNEL_ICONS[channel.type];
        return (
          <Link
            key={channel.id}
            href={`/council/${channel.id}`}
            className="group block rounded-xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Card className="transition-colors group-hover:border-foreground/20">
              <CardContent className="flex items-center gap-3 px-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
                  <Icon
                    className={`h-5 w-5 ${CHANNEL_ICON_CLASS[channel.type]}`}
                    aria-hidden="true"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate font-medium text-foreground">
                      {channel.name}
                    </span>
                    <Badge
                      variant="outline"
                      className="shrink-0 text-[10px] text-muted-foreground"
                    >
                      {CHANNEL_LABELS[channel.type]}
                    </Badge>
                  </div>
                  {channel.description && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {channel.description}
                    </p>
                  )}
                </div>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
                  aria-hidden="true"
                />
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
