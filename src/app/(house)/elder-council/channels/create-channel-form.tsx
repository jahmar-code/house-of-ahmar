"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { createChannel } from "@/app/actions/council";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export function CreateChannelForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const result = await createChannel(formData);
    if (result.success) {
      toast.success("Chamber created");
      form.reset();
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  }

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs">
                Chamber Name
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="Kitchen Talk, Recipes..."
                required
                className="h-10 bg-muted/40 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="type" className="text-xs">
                Type
              </Label>
              <select
                id="type"
                name="type"
                defaultValue="general"
                className="h-10 rounded-lg border border-input bg-muted/40 px-3 text-sm text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <option value="general">General</option>
                <option value="announcement">Announcement</option>
                <option value="private">Private</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs">
              Description
            </Label>
            <Textarea
              id="description"
              name="description"
              rows={2}
              placeholder="What's this chamber for?"
              className="resize-none bg-muted/40 text-sm"
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {loading ? "Creating..." : "Create Chamber"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
