"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { sendMessage } from "@/app/actions/council";
import { CornerDownRight, Loader2, Send, X } from "lucide-react";
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
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendingRef = useRef(false);

  // Focus the input when the user picks a reply target
  useEffect(() => {
    if (replyTarget) {
      textareaRef.current?.focus();
    }
  }, [replyTarget]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || sendingRef.current) return;

    sendingRef.current = true;
    setLoading(true);
    setError("");
    const formData = new FormData();
    formData.set("content", content);
    if (replyTarget) {
      formData.set("replyToId", replyTarget.id);
    }

    try {
      const result = await sendMessage(channelId, formData);
      if (result.success) {
        setContent("");
        onClearReply?.();
      } else {
        // Never clear what someone typed on a failure — say what went wrong
        // and leave the words where they are.
        setError(result.error);
      }
    } catch {
      setError("That didn't send. Check your connection and try again.");
    }
    sendingRef.current = false;
    setLoading(false);
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter confirms characters in an IME; it must never send that draft.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
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
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-1.5">
          <CornerDownRight
            className="h-3.5 w-3.5 shrink-0 text-primary"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1 truncate text-xs">
            <span className="text-muted-foreground">Replying to </span>
            <span className="font-medium text-foreground">
              {replyTarget.authorName}
            </span>
            <span className="ml-2 italic text-muted-foreground">
              {replyTarget.preview}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClearReply}
            aria-label="Cancel reply"
            className="size-11 shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <label htmlFor="council-message" className="sr-only">
          Write a message in {channelName}
        </label>
        <textarea
          id="council-message"
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            replyTarget
              ? `Reply to ${replyTarget.authorName}...`
              : `Message #${channelName}...`
          }
          rows={1}
          readOnly={loading}
          maxLength={4000}
          aria-describedby="council-message-help council-message-error"
          aria-invalid={Boolean(error)}
          className="max-h-40 min-h-11 flex-1 resize-none rounded-lg border border-border bg-muted px-3.5 py-2.5 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 sm:text-sm"
        />
        <Button
          type="submit"
          size="icon"
          disabled={loading || !content.trim()}
          aria-label="Send message"
          className="h-11 w-11 shrink-0"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>

      {/* Always rendered so an error never shoves the composer around. */}
      <p id="council-message-help" className="mt-1 text-xs text-muted-foreground">
        Enter to send · Shift + Enter for a new line
      </p>
      <p id="council-message-error" role="alert" className="mt-1 min-h-4 text-xs text-destructive">
        {error}
      </p>
    </div>
  );
}
