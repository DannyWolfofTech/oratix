import { useState, useEffect, useCallback } from "react";

export interface Script {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

const STORAGE_KEY = "teleprompter_scripts";

function loadScripts(): Script[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveScripts(scripts: Script[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
}

export function useScripts() {
  const [scripts, setScripts] = useState<Script[]>(() => loadScripts());

  useEffect(() => {
    saveScripts(scripts);
  }, [scripts]);

  const createScript = useCallback((title: string, content: string): Script => {
    const now = new Date().toISOString();
    const script: Script = {
      id: crypto.randomUUID(),
      title,
      content,
      created_at: now,
      updated_at: now,
    };
    setScripts((prev) => [script, ...prev]);
    return script;
  }, []);

  const updateScript = useCallback((id: string, title: string, content: string): Script | null => {
    // Build the result synchronously from the current scripts snapshot so the
    // caller always gets the updated object, regardless of React's batch timing.
    const existing = scripts.find((s) => s.id === id);
    if (!existing) return null;
    const updated: Script = { ...existing, title, content, updated_at: new Date().toISOString() };
    setScripts((prev) => prev.map((s) => (s.id === id ? updated : s)));
    return updated;
  }, [scripts]);

  const deleteScript = useCallback((id: string) => {
    setScripts((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return { scripts, isLoading: false, createScript, updateScript, deleteScript };
}
