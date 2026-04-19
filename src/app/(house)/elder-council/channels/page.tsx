import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { channels } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Hash, Megaphone, Lock } from "lucide-react";
import { CreateChannelForm } from "./create-channel-form";

const typeIcons = {
  general: Hash,
  announcement: Megaphone,
  private: Lock,
};

export default async function ManageChannelsPage() {
  try {
    await requireRole("elder");
  } catch {
    redirect("/dashboard");
  }

  const allChannels = await db.query.channels.findMany({
    orderBy: asc(channels.sortOrder),
  });

  return (
    <div>
      <PageHeader
        title="Council Chambers"
        description="Create and manage chambers where the family gathers."
      />

      <CreateChannelForm />

      <div className="mt-6 space-y-2">
        {allChannels.map((channel) => {
          const Icon = typeIcons[channel.type];
          return (
            <Card key={channel.id} className="border-border bg-card">
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
                    {channel.isArchived && (
                      <Badge
                        variant="outline"
                        className="text-[10px] text-destructive border-destructive/30"
                      >
                        Archived
                      </Badge>
                    )}
                  </div>
                  {channel.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground truncate">
                      {channel.description}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
