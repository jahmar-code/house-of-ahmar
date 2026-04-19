"use client";

import { useEffect } from "react";
import { heartbeat } from "@/app/actions/presence";
import { HEARTBEAT_INTERVAL_MS } from "@/lib/constants";

export function PresenceProvider() {
  useEffect(() => {
    // Fire immediately on mount
    heartbeat();

    const interval = setInterval(() => {
      heartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  return null;
}
