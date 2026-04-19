"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { sendMessage } from "@/app/actions/council";
import { toast } from "sonner";
import { CornerDownRight, Send, X } from "lucide-react";
import type { ReplyTarget } from "./council-channel";

interface MessageInputProps {
  channelId: string;
  channelName: string;
  replyTarget?: ReplyTarget | null;
  onClearReply?: () => void;
}

export function MessageInput({
  channelId,
  channelName,
  replyTarget,
  onClearReply,
}: MessageInputProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus the input when the user picks a reply target
  useEffect(() => {
    if (replyTarget) {
      textareaRef.current?.focus();
    }
  }, [replyTarget]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    setLoading(true);
    const formData = new FormData();
    formData.set("content", content);
    if (replyTarget) {
      formData.set("replyToId", replyTarget.id);
    }

    const result = await sendMessage(channelId, formData);
    if (result.success) {
      setContent("");
      onClearReply?.();
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    } else if (e.key === "Escape" && replyTarget) {
      e.preventDefault();
      onClearReply?.();
    }
  }

  return (
    <div className="border-t border-border pt-4">
      {replyTarget && (
        <div className="mb-2 flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2">
          <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-gold" />
          <div className="min-w-0 flex-1 text-xs">
            <span className="text-muted-foreground">Replying to </span>
            <span className="font-medium text-foreground">
              {replyTarget.authorName}
            </span>
            <span className="ml-2 truncate italic text-muted-foreground/80">
              {replyTarget.preview}
            </span>
          </div>
          <button
            type="button"
            onClick={onClearReply}
            className="rounded text-muted-foreground hover:text-foreground"
            aria-label="Cancel reply"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            replyTarget
              ? `Reply to ${replyTarget.authorName}...`
              : `Message #${channelName}...`
          }
          rows={1}
          className="flex-1 resize-none rounded-md border border-border bg-secondary/30 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-gold/30"
        />
        <Button
          type="submit"
          size="icon"
          disabled={loading || !content.trim()}
          className="h-10 w-10 bg-gold text-gold-foreground hover:bg-gold/90"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
