"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  archiveChannel,
  renameChannel,
  unarchiveChannel,
} from "@/app/actions/council";
import { toast } from "sonner";
import { Archive, MoreVertical, Pencil, RotateCcw } from "lucide-react";

interface ChannelActionsProps {
  channelId: string;
  name: string;
  description: string | null;
  isArchived: boolean;
}

export function ChannelActions({
  channelId,
  name,
  description,
  isArchived,
}: ChannelActionsProps) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleRename(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const result = await renameChannel(channelId, new FormData(e.currentTarget));
      if (result.success) {
        toast.success("Chamber renamed");
        setRenaming(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("That didn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    const result = await archiveChannel(channelId);
    if (result.success) {
      toast.success("Chamber closed");
      router.refresh();
    } else toast.error(result.error);
    return result.success;
  }

  async function handleReopen() {
    setPending(true);
    try {
      const result = await unarchiveChannel(channelId);
      if (result.success) {
        toast.success("Chamber reopened");
        router.refresh();
      } else toast.error(result.error);
    } catch {
      toast.error("That didn't save. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Actions for ${name}`}
              className="size-11 shrink-0"
            />
          }
        >
          <MoreVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setRenaming(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {isArchived ? (
            <DropdownMenuItem onClick={handleReopen} disabled={pending}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reopen
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => setConfirmingArchive(true)}>
              <Archive className="mr-2 h-4 w-4" />
              Close chamber
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent>
          <form onSubmit={handleRename}>
            <DialogHeader>
              <DialogTitle>Rename this chamber</DialogTitle>
              <DialogDescription>
                Everything said in it stays exactly where it is.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor={`name-${channelId}`}>Name</Label>
                <Input
                  id={`name-${channelId}`}
                  name="name"
                  defaultValue={name}
                  required
                  className="h-11 text-base sm:text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`description-${channelId}`}>Description</Label>
                <Textarea
                  id={`description-${channelId}`}
                  name="description"
                  defaultValue={description ?? ""}
                  rows={2}
                  className="resize-none text-base sm:text-sm"
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmingArchive}
        onOpenChange={setConfirmingArchive}
        title={`Close ${name}?`}
        description="It drops out of the Council and stops taking new messages. Everything already said is kept, and you can reopen it any time."
        confirmLabel="Close it"
        cancelLabel="Leave it open"
        onConfirm={handleArchive}
      />
    </>
  );
}
