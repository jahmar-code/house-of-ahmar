"use client";

import { useEffect } from "react";
import { heartbeat } from "@/app/actions/presence";
import { HEARTBEAT_INTERVAL_MS } from "@/lib/constants";

/**
 * Writes `members.lastSeenAt` while the House is actually on screen.
 *
 * The poll is gated on `document.visibilityState`: a phone left on the Great
 * Hall and pocketed reported "online" forever, which turned the one real
 * presence signal in the app into a lie (and billed a request a minute to say
 * so). Backgrounding stops the poll; coming back fires immediately so the dot
 * is accurate the moment someone looks.
 */
export function PresenceProvider() {
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    function beat() {
      if (document.visibilityState !== "visible") return;
      // A temporarily offline tab can retry at its next heartbeat.
      void heartbeat().catch(() => {});
    }

    function start() {
      if (interval !== undefined) return;
      beat();
      interval = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    }

    function stop() {
      if (interval === undefined) return;
      clearInterval(interval);
      interval = undefined;
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") start();
      else stop();
    }

    handleVisibilityChange();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stop();
    };
  }, []);

  return null;
}
