"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function heartbeat() {
  // Best-effort presence telemetry, fired fire-and-forget every 60s. A transient
  // DB/auth blip must never surface as an unhandled client rejection.
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await db
      .update(members)
      .set({ lastSeenAt: new Date() })
      .where(eq(members.authUserId, user.id));
  } catch {
    // swallow — presence is non-critical
  }
}
