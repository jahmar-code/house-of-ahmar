"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";

/**
 * Builds the message an Elder actually needs to send. The order matters: a
 * relative must create an account first, then enter the code — nothing else in
 * the app says so.
 */
export function inviteMessage(code: string, houseName: string): string {
  const origin =
    typeof window === "undefined" ? "" : window.location.origin;
  return [
    `You're invited to ${houseName}, our family's private space.`,
    "",
    `Create an account here: ${origin}/sign-up`,
    `Then enter this code: ${code}`,
  ].join("\n");
}

/** Shared clipboard write — returns false when the browser refuses. */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function useCopied() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function flash() {
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  return { copied, flash };
}

/** Compact icon control for a row in the code list. */
export function CopyCodeButton({ code }: { code: string }) {
  const { copied, flash } = useCopied();

  async function handleClick() {
    if (await writeClipboard(code)) flash();
    else toast.error("Couldn't reach the clipboard — select the code and copy it.");
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      aria-label={copied ? `Copied code ${code}` : `Copy code ${code}`}
      className="size-11 shrink-0 text-muted-foreground hover:text-foreground"
    >
      {copied ? (
        <Check className="h-4 w-4 text-primary" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );
}

/**
 * Full-width control for the freshly-minted code. `mode="message"` copies the
 * whole ready-to-paste invite; `mode="code"` copies just the the code.
 */
export function CopyInviteButton({
  code,
  houseName,
  mode = "message",
}: {
  code: string;
  houseName: string;
  mode?: "message" | "code";
}) {
  const { copied, flash } = useCopied();
  const label = mode === "code" ? "Copy code only" : "Copy invite message";

  async function handleClick() {
    const text = mode === "code" ? code : inviteMessage(code, houseName);
    if (await writeClipboard(text)) flash();
    else toast.error("Couldn't reach the clipboard — select the text and copy it.");
  }

  return (
    <Button
      type="button"
      variant={mode === "code" ? "outline" : "default"}
      onClick={handleClick}
      className="h-11 w-full sm:w-auto"
    >
      {copied ? (
        <Check className="mr-2 h-4 w-4" />
      ) : (
        <Copy className="mr-2 h-4 w-4" />
      )}
      {copied ? "Copied" : label}
    </Button>
  );
}
