import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Hash, Megaphone, Lock } from "lucide-react";
import type { Channel } from "@/types";

interface ChannelListProps {
  channels: Channel[];
}

const typeIcons = {
  general: Hash,
  announcement: Megaphone,
  private: Lock,
};

export function ChannelList({ channels }: ChannelListProps) {
  return (
    <div className="space-y-2">
      {channels.map((channel) => {
        const Icon = typeIcons[channel.type];
        return (
          <Link key={channel.id} href={`/council/${channel.id}`}>
            <Card className="border-border bg-card transition-colors hover:bg-secondary/30">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-secondary/30">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {channel.name}
                    </span>
                    <Badge
                      variant="outline"
                      className="border-border text-[10px] capitalize text-muted-foreground"
                    >
                      {channel.type}
                    </Badge>
                  </div>
                  {channel.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground truncate">
                      {channel.description}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
