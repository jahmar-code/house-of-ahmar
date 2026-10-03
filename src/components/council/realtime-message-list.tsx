"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { timestampMicros } from "@/lib/message-order";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ArrowDown, MessagesSquare, WifiOff } from "lucide-react";
import { deleteMessage, loadOlderMessages } from "@/app/actions/council";
import { toast } from "sonner";
import { MessageRow } from "./message-row";
import {
  insertByCreatedAt,
  reconcile,
  toAuthor,
  type AuthorRow,
  type MessageRowPayload,
} from "./message-sync";
import type { MessageWithAuthor } from "@/types";
import type { HoaRole } from "@/lib/constants";
import type { ReplyTarget } from "./council-channel";

interface RealtimeMessageListProps {
  initialMessages: MessageWithAuthor[];
  snapshotAt: string;
  channelId: string;
  channelName: string;
  currentMemberId: string;
  currentRole: HoaRole;
  onReply?: (target: ReplyTarget) => void;
}

/** How close to the bottom still counts as "reading the newest". */
const NEAR_BOTTOM_PX = 120;
/** Don't re-pull the server payload more often than this. */
const REFRESH_THROTTLE_MS = 5000;
/** If the chamber hasn't joined by now, say so rather than imply it's live. */
const CONNECT_GRACE_MS = 6000;

export function RealtimeMessageList({
  initialMessages,
  snapshotAt,
  channelId,
  channelName,
  currentMemberId,
  currentRole,
  onReply,
}: RealtimeMessageListProps) {
  const router = useRouter();
  const [messages, setMessages] =
    useState<MessageWithAuthor[]>(initialMessages);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => new Set());
  const deletedIdsRef = useRef(new Set<string>());
  const [pendingDelete, setPendingDelete] = useState<MessageWithAuthor | null>(
    null
  );
  const [connection, setConnection] = useState<
    "connecting" | "live" | "offline"
  >("connecting");
  const [hasNewBelow, setHasNewBelow] = useState(false);
  const [hasMore, setHasMore] = useState(initialMessages.length >= 100);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const historyScrollRef = useRef<{ height: number; top: number } | null>(null);

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLElement | null>(null);
  const messagesRef = useRef(messages);
  const atBottomRef = useRef(true);
  const prevCountRef = useRef(messages.length);
  const didInitialScrollRef = useRef(false);
  const lastRefreshRef = useRef(0);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const messagesById = useMemo(() => {
    const map = new Map<string, MessageWithAuthor>();
    for (const m of messages) map.set(m.id, m);
    return map;
  }, [messages]);

  // The server payload is a real second delivery channel, not a one-off seed:
  // fold each freshly-rendered prop in during render (React's documented
  // adjust-state-on-prop-change pattern) rather than discarding it.
  const [seenPayload, setSeenPayload] = useState(initialMessages);
  if (seenPayload !== initialMessages) {
    setSeenPayload(initialMessages);
    setMessages((prev) => reconcile(prev, initialMessages, snapshotAt));
  }

  const pullLatest = useCallback((force = false) => {
    const now = Date.now();
    if (!force && now - lastRefreshRef.current < REFRESH_THROTTLE_MS) return;
    lastRefreshRef.current = now;
    router.refresh();
  }, [router]);

  // The ScrollArea viewport is the scroll container — track how far from the
  // bottom the reader is so we never yank them away from what they're reading.
  useEffect(() => {
    const found = scrollRootRef.current?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    );
    if (!found) return;
    const viewport: HTMLElement = found;
    viewportRef.current = viewport;

    const handleScroll = () => {
      const distance =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      atBottomRef.current = distance <= NEAR_BOTTOM_PX;
      if (atBottomRef.current) setHasNewBelow(false);
    };

    handleScroll();
    viewport.addEventListener("scroll", handleScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToBottom = useCallback((smooth: boolean) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: smooth && !reduceMotion ? "smooth" : "auto",
    });
    atBottomRef.current = true;
    setHasNewBelow(false);
  }, []);

  useEffect(() => {
    const restore = historyScrollRef.current;
    if (restore && viewportRef.current) {
      const viewport = viewportRef.current;
      viewport.scrollTop = restore.top + viewport.scrollHeight - restore.height;
      historyScrollRef.current = null;
      prevCountRef.current = messages.length;
      return;
    }
    const isFirst = !didInitialScrollRef.current;
    const grew = messages.length > prevCountRef.current;
    prevCountRef.current = messages.length;
    didInitialScrollRef.current = true;
    if (!isFirst && !grew) return; // a deletion must not move anyone

    // Let the new row lay out before deciding where to land.
    const frame = requestAnimationFrame(() => {
      if (isFirst) {
        scrollToBottom(false); // land at the newest, don't animate 100 messages
      } else if (atBottomRef.current) {
        scrollToBottom(true);
      } else {
        setHasNewBelow(true); // they're reading — offer, don't yank
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [messages, scrollToBottom]);

  // Subscribe to realtime changes on the messages table
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const channel = supabase
      .channel(`council:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          const newRow = payload.new as MessageRowPayload;
          if (newRow.is_deleted) return;

          // The same handful of people talk in a chamber — reuse an author we
          // already hold instead of a round-trip per message.
          let author =
            messagesRef.current.find((m) => m.authorId === newRow.author_id)
              ?.author ?? null;

          if (!author) {
            // Fetch ONLY the author fields a message renders. The members table
            // is otherwise locked from the client Data API (RLS + column grant).
            const { data } = await supabase
              .from("members")
              .select("id, display_name, avatar_url, role")
              .eq("id", newRow.author_id)
              .single();
            author = data ? toAuthor(data as AuthorRow) : null;
          }

          const newMessage: MessageWithAuthor = {
            id: newRow.id,
            channelId: newRow.channel_id,
            authorId: newRow.author_id,
            content: newRow.content,
            mediaUrls: newRow.media_urls ?? [],
            isDeleted: newRow.is_deleted,
            replyToId: newRow.reply_to_id,
            createdAt: new Date(newRow.created_at),
            createdAtMicros: timestampMicros(newRow.created_at),
            updatedAt: new Date(newRow.updated_at),
            // A lookup that fails must never silently swallow a real message.
            author:
              author ??
              toAuthor({
                id: newRow.author_id,
                display_name: "A member",
                avatar_url: null,
                role: "member",
              }),
          };

          setMessages((prev) => {
            // An UPDATE may arrive while the author lookup is in flight.
            if (deletedIdsRef.current.has(newMessage.id)) return prev;
            // Deduplicate — the server action also revalidates the page
            if (prev.some((m) => m.id === newMessage.id)) return prev;
            return insertByCreatedAt(prev, newMessage);
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const updated = payload.new as { id: string; is_deleted: boolean };
          if (!updated.is_deleted) return;
          deletedIdsRef.current.add(updated.id);
          setDeletedIds((prev) =>
            prev.has(updated.id) ? prev : new Set(prev).add(updated.id)
          );
          setMessages((prev) => prev.filter((m) => m.id !== updated.id));
        }
      )
      .on("system", {}, (payload: { extension?: string; status?: string }) => {
        if (payload.extension !== "postgres_changes") return;
        if (payload.status === "error" || payload.status === "timeout") {
          // A socket can join successfully while its database stream fails.
          setConnection("offline");
        } else if (payload.status === "ok") {
          setConnection("live");
          // Database readiness can follow SUBSCRIBED within the throttle
          // window. Always close that gap, including after stream recovery.
          pullLatest(true);
        }
      });

    async function subscribe() {
      try {
        // A hard navigation creates the browser client while cookie-session
        // hydration is still asynchronous. Resolve its token before joining:
        // an anonymous join cannot establish the protected message filters.
        await supabase.realtime.setAuth();
        if (cancelled) return;
        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            // The socket has joined; only postgres_changes readiness above
            // confirms the database stream is live.
            // A rejoin replays nothing, so pull whatever landed while we were
            // away — a locked phone must not miss part of the conversation.
            // Also close the gap between the initial page query and subscribing.
            pullLatest();
          } else if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            setConnection("offline");
          }
        });
      } catch {
        if (!cancelled) setConnection("offline");
      }
    }
    void subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [channelId, pullLatest]);

  // A channel that never joins should say so rather than sit on stale history.
  useEffect(() => {
    if (connection !== "connecting") return;
    const timer = setTimeout(() => setConnection("offline"), CONNECT_GRACE_MS);
    return () => clearTimeout(timer);
  }, [connection]);

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") pullLatest();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [pullLatest]);

  async function handleLoadEarlier() {
    if (loadingHistory || !messages[0]) return;
    setLoadingHistory(true);
    try {
      const result = await loadOlderMessages(channelId, messages[0].id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      if (!result.data) return;
      const viewport = viewportRef.current;
      if (viewport) historyScrollRef.current = { height: viewport.scrollHeight, top: viewport.scrollTop };
      const older = result.data.messages;
      setMessages((current) => {
        const ids = new Set(current.map((message) => message.id));
        return [...older.filter((message) => !ids.has(message.id)), ...current];
      });
      setHasMore(result.data.hasMore);
    } catch {
      toast.error("Couldn't load earlier messages. Please try again.");
    } finally {
      setLoadingHistory(false);
    }
  }

  async function handleConfirmDelete() {
    const target = pendingDelete;
    if (!target) return;
    try {
      const result = await deleteMessage(target.id);
      if (result.success) {
        deletedIdsRef.current.add(target.id);
        setDeletedIds((prev) => new Set(prev).add(target.id));
        // Optimistic remove — realtime will also fire
        setMessages((prev) => prev.filter((m) => m.id !== target.id));
      } else {
        toast.error(result.error);
      }
      return result.success;
    } catch {
      toast.error("Couldn't delete that message. Try again.");
      return false;
    }
  }

  return (
    <>
      <div ref={scrollRootRef} className="relative flex min-h-0 flex-1 flex-col">
        {connection === "offline" && (
          <div
            role="status"
            className="flex items-center justify-center gap-2 border-b border-border bg-muted px-3 py-1.5 text-xs text-muted-foreground"
          >
            <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Reconnecting — you may not be seeing the newest messages.
          </div>
        )}

        <ScrollArea className="min-h-0 flex-1 py-4">
          {hasMore && <div className="mb-3 flex justify-center"><Button variant="outline" className="h-11" disabled={loadingHistory} onClick={handleLoadEarlier}>{loadingHistory ? "Loading…" : "Load earlier messages"}</Button></div>}
          <div
            role="log"
            aria-label={`Messages in ${channelName}`}
            aria-relevant="additions"
            className="space-y-1"
          >
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted">
                  <MessagesSquare
                    className="h-5 w-5 text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Nothing here yet. Say the first thing.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMine = msg.authorId === currentMemberId;
                const canDelete = isMine || currentRole === "elder";
                const replyTo = msg.replyToId
                  ? messagesById.get(msg.replyToId) ?? null
                  : null;

                return (
                  <MessageRow
                    key={msg.id}
                    message={msg}
                    replyTo={replyTo}
                    replyParentDeleted={
                      msg.replyToId ? deletedIds.has(msg.replyToId) : false
                    }
                    canDelete={canDelete}
                    onReply={onReply}
                    onRequestDelete={setPendingDelete}
                  />
                );
              })
            )}
          </div>
        </ScrollArea>

        {hasNewBelow && (
          <Button
            variant="secondary"
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-3 left-1/2 h-11 -translate-x-1/2 gap-1.5 rounded-full shadow-lg"
          >
            <ArrowDown className="h-4 w-4" aria-hidden="true" />
            New messages
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete this message?"
        description="It disappears for everyone in this chamber. This can't be undone."
        confirmLabel="Delete"
        cancelLabel="Keep it"
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
