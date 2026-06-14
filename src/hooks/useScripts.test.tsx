import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { toast } from "sonner";
import { useScripts, MAX_CONTENT_LENGTH, MAX_TITLE_LENGTH } from "@/hooks/useScripts";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const STORAGE_KEY = "teleprompter_scripts";

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("useScripts", () => {
  it("creates a script and persists it to localStorage", () => {
    const { result } = renderHook(() => useScripts());

    act(() => {
      result.current.createScript("My title", "My body");
    });

    expect(result.current.scripts).toHaveLength(1);
    expect(result.current.scripts[0]).toMatchObject({ title: "My title", content: "My body" });

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    expect(persisted).toHaveLength(1);
    expect(persisted[0].title).toBe("My title");
  });

  it("updates a script and returns the updated object synchronously", () => {
    const { result } = renderHook(() => useScripts());

    let created!: ReturnType<typeof result.current.createScript>;
    act(() => {
      created = result.current.createScript("A", "a");
    });

    let updated: ReturnType<typeof result.current.updateScript> = null;
    act(() => {
      updated = result.current.updateScript(created.id, "B", "b");
    });

    expect(updated).not.toBeNull();
    expect(updated!.title).toBe("B");
    expect(result.current.scripts[0].content).toBe("b");
  });

  it("returns null when updating a non-existent script", () => {
    const { result } = renderHook(() => useScripts());
    let updated: ReturnType<typeof result.current.updateScript> = undefined as never;
    act(() => {
      updated = result.current.updateScript("missing-id", "x", "y");
    });
    expect(updated).toBeNull();
  });

  it("deletes a script", () => {
    const { result } = renderHook(() => useScripts());
    let created!: ReturnType<typeof result.current.createScript>;
    act(() => {
      created = result.current.createScript("A", "a");
    });
    act(() => {
      result.current.deleteScript(created.id);
    });
    expect(result.current.scripts).toHaveLength(0);
  });

  it("clamps oversized title/content to the configured limits", () => {
    const { result } = renderHook(() => useScripts());
    const bigTitle = "t".repeat(MAX_TITLE_LENGTH + 50);
    const bigContent = "c".repeat(MAX_CONTENT_LENGTH + 50);

    act(() => {
      result.current.createScript(bigTitle, bigContent);
    });

    expect(result.current.scripts[0].title).toHaveLength(MAX_TITLE_LENGTH);
    expect(result.current.scripts[0].content).toHaveLength(MAX_CONTENT_LENGTH);
  });

  it("surfaces a toast instead of crashing when persistence fails (quota)", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });

    const { result } = renderHook(() => useScripts());
    act(() => {
      result.current.createScript("A", "a");
    });

    // In-memory state still updates even though persistence failed.
    expect(result.current.scripts).toHaveLength(1);
    expect(toast.error).toHaveBeenCalled();

    setItemSpy.mockRestore();
  });

  it("loads existing scripts from localStorage on init", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: "1", title: "Seed", content: "x", created_at: "", updated_at: "" },
      ])
    );
    const { result } = renderHook(() => useScripts());
    expect(result.current.scripts).toHaveLength(1);
    expect(result.current.scripts[0].title).toBe("Seed");
  });
});
