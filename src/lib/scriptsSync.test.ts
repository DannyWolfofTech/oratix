import { describe, it, expect } from "vitest";
import { mergeScripts } from "@/lib/scriptsSync";
import type { Script } from "@/hooks/useScripts";

const script = (id: string, updatedAt: string, title = id): Script => ({
  id,
  title,
  content: "",
  created_at: updatedAt,
  updated_at: updatedAt,
});

describe("mergeScripts", () => {
  it("keeps remote scripts and flags local-only scripts to push", () => {
    const local = [script("a", "2026-01-01T00:00:00Z")];
    const remote = [script("b", "2026-01-02T00:00:00Z")];

    const { merged, toPush } = mergeScripts(local, remote);

    expect(merged.map((s) => s.id).sort()).toEqual(["a", "b"]);
    expect(toPush.map((s) => s.id)).toEqual(["a"]);
  });

  it("prefers the newer copy when ids collide", () => {
    const local = [script("a", "2026-02-01T00:00:00Z", "local-newer")];
    const remote = [script("a", "2026-01-01T00:00:00Z", "remote-older")];

    const { merged, toPush } = mergeScripts(local, remote);

    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe("local-newer");
    expect(toPush.map((s) => s.id)).toEqual(["a"]);
  });

  it("does not push when remote is newer", () => {
    const local = [script("a", "2026-01-01T00:00:00Z", "local-older")];
    const remote = [script("a", "2026-02-01T00:00:00Z", "remote-newer")];

    const { merged, toPush } = mergeScripts(local, remote);

    expect(merged[0].title).toBe("remote-newer");
    expect(toPush).toHaveLength(0);
  });

  it("sorts the merged result newest first", () => {
    const local = [script("old", "2026-01-01T00:00:00Z")];
    const remote = [script("new", "2026-03-01T00:00:00Z")];

    const { merged } = mergeScripts(local, remote);

    expect(merged.map((s) => s.id)).toEqual(["new", "old"]);
  });
});
