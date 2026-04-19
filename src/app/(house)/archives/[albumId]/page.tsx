import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { albums } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getAuthContext } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { UploadPhotoDialog } from "@/components/archives/upload-photo-dialog";
import { PhotoLightbox } from "@/components/archives/photo-lightbox";
import { Image as ImageIcon } from "lucide-react";

export default async function AlbumPage({
  params,
}: {
  params: Promise<{ albumId: string }>;
}) {
  const { albumId } = await params;
  const ctx = await getAuthContext();

  const album = await db.query.albums.findFirst({
    where: eq(albums.id, albumId),
    with: {
      creator: true,
      photos: {
        orderBy: (photos, { asc }) => [asc(photos.sortOrder)],
        with: { uploader: true },
      },
    },
  });
  if (!album) notFound();

  const lightboxPhotos = album.photos.map((photo) => ({
    id: photo.id,
    url: photo.url,
    thumbnailUrl: photo.thumbnailUrl,
    caption: photo.caption,
    uploaderName: photo.uploader.displayName,
  }));

  return (
    <div>
      <PageHeader
        title={album.title}
        description={album.description ?? `By ${album.creator.displayName}`}
      >
        {ctx && ctx.role !== "guest" && (
          <UploadPhotoDialog albumId={album.id} memberId={ctx.memberId} />
        )}
      </PageHeader>

      {album.photos.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="No photos yet"
          description="This album is waiting for memories."
        />
      ) : (
        <PhotoLightbox photos={lightboxPhotos} />
      )}
    </div>
  );
}
