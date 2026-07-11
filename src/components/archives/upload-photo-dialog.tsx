"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, ImageIcon, Link } from "lucide-react";
import { uploadPhoto } from "@/app/actions/archives";
import { uploadFile, storagePath } from "@/lib/supabase/storage";
import { toast } from "sonner";

interface UploadPhotoDialogProps {
  albumId: string;
  memberId: string;
}

type Mode = "file" | "url";

export function UploadPhotoDialog({ albumId, memberId }: UploadPhotoDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("file");
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
    } else {
      setPreview(null);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    let photoUrl: string;

    if (mode === "file") {
      const file = fileRef.current?.files?.[0];
      if (!file) {
        toast.error("Please select a file");
        setLoading(false);
        return;
      }

      const path = storagePath(memberId, file.name);
      const result = await uploadFile("archives", path, file);
      if (!result.success) {
        toast.error(result.error);
        setLoading(false);
        return;
      }
      photoUrl = result.url;
    } else {
      const urlValue = formData.get("url") as string;
      if (!urlValue) {
        toast.error("Please enter a URL");
        setLoading(false);
        return;
      }
      photoUrl = urlValue;
    }

    // Build form data for the server action
    const actionData = new FormData();
    actionData.set("url", photoUrl);
    const caption = formData.get("caption") as string;
    if (caption) actionData.set("caption", caption);

    const result = await uploadPhoto(albumId, actionData);
    if (result.success) {
      toast.success("Photo added");
      setOpen(false);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setPreview(null); }}>
      <DialogTrigger render={<Button size="sm" />}>
        <Upload className="mr-2 h-4 w-4" />
        Add Photo
      </DialogTrigger>
      <DialogContent className="border-border bg-card">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">
            Add Photo
          </DialogTitle>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === "file" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("file")}
          >
            <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
            Upload File
          </Button>
          <Button
            type="button"
            variant={mode === "url" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("url")}
          >
            <Link className="mr-1.5 h-3.5 w-3.5" />
            Paste URL
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "file" ? (
            <div className="space-y-2">
              <Label htmlFor="file">
                Photo <span className="text-destructive">*</span>
              </Label>
              <Input
                ref={fileRef}
                id="file"
                name="file"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="h-11 file:mr-3 file:text-foreground file:border-0 file:bg-transparent"
              />
              {preview && (
                <img
                  src={preview}
                  alt="Preview"
                  className="mt-2 max-h-40 rounded-lg border border-border object-cover"
                />
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="url">
                Photo URL <span className="text-destructive">*</span>
              </Label>
              <Input
                id="url"
                name="url"
                type="url"
                placeholder="https://..."
                className="h-11"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="caption">Caption</Label>
            <Textarea
              id="caption"
              name="caption"
              placeholder="A few words about this photo..."
              rows={2}
              className="resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Uploading..." : "Add Photo"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
