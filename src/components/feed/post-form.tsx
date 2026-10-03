"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { createPost } from "@/app/actions/feed";
import { uploadFile, storagePath, IMAGE_MIME_TYPES } from "@/lib/supabase/storage";
import { MILESTONE_OPTIONS } from "./milestone-meta";
import { toast } from "sonner";
import { Send, ImagePlus, Megaphone, Scroll, Sparkles, X } from "lucide-react";
import type { HoaRole } from "@/lib/constants";
import { HydratedFieldset } from "@/components/shared/hydrated-fieldset";

interface PostFormProps {
  memberId: string;
  role: HoaRole;
}

type Mode = "text" | "announcement";

/** A picked photo plus the object URL rendering its thumbnail. */
interface PickedPhoto {
  /** Monotonic, always-unique — the React key. */
  id: string;
  /** name+mtime+size, used only to spot a re-pick of the same photo. */
  fingerprint: string;
  file: File;
  url: string;
}

const MAX_PHOTOS = 10;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8 MB — a phone photo, not a raw export
// One source of truth with the uploader. The composer used to also accept
// image/heic + image/heif, which uploadFile then rejected — so an iPhone photo
// passed the picker and failed at upload with a confusing message. HEIC is
// deliberately excluded because browsers cannot render it (see storage.ts).
const ALLOWED_TYPES: readonly string[] = IMAGE_MIME_TYPES;

export function PostForm({ memberId, role }: PostFormProps) {
  const [content, setContent] = useState("");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [mode, setMode] = useState<Mode>("text");
  const [milestone, setMilestone] = useState<string | null>(null);
  const [showMilestones, setShowMilestones] = useState(false);
  const [fileError, setFileError] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<PickedPhoto[]>([]);
  // Monotonic, so two picks of the same file never share a key.
  const photoIdRef = useRef(0);
  const router = useRouter();

  const isElder = role === "elder";
  const selectedMilestone = MILESTONE_OPTIONS.find((m) => m.key === milestone);

  // Keep a live handle on the object URLs so the unmount cleanup can revoke
  // them — navigating away mid-compose used to leak every blob.
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => {
    return () => {
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, []);

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    // Reset the input straight away so the same file can be re-picked.
    if (fileRef.current) fileRef.current.value = "";
    if (selected.length === 0) return;

    const problems: string[] = [];
    const accepted: PickedPhoto[] = [];

    for (const file of selected) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        problems.push(`${file.name} isn't a photo we can post.`);
        continue;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        problems.push(`${file.name} is larger than 8 MB.`);
        continue;
      }
      if (photos.length + accepted.length >= MAX_PHOTOS) {
        problems.push(`You can add up to ${MAX_PHOTOS} photos at a time.`);
        break;
      }
      // Identity by name+mtime+size collides when the SAME photo is picked
      // twice — duplicate React keys, and removing one revoked the other's
      // blob URL. Skip the true duplicate, and key on a counter regardless.
      const fingerprint = `${file.name}-${file.lastModified}-${file.size}`;
      const alreadyPicked =
        photos.some((p) => p.fingerprint === fingerprint) ||
        accepted.some((p) => p.fingerprint === fingerprint);
      if (alreadyPicked) {
        problems.push(`${file.name} is already attached.`);
        continue;
      }

      photoIdRef.current += 1;
      accepted.push({
        id: `photo-${photoIdRef.current}`,
        fingerprint,
        file,
        url: URL.createObjectURL(file),
      });
    }

    setFileError(problems[0] ?? "");
    if (accepted.length > 0) setPhotos((prev) => [...prev, ...accepted]);
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((p) => p.id !== id);
    });
    setFileError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const trimmed = content.trim();
    if (!trimmed && photos.length === 0) return;

    setLoading(true);

    try {
      // Upload files first
      const mediaUrls: string[] = [];
      for (const photo of photos) {
        const path = storagePath(memberId, photo.file.name);
        // Pass the composer's own ceiling — uploadFile otherwise defaults to the
        // 5 MB avatar limit and would reject a photo the picker just accepted.
        const result = await uploadFile("feed-media", path, photo.file, {
          allowedTypes: ALLOWED_TYPES,
          maxBytes: MAX_PHOTO_BYTES,
        });
        if (!result.success) {
          toast.error(`Couldn't upload ${photo.file.name}: ${result.error}`);
          setLoading(false);
          return;
        }
        mediaUrls.push(result.url);
      }

      const formData = new FormData();
      // A photo-only post carries no text — it is the photo.
      if (trimmed) formData.set("content", trimmed);
      // Type precedence: explicit announcement > photo (if media) > text
      const type =
        mode === "announcement" && isElder
          ? "announcement"
          : mediaUrls.length > 0
            ? "photo"
            : "text";
      formData.set("type", type);
      if (mediaUrls.length > 0) {
        formData.set("mediaUrls", JSON.stringify(mediaUrls));
      }
      if (milestone) formData.set("milestoneKind", milestone);

      const result = await createPost(formData);
      if (result.success) {
        setContent("");
        photos.forEach((p) => URL.revokeObjectURL(p.url));
        setPhotos([]);
        setMode("text");
        setMilestone(null);
        setShowMilestones(false);
        setFileError("");
        toast.success(
          mode === "announcement" && isElder
            ? "Announcement posted"
            : "Posted to The Wall"
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("That didn't post. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card
      className={
        mode === "announcement" && isElder
          ? "border-primary/20 ring-1 ring-primary/30"
          : ""
      }
    >
      <CardContent className="p-4 sm:p-5">
        <form onSubmit={handleSubmit} className="space-y-3">
          <HydratedFieldset aria-label="Write a family post" className="space-y-3">
          {isElder && (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => setMode("text")}
                aria-pressed={mode === "text"}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                  mode === "text"
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                }`}
              >
                <Scroll className="h-3.5 w-3.5" />
                Post
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => setMode("announcement")}
                aria-pressed={mode === "announcement"}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                  mode === "announcement"
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                }`}
              >
                <Megaphone className="h-3.5 w-3.5" />
                Announcement
              </button>
            </div>
          )}

          <label htmlFor="post-content" className="sr-only">
            {mode === "announcement" && isElder
              ? "Write an announcement"
              : "Write on The Wall"}
          </label>
          <Textarea
            id="post-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              mode === "announcement"
                ? "Share an announcement with the family..."
                : "Write on The Wall..."
            }
            rows={3}
            maxLength={5000}
            disabled={loading}
            className="resize-none bg-muted/40 text-base sm:text-sm"
          />

          {/* Milestone — opt-in, so the composer stays calm by default */}
          <div className="space-y-2">
            {selectedMilestone ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3.5 text-xs font-medium text-foreground">
                  <selectedMilestone.Icon className="h-3.5 w-3.5 text-primary" />
                  {selectedMilestone.label}
                </span>
                <Button
                  type="button"
                disabled={loading}
                  variant="ghost"
                  size="icon"
                  className="size-11 text-muted-foreground hover:text-foreground"
                  onClick={() => setMilestone(null)}
                  aria-label={`Remove the ${selectedMilestone.label} milestone`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={() => setShowMilestones((v) => !v)}
                aria-expanded={showMilestones}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border px-3.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Mark a milestone
              </button>
            )}

            {showMilestones && !selectedMilestone && (
              <div className="flex flex-wrap gap-2">
                {MILESTONE_OPTIONS.map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    type="button"
                disabled={loading}
                    onClick={() => {
                      setMilestone(key);
                      setShowMilestones(false);
                    }}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border px-3.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Image previews */}
          {photos.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {photos.map((photo) => (
                <div key={photo.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- blob: URLs can't go through the image optimizer */}
                  <img
                    src={photo.url}
                    alt=""
                    className="h-24 w-24 rounded-lg border border-border object-cover"
                  />
                  <button
                    type="button"
                disabled={loading}
                    onClick={() => removePhoto(photo.id)}
                    aria-label={`Remove ${photo.file.name}`}
                    className="absolute -right-2.5 -top-2.5 flex size-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Always rendered so an error never pushes the composer around */}
          <p
            role="alert"
            className="min-h-4 text-xs text-foreground/80"
          >
            {fileError}
          </p>

          <div className="flex items-center justify-between">
            <div>
              <input
                ref={fileRef}
                type="file"
                accept={ALLOWED_TYPES.join(",")}
                multiple
                onChange={handleFilesSelected}
                className="hidden"
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => fileRef.current?.click()}
                disabled={loading || photos.length >= MAX_PHOTOS}
                className="h-11 text-muted-foreground hover:text-foreground"
              >
                <ImagePlus className="mr-1.5 h-4 w-4" />
                Photo
              </Button>
            </div>
            <Button
              type="submit"
              disabled={loading || (!content.trim() && photos.length === 0)}
              className="h-11 min-w-[6.5rem]"
            >
              <Send className="mr-2 h-4 w-4" />
              {loading
                ? "Posting..."
                : mode === "announcement" && isElder
                  ? "Announce"
                  : "Post"}
            </Button>
          </div>
          </HydratedFieldset>
        </form>
      </CardContent>
    </Card>
  );
}
