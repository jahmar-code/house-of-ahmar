"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export interface LightboxPhoto {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  caption: string | null;
  uploaderName: string;
}

interface PhotoLightboxProps {
  photos: LightboxPhoto[];
}

export function PhotoLightbox({ photos }: PhotoLightboxProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const close = useCallback(() => setActiveIndex(null), []);
  const prev = useCallback(
    () =>
      setActiveIndex((i) =>
        i === null ? null : (i - 1 + photos.length) % photos.length
      ),
    [photos.length]
  );
  const next = useCallback(
    () => setActiveIndex((i) => (i === null ? null : (i + 1) % photos.length)),
    [photos.length]
  );

  useEffect(() => {
    if (activeIndex === null) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    document.addEventListener("keydown", handleKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [activeIndex, close, prev, next]);

  const active = activeIndex !== null ? photos[activeIndex] : null;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((photo, i) => (
          <Card
            key={photo.id}
            className="group cursor-zoom-in border-border bg-card overflow-hidden py-0 transition-colors hover:border-foreground/20"
          >
            <button
              type="button"
              onClick={() => setActiveIndex(i)}
              className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
              aria-label={photo.caption ?? "View photo"}
            >
              <div className="relative aspect-square">
                <img
                  src={photo.thumbnailUrl ?? photo.url}
                  alt={photo.caption ?? "Family photo"}
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
                {photo.caption && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                    <p className="text-xs text-white">{photo.caption}</p>
                  </div>
                )}
              </div>
            </button>
          </Card>
        ))}
      </div>

      {active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            className="absolute right-4 top-4 rounded-full bg-black/40 p-2 text-white/80 outline-none transition-colors hover:bg-black/60 hover:text-white focus-visible:ring-2 focus-visible:ring-ring/70"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white/80 outline-none transition-colors hover:bg-black/60 hover:text-white focus-visible:ring-2 focus-visible:ring-ring/70"
                aria-label="Previous"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white/80 outline-none transition-colors hover:bg-black/60 hover:text-white focus-visible:ring-2 focus-visible:ring-ring/70"
                aria-label="Next"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          <div
            className="flex max-h-[90vh] max-w-[90vw] flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={active.url}
              alt={active.caption ?? "Family photo"}
              className="max-h-[80vh] max-w-full rounded-xl object-contain shadow-2xl"
            />
            <div className="text-center text-xs text-white/70">
              {active.caption && (
                <p className="text-sm text-white">{active.caption}</p>
              )}
              <p className="mt-1">
                Uploaded by {active.uploaderName}
                {photos.length > 1 && (
                  <span className="ml-2 text-white/50">
                    {(activeIndex ?? 0) + 1} / {photos.length}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
