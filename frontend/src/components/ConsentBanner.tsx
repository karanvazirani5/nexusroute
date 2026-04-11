"use client";

import { useEffect } from "react";
import { grantConsent, hasInteractedWithConsent } from "@/lib/telemetry";

/**
 * Auto-grants essential consent silently on first visit.
 * No visible banner — data is collected anonymously by default.
 * Users can still change their tier on the /privacy page.
 */
export function ConsentBanner() {
  useEffect(() => {
    if (!hasInteractedWithConsent()) {
      grantConsent(0, ["essential"]).catch(() => {});
    }
  }, []);

  return null;
}
