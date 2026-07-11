"use client";

import { useEffect } from "react";
import { adoptLinkToken, initSyncClient } from "@/lib/sync";

/**
 * Wires up device sync on every page: adopts a #sync=… token arriving in the
 * URL (opening your sync link on a new device), then starts the sync engine
 * (pull-merge on load, debounced push on every save).
 */
export default function SyncBoot() {
  useEffect(() => {
    const adoptFromHash = () => {
      const match = window.location.hash.match(/[#&]sync=([A-Za-z0-9_-]{16,128})/);
      if (!match) return;
      // Drop the secret from the URL before anything can copy it around.
      history.replaceState(null, "", window.location.pathname + window.location.search);
      adoptLinkToken(match[1]);
    };
    adoptFromHash();
    initSyncClient();
    // A link opened into an already-running app arrives as a hash change, not a load.
    window.addEventListener("hashchange", adoptFromHash);
    return () => window.removeEventListener("hashchange", adoptFromHash);
  }, []);
  return null;
}
