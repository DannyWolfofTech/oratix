import { useEffect } from "react";

const BUILD_ID = import.meta.env.VITE_BUILD_ID || "__DEV__";
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

export const useVersionCheck = () => {
  useEffect(() => {
    if (BUILD_ID === "__DEV__") return; // skip in dev

    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.buildId && data.buildId !== BUILD_ID) {
          console.log("[version] New version detected, reloading…");
          window.location.reload();
        }
      } catch {
        // network error, skip silently
      }
    };

    const interval = setInterval(check, CHECK_INTERVAL);
    // Also check on visibility change (user returns to tab)
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
};
