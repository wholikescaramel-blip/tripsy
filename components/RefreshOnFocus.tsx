"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Pull fresh data when someone comes back to the tab (and every 30s while it's open). */
export function RefreshOnFocus() {
  const router = useRouter();
  useEffect(() => {
    const onFocus = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", onFocus);
    const t = setInterval(onFocus, 30_000);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      clearInterval(t);
    };
  }, [router]);
  return null;
}
