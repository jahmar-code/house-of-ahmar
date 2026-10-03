"use client";

import { useSyncExternalStore, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

/** Prevent edits before controlled inputs have their client event handlers. */
export function HydratedFieldset({ disabled, className, ...props }: ComponentProps<"fieldset">) {
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);

  return (
    <fieldset
      {...props}
      disabled={!ready || disabled}
      aria-busy={!ready || undefined}
      className={cn("min-w-0", className)}
    />
  );
}
