"use client";

import { useCallback, useRef } from "react";

/**
 * Base UI exposes its focus sentinels as buttons in Safari for VoiceOver.
 * Keep that focus behavior, but give the exposed boundaries meaningful names.
 * Upstream context: https://github.com/mui/base-ui/issues/5237
 */
export function useModalFocusGuardNames() {
  const observerRef = useRef<MutationObserver | null>(null);

  return useCallback((popup: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    const portal = popup?.parentElement;
    if (!popup || !portal) return;

    const nameGuard = (element: Element | null, label: string) => {
      if (element?.matches('[data-base-ui-focus-guard][role="button"]')
        && !element.hasAttribute("aria-label")
        && !element.hasAttribute("aria-labelledby")) {
        element.setAttribute("aria-label", label);
      }
    };
    const nameBoundaries = () => {
      nameGuard(popup.previousElementSibling, "Go to the last control in this dialog");
      nameGuard(popup.nextElementSibling, "Go to the first control in this dialog");
    };

    nameBoundaries();
    // Safari's role is assigned after mount, and Base UI may replace guards.
    // Observe only this portal; do not modify their tab order or focus handlers.
    const observer = new MutationObserver(nameBoundaries);
    observer.observe(portal, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["role", "aria-label", "aria-labelledby"],
    });
    observerRef.current = observer;
  }, []);
}
