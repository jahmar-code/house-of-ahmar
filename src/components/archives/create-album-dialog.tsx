"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Plus } from "lucide-react";
import { createAlbum } from "@/app/actions/archives";
import { toast } from "sonner";

export function CreateAlbumDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await createAlbum(formData);
    if (result.success && result.data) {
      toast.success("Album created");
      setOpen(false);
      router.push(`/archives/${result.data.id}`);
    } else if (!result.success) {
      toast.error(result.error);
    }
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="mr-2 h-4 w-4" />
        New Album
      </DialogTrigger>
      <DialogContent className="border-border bg-card">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">
            Create Album
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              name="title"
              placeholder="Summer 2024, Eid Family Day..."
              required
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="What's in this album?"
              rows={3}
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
              {loading ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
