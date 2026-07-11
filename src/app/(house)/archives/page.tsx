import { db } from "@/lib/db";
import { albums } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getAuthContext } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { CreateAlbumDialog } from "@/components/archives/create-album-dialog";
import { Image as ImageIcon } from "lucide-react";
import Link from "next/link";

export default async function ArchivesPage() {
  const ctx = await getAuthContext();
  const allAlbums = await db.query.albums.findMany({
    where: eq(albums.isPrivate, false),
    orderBy: desc(albums.createdAt),
    with: {
      creator: true,
      photos: true,
    },
  });

  return (
    <div>
      <PageHeader
        title="The Archives"
        description="Family photos and memories."
      >
        {ctx?.role !== "guest" && <CreateAlbumDialog />}
      </PageHeader>

      {allAlbums.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="No memories yet"
          description="The Archives await your family's moments."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allAlbums.map((album) => (
            <Link
              key={album.id}
              href={`/archives/${album.id}`}
              className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <Card className="h-full gap-0 border-border bg-card py-0 overflow-hidden transition-colors hover:border-foreground/20">
                {/* Cover image or placeholder */}
                <div className="flex aspect-video items-center justify-center bg-muted">
                  {album.coverPhotoUrl ? (
                    <img
                      src={album.coverPhotoUrl}
                      alt={album.title}
                      className="h-full w-full object-cover transition-transform duration-200 group-hover/card:scale-105"
                    />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                  )}
                </div>
                <CardContent className="p-4">
                  <h3 className="truncate font-medium text-foreground">
                    {album.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {album.photos.length} photo{album.photos.length !== 1 ? "s" : ""}
                    {" · "}
                    by {album.creator.displayName}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
