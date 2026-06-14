import { useState, useEffect, useCallback, useRef } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchRemoteScripts,
  upsertRemoteScript,
  upsertRemoteScripts,
  deleteRemoteScript,
  mergeScripts,
} from "@/lib/scriptsSync";

export interface Script {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

const ANON_STORAGE_KEY = "teleprompter_scripts";

// Guard rails so a runaway paste can't blow past the localStorage quota and
// crash the whole app. ~1 MB of script text is far more than any teleprompter
// session needs.
export const MAX_TITLE_LENGTH = 300;
export const MAX_CONTENT_LENGTH = 1_000_000;

const scriptInputSchema = z.object({
  title: z.string().max(MAX_TITLE_LENGTH),
  content: z.string().max(MAX_CONTENT_LENGTH),
});

function clampInput(title: string, content: string) {
  return {
    title: title.slice(0, MAX_TITLE_LENGTH),
    content: content.slice(0, MAX_CONTENT_LENGTH),
  };
}

// Anonymous scripts live under a shared key; a signed-in user's offline cache
// is namespaced per user so two accounts on one device never see each other's
// scripts.
function storageKeyFor(userId: string | null): string {
  return userId ? `${ANON_STORAGE_KEY}__${userId}` : ANON_STORAGE_KEY;
}

function loadScripts(key: string): Script[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Script[]) : [];
  } catch {
    return [];
  }
}

function saveScripts(key: string, scripts: Script[]): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(scripts));
    return true;
  } catch (error) {
    // Most commonly QuotaExceededError. Don't let a storage failure take down
    // the React tree — surface it and keep the in-memory state intact.
    console.error("[useScripts] Failed to persist scripts", error);
    return false;
  }
}

export function useScripts() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [scripts, setScripts] = useState<Script[]>(() => loadScripts(ANON_STORAGE_KEY));
  const [isLoading, setIsLoading] = useState(false);

  // Read the current user id inside event callbacks without rebuilding them.
  const userIdRef = useRef<string | null>(userId);

  // Persist every change to the active store (offline cache / anonymous store).
  useEffect(() => {
    const ok = saveScripts(storageKeyFor(userId), scripts);
    if (!ok) toast.error("Nu am putut salva scripturile (memorie plină).");
  }, [scripts, userId]);

  // React to sign-in / sign-out.
  useEffect(() => {
    userIdRef.current = userId;
    let cancelled = false;

    if (!userId) {
      // Signed out → show the anonymous store.
      setScripts(loadScripts(ANON_STORAGE_KEY));
      return;
    }

    // Signed in → pull remote, merge with any local/offline edits and claim
    // anonymous scripts created before signing in.
    setIsLoading(true);
    (async () => {
      try {
        const anon = loadScripts(ANON_STORAGE_KEY);
        const cache = loadScripts(storageKeyFor(userId));
        const remote = await fetchRemoteScripts();
        const { merged, toPush } = mergeScripts([...cache, ...anon], remote);
        if (toPush.length > 0) await upsertRemoteScripts(userId, toPush);
        if (cancelled) return;
        setScripts(merged);
        // Claim the anonymous store exactly once so a different account can't
        // later pick up these scripts.
        if (anon.length > 0) saveScripts(ANON_STORAGE_KEY, []);
      } catch (error) {
        console.error("[useScripts] Cloud sync failed; using local cache", error);
        if (!cancelled) setScripts(loadScripts(storageKeyFor(userId)));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const createScript = useCallback((title: string, content: string): Script => {
    const safe = clampInput(title, content);
    const now = new Date().toISOString();
    const script: Script = {
      id: crypto.randomUUID(),
      title: safe.title,
      content: safe.content,
      created_at: now,
      updated_at: now,
    };
    setScripts((prev) => [script, ...prev]);
    const uid = userIdRef.current;
    if (uid) {
      upsertRemoteScript(uid, script).catch((e) =>
        console.error("[useScripts] Remote create failed", e)
      );
    }
    return script;
  }, []);

  const updateScript = useCallback(
    (id: string, title: string, content: string): Script | null => {
      const parsed = scriptInputSchema.safeParse({ title, content });
      const safe = parsed.success ? parsed.data : clampInput(title, content);

      // Build the result from the current snapshot so the caller gets the
      // updated object synchronously, regardless of React's batch timing.
      const existing = scripts.find((s) => s.id === id);
      if (!existing) return null;
      const updated: Script = {
        ...existing,
        title: safe.title,
        content: safe.content,
        updated_at: new Date().toISOString(),
      };
      setScripts((prev) => prev.map((s) => (s.id === id ? updated : s)));
      const uid = userIdRef.current;
      if (uid) {
        upsertRemoteScript(uid, updated).catch((e) =>
          console.error("[useScripts] Remote update failed", e)
        );
      }
      return updated;
    },
    [scripts]
  );

  const deleteScript = useCallback((id: string) => {
    setScripts((prev) => prev.filter((s) => s.id !== id));
    const uid = userIdRef.current;
    if (uid) {
      deleteRemoteScript(id).catch((e) =>
        console.error("[useScripts] Remote delete failed", e)
      );
    }
  }, []);

  return { scripts, isLoading, createScript, updateScript, deleteScript };
}
