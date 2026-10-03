"use client";

import { useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Short, names the thing: "Remove this post?" */
  title: string;
  /** Says what actually happens, in plain family-facing language. */
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive. Defaults to true. */
  destructive?: boolean;
  onConfirm: () => boolean | void | Promise<boolean | void>;
}

/**
 * The single confirmation surface for every irreversible action in the House.
 *
 * Nothing that removes a person, a post, a message, or a gathering should be
 * one tap away — this is the shared answer to that rule, so the wording and the
 * focus/escape behaviour are identical everywhere (Base UI Dialog handles the
 * focus trap and restore).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = true,
  onConfirm,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const completed = await onConfirm();
      if (completed === false) {
        setError("That didn't complete. Please try again.");
        return;
      }
      onOpenChange(false);
    } catch {
      // Keep the dialog open on failure. Closing it would look like the action
      // succeeded, which for a delete is the worst possible lie to tell.
      setError("That didn't complete. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      // Ignore backdrop clicks and Escape while the action is in flight —
      // dismissing mid-request leaves the member with no idea whether the
      // thing they confirmed actually happened.
      onOpenChange={(next) => {
        if (pending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <DialogClose
            render={<Button className="h-11" variant="outline" disabled={pending} />}
          >
            {cancelLabel}
          </DialogClose>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={pending}
            className="h-11"
          >
            {pending ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
