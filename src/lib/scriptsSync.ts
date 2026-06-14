import { supabase } from "@/integrations/supabase/client";
import type { Script } from "@/hooks/useScripts";

type RemoteRow = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_id: string;
};

const toScript = (row: RemoteRow): Script => ({
  id: row.id,
  title: row.title,
  content: row.content,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

/** Fetch every script owned by the user, newest first. */
export async function fetchRemoteScripts(): Promise<Script[]> {
  const { data, error } = await supabase
    .from("scripts")
    .select("id, title, content, created_at, updated_at, user_id")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toScript);
}

/** Insert or update a single script for the given user. */
export async function upsertRemoteScript(userId: string, script: Script): Promise<void> {
  const { error } = await supabase.from("scripts").upsert({ ...script, user_id: userId });
  if (error) throw error;
}

/** Insert or update many scripts in one round trip (used for first-login migration). */
export async function upsertRemoteScripts(userId: string, scripts: Script[]): Promise<void> {
  if (scripts.length === 0) return;
  const rows = scripts.map((s) => ({ ...s, user_id: userId }));
  const { error } = await supabase.from("scripts").upsert(rows);
  if (error) throw error;
}

/** Delete a single script. */
export async function deleteRemoteScript(id: string): Promise<void> {
  const { error } = await supabase.from("scripts").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Merge local and remote scripts by id. For ids present in both, the row with
 * the newer `updated_at` wins. Returns the merged list (newest first) plus the
 * subset of scripts whose local copy is newer/unseen and therefore needs to be
 * pushed up to the server.
 */
export function mergeScripts(
  local: Script[],
  remote: Script[]
): { merged: Script[]; toPush: Script[] } {
  const remoteById = new Map(remote.map((s) => [s.id, s]));
  const byId = new Map<string, Script>();
  const toPush: Script[] = [];

  for (const r of remote) byId.set(r.id, r);

  for (const l of local) {
    const r = remoteById.get(l.id);
    if (!r) {
      // Local-only script — needs to go up.
      byId.set(l.id, l);
      toPush.push(l);
    } else if (Date.parse(l.updated_at) > Date.parse(r.updated_at)) {
      // Local copy is newer — overwrite remote.
      byId.set(l.id, l);
      toPush.push(l);
    }
  }

  const merged = Array.from(byId.values()).sort(
    (a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)
  );
  return { merged, toPush };
}
