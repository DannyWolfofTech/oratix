import { describe, it, expect, vi, afterEach } from "vitest";
import {
  prefersMp4Recording,
  getPreferredRecordingMimeType,
  measureBlobDuration,
} from "@/lib/recording";

function setUserAgent(ua: string) {
  Object.defineProperty(navigator, "userAgent", { value: ua, configurable: true });
}

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const DESKTOP_FIREFOX_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).MediaRecorder;
});

describe("prefersMp4Recording", () => {
  it("prefers mp4 on iOS", () => {
    setUserAgent(IPHONE_UA);
    expect(prefersMp4Recording()).toBe(true);
  });

  it("does not prefer mp4 on desktop Firefox", () => {
    setUserAgent(DESKTOP_FIREFOX_UA);
    expect(prefersMp4Recording()).toBe(false);
  });
});

describe("getPreferredRecordingMimeType", () => {
  it("returns webm first on platforms that don't prefer mp4", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).MediaRecorder = { isTypeSupported: () => true };
    setUserAgent(DESKTOP_FIREFOX_UA);
    expect(getPreferredRecordingMimeType()).toBe("video/webm;codecs=vp8,opus");
  });

  it("returns mp4 first on platforms that prefer mp4", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).MediaRecorder = { isTypeSupported: () => true };
    setUserAgent(IPHONE_UA);
    expect(getPreferredRecordingMimeType()).toBe("video/mp4;codecs=avc1.42E01E,mp4a.40.2");
  });

  it("returns empty string when nothing is supported", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).MediaRecorder = { isTypeSupported: () => false };
    setUserAgent(DESKTOP_FIREFOX_UA);
    expect(getPreferredRecordingMimeType()).toBe("");
  });
});

describe("measureBlobDuration", () => {
  it("returns null for an empty blob without touching the DOM", async () => {
    expect(await measureBlobDuration(new Blob([]))).toBeNull();
  });

  it("settles to null via the timeout guard when metadata never loads", async () => {
    vi.useFakeTimers();
    // jsdom doesn't implement object URLs or media loading; stub them out.
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURL as typeof URL.revokeObjectURL;
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});

    const promise = measureBlobDuration(new Blob(["some-bytes"]));
    await vi.advanceTimersByTimeAsync(8000);

    expect(await promise).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });
});
