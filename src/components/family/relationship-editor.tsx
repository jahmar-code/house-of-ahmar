"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { addRelationship } from "@/app/actions/family";
import { toast } from "sonner";
import { GitBranch, Plus } from "lucide-react";
import type { Member } from "@/types";

interface RelationshipEditorProps {
  members: Member[];
  /** Pre-fill the child select (optional). */
  defaultChildId?: string | null;
  /** Pre-fill the parent select (optional). */
  defaultParentId?: string | null;
  triggerLabel?: string;
}

export function RelationshipEditor({
  members,
  defaultChildId,
  defaultParentId,
  triggerLabel = "Add relationship",
}: RelationshipEditorProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const sorted = useMemo(
    () =>
      [...members]
        .filter((m) => m.isActive)
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [members]
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await addRelationship(formData);
      if (result.success) {
        toast.success("Relationship added");
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <GitBranch className="mr-2 h-4 w-4" />
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="border-border bg-card">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">
            Add a parent → child link
          </DialogTitle>
          <DialogDescription>
            Pick the parent first, then the child. A child can have more than
            one parent — add a second link to record the other parent.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="parentId">
              Parent <span className="text-destructive">*</span>
            </Label>
            <select
              id="parentId"
              name="parentId"
              required
              defaultValue={defaultParentId ?? ""}
              className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              <option value="" disabled>
                Select parent…
              </option>
              {sorted.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="childId">
              Child <span className="text-destructive">*</span>
            </Label>
            <select
              id="childId"
              name="childId"
              required
              defaultValue={defaultChildId ?? ""}
              className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              <option value="" disabled>
                Select child…
              </option>
              {sorted.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              <Plus className="mr-2 h-4 w-4" />
              {pending ? "Adding…" : "Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
