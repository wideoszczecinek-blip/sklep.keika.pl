"use client";

import { useEffect } from "react";
import { initTracking } from "@/lib/tracking";

/**
 * Fires the Meta Pixel + CAPI bootstrap once on load. Replaced the cookie
 * consent banner, which used to be the only thing that called initTracking()
 * and only after the visitor tapped "Akceptuję" - on the Facebook in-app
 * browser (the bulk of paid traffic) almost nobody did, so those visits
 * produced no Meta signal and the remarketing audiences never filled.
 * Mounted once in app/layout.tsx.
 */
export default function TrackingBoot() {
  useEffect(() => {
    void initTracking();
  }, []);
  return null;
}
