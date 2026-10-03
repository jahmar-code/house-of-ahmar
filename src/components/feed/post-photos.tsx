"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/** Thumbnails reserve space; opening one shows the whole family photo. */
export function PostPhotos({ urls, authorName }: { urls: string[]; authorName: string }) {
  const [active, setActive] = useState<number | null>(null);
  const photoLabel = (index: number) => `Photo ${index + 1} of ${urls.length} shared by ${authorName}`;
  const move = (direction: number) => setActive((index) => index === null ? null : (index + direction + urls.length) % urls.length);

  return (
    <>
      <div className={`mt-3 grid gap-2 ${urls.length > 1 ? "grid-cols-2" : ""}`}>
        {urls.map((url, index) => (
          <button
            key={`${url}-${index}`}
            type="button"
            onClick={() => setActive(index)}
            aria-label={`Open ${photoLabel(index).toLowerCase()}`}
            className={`group relative w-full overflow-hidden rounded-lg border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${urls.length === 1 ? "aspect-[4/3]" : "aspect-square"}`}
          >
            <Image src={url} alt={photoLabel(index)} fill unoptimized sizes={urls.length === 1 ? "(max-width: 768px) 100vw, 640px" : "(max-width: 768px) 50vw, 320px"} className="object-cover" />
            <span aria-hidden="true" className="absolute bottom-2 right-2 rounded-md bg-background/80 p-2 text-foreground"><Expand className="size-4" /></span>
          </button>
        ))}
      </div>
      <Dialog open={active !== null} onOpenChange={(open) => { if (!open) setActive(null); }}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto p-4 [&_[data-slot=dialog-close]]:size-11 sm:max-w-4xl" onKeyDown={(event) => {
          if (urls.length < 2) return;
          if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
          if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
        }}>
          <DialogTitle className="pr-8 text-sm">Photos from {authorName}</DialogTitle>
          <DialogDescription className="sr-only">Use the previous and next buttons or arrow keys to browse. Escape closes the photo.</DialogDescription>
          {active !== null && (
            <>
              <div className="relative h-[60dvh] min-h-40 w-full">
                <Image src={urls[active]} alt={photoLabel(active)} fill unoptimized sizes="100vw" className="object-contain" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Button variant="outline" className="h-11" disabled={urls.length < 2} onClick={() => move(-1)} aria-label="Previous photo"><ChevronLeft className="size-4" /><span className="hidden sm:inline">Previous</span></Button>
                <p role="status" className="text-sm text-muted-foreground">{active + 1} of {urls.length}</p>
                <Button variant="outline" className="h-11" disabled={urls.length < 2} onClick={() => move(1)} aria-label="Next photo"><span className="hidden sm:inline">Next</span><ChevronRight className="size-4" /></Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
