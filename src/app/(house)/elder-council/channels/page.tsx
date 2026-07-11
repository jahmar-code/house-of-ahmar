import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { channels } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Hash, Megaphone, Lock, MessageSquare } from "lucide-react";
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
        eyebrow="Elder Council"
        title="Council Chambers"
        description="Create and manage chambers where the family gathers."
      />

      <CreateChannelForm />

      {allChannels.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={MessageSquare}
            title="No chambers yet"
            description="Create a chamber above to open a space for the family to gather."
          />
        </div>
      ) : (
        <>
          <p className="mt-8 mb-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            {allChannels.length}{" "}
            {allChannels.length === 1 ? "chamber" : "chambers"}
          </p>
          <div className="space-y-2">
            {allChannels.map((channel) => {
              const Icon = typeIcons[channel.type];
              const isAnnouncement = channel.type === "announcement";
              return (
                <Card
                  key={channel.id}
                  className="border-border bg-card transition-colors hover:border-foreground/20"
                >
                  <CardContent className="flex items-center gap-3 p-4">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                        isAnnouncement
                          ? "border-primary/20 bg-primary/10"
                          : "border-border bg-muted"
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 ${
                          isAnnouncement
                            ? "text-primary"
                            : "text-muted-foreground"
                        }`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-foreground">
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
                            className="border-destructive/30 bg-destructive/10 text-[10px] text-destructive"
                          >
                            Archived
                          </Badge>
                        )}
                      </div>
                      {channel.description && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {channel.description}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
