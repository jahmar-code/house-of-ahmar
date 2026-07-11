"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { createPost } from "@/app/actions/feed";
import { uploadFile, storagePath } from "@/lib/supabase/storage";
import { toast } from "sonner";
import { Send, ImagePlus, Megaphone, Scroll, X } from "lucide-react";
import type { HoaRole } from "@/lib/constants";

interface PostFormProps {
  memberId: string;
  role: HoaRole;
}

type Mode = "text" | "announcement";

export function PostForm({ memberId, role }: PostFormProps) {
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("text");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isElder = role === "elder";

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;

    const combined = [...files, ...selected].slice(0, 10);
    setFiles(combined);
    setPreviews(combined.map((f) => URL.createObjectURL(f)));

    // Reset input so the same file can be re-selected
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeFile(index: number) {
    URL.revokeObjectURL(previews[index]);
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() && files.length === 0) return;

    setLoading(true);

    // Upload files first
    const mediaUrls: string[] = [];
    for (const file of files) {
      const path = storagePath(memberId, file.name);
      const result = await uploadFile("feed-media", path, file);
      if (!result.success) {
        toast.error(`Failed to upload ${file.name}: ${result.error}`);
        setLoading(false);
        return;
      }
      mediaUrls.push(result.url);
    }

    const formData = new FormData();
    formData.set("content", content || " ");
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

    const result = await createPost(formData);
    if (result.success) {
      setContent("");
      setFiles([]);
      previews.forEach(URL.revokeObjectURL);
      setPreviews([]);
      setMode("text");
      toast.success(
        mode === "announcement" ? "Announcement posted" : "Posted to The Wall"
      );
    } else {
      toast.error(result.error);
    }
    setLoading(false);
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
          {isElder && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("text")}
                aria-pressed={mode === "text"}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
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
                onClick={() => setMode("announcement")}
                aria-pressed={mode === "announcement"}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
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

          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              mode === "announcement"
                ? "Share an announcement with the family..."
                : "Write on The Wall..."
            }
            rows={3}
            className="resize-none bg-muted/40"
          />

          {/* Image previews */}
          {previews.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {previews.map((src, i) => (
                <div key={i} className="relative">
                  <img
                    src={src}
                    alt=""
                    className="h-20 w-20 rounded-lg border border-border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    aria-label="Remove image"
                    className="absolute -right-2 -top-2 rounded-full border border-border bg-background p-1 text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFilesSelected}
                className="hidden"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileRef.current?.click()}
                className="text-muted-foreground hover:text-foreground"
              >
                <ImagePlus className="mr-1.5 h-4 w-4" />
                Photo
              </Button>
            </div>
            <Button
              type="submit"
              disabled={loading || (!content.trim() && files.length === 0)}
              className="min-w-[6.5rem]"
            >
              <Send className="mr-2 h-4 w-4" />
              {loading
                ? "Posting..."
                : mode === "announcement" && isElder
                  ? "Announce"
                  : "Post"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
