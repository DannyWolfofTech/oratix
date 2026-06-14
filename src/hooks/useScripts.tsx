import { useState, useEffect, useCallback } from "react";
import { z } from "zod";
import { toast } from "sonner";

export interface Script {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

const STORAGE_KEY = "teleprompter_scripts";

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

function loadScripts(): Script[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Script[]) : [];
  } catch {
    return [];
  }
}

function saveScripts(scripts: Script[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
    return true;
  } catch (error) {
    // Most commonly QuotaExceededError. Don't let a storage failure take down
    // the React tree — surface it and keep the in-memory state intact.
    console.error("[useScripts] Failed to persist scripts", error);
    return false;
  }
}

export function useScripts() {
  const [scripts, setScripts] = useState<Script[]>(() => loadScripts());

  useEffect(() => {
    const ok = saveScripts(scripts);
    if (!ok) {
      toast.error("Nu am putut salva scripturile (memorie plină).");
    }
  }, [scripts]);

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
      return updated;
    },
    [scripts]
  );

  const deleteScript = useCallback((id: string) => {
    setScripts((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return { scripts, isLoading: false, createScript, updateScript, deleteScript };
}
