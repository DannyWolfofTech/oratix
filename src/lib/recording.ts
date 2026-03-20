import fixWebmDuration from "fix-webm-duration";

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export interface FinalizedRecordingResult {
  blob: Blob;
  detectedDurationMs: number | null;
}

const isSupportedMimeType = (mimeType: string) => {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return false;
  }

  try {
    return MediaRecorder.isTypeSupported(mimeType);
  } catch {
    return false;
  }
};

const getUserAgent = () => (typeof navigator === "undefined" ? "" : navigator.userAgent || "");

export const prefersMp4Recording = () => {
  const ua = getUserAgent();
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isSamsung = /SamsungBrowser|SM-|SAMSUNG/i.test(ua);
  const isChrome = /Chrome|CriOS/i.test(ua) && !/Edg|OPR|SamsungBrowser/i.test(ua);

  return isIOS || (isAndroid && (isChrome || isSamsung));
};

export const getPreferredRecordingMimeType = () => {
  const mp4Candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=avc1,mp4a.40.2",
    "video/mp4",
  ];

  const webmCandidates = [
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp8,pcm",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8",
    "video/webm",
  ];

  const orderedCandidates = prefersMp4Recording()
    ? [...mp4Candidates, ...webmCandidates]
    : [...webmCandidates, ...mp4Candidates];

  return orderedCandidates.find(isSupportedMimeType) || "";
};

export const measureBlobDuration = async (blob: Blob): Promise<number | null> => {
  if (typeof document === "undefined" || blob.size === 0) return null;

  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const media = document.createElement("video");
    let settled = false;

    const finish = (duration: number | null) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(duration && Number.isFinite(duration) && duration > 0 ? duration : null);
    };

    const tryResolveDuration = () => {
      const directDuration = media.duration;
      if (Number.isFinite(directDuration) && directDuration > 0) {
        finish(directDuration);
        return true;
      }
      return false;
    };

    media.preload = "metadata";
    media.muted = true;
    media.onloadedmetadata = () => {
      if (tryResolveDuration()) return;

      const handleSeeked = () => {
        if (!tryResolveDuration()) {
          finish(null);
        }
      };

      media.addEventListener("seeked", handleSeeked, { once: true });

      try {
        media.currentTime = Number.MAX_SAFE_INTEGER;
      } catch {
        finish(null);
      }
    };

    media.onerror = () => finish(null);
    media.src = url;
  });
};

const toDurationMs = (durationSeconds: number | null) => {
  if (!durationSeconds || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return null;
  }

  return Math.round(durationSeconds * 1000);
};

const reblobRecording = (blob: Blob, mimeType: string) => {
  const extension = mimeType.includes("mp4") ? "mp4" : "webm";

  return new File([blob], `recording-final.${extension}`, {
    type: mimeType,
    lastModified: Date.now() + 1,
  });
};

const patchWebmDuration = async (blob: Blob, durationMs: number) => {
  return new Promise<Blob>((resolve, reject) => {
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("fix-webm-duration timeout"));
    }, 2500);

    try {
      fixWebmDuration(blob, durationMs, (fixedBlob: Blob) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        resolve(fixedBlob);
      });
    } catch (error) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      reject(error);
    }
  });
};

export const finalizeRecordingBlob = async (
  blob: Blob,
  mimeType: string,
  recordedDurationMs: number
): Promise<FinalizedRecordingResult> => {
  const safeRecordedDurationMs = recordedDurationMs > 0 ? Math.max(recordedDurationMs, 1000) : null;

  if (!mimeType.includes("webm")) {
    const detectedDurationMs = toDurationMs(await measureBlobDuration(blob)) ?? safeRecordedDurationMs;

    return {
      blob: reblobRecording(blob, mimeType),
      detectedDurationMs,
    };
  }

  const initialDetectedDurationMs = toDurationMs(await measureBlobDuration(blob));
  const durationHints = [safeRecordedDurationMs, initialDetectedDurationMs].filter(
    (value): value is number => typeof value === "number" && value > 0
  );

  let candidateBlob = blob;

  for (const durationHintMs of durationHints) {
    try {
      candidateBlob = await patchWebmDuration(candidateBlob, durationHintMs);
      break;
    } catch (error) {
      console.warn("[Recording] fix-webm-duration attempt failed", { durationHintMs, error });
    }
  }

  const seekerDerivedDurationMs = toDurationMs(await measureBlobDuration(candidateBlob));

  if (seekerDerivedDurationMs && (!initialDetectedDurationMs || Math.abs(seekerDerivedDurationMs - initialDetectedDurationMs) > 750)) {
    try {
      candidateBlob = await patchWebmDuration(candidateBlob, seekerDerivedDurationMs);
    } catch (error) {
      console.warn("[Recording] seeker-duration patch fallback failed", error);
    }
  }

  const detectedDurationMs = toDurationMs(await measureBlobDuration(candidateBlob))
    ?? seekerDerivedDurationMs
    ?? initialDetectedDurationMs
    ?? safeRecordedDurationMs;

  return {
    blob: reblobRecording(candidateBlob, mimeType),
    detectedDurationMs,
  };
};

export const waitForFinalizationWindow = async (minimumMs = 2500) => {
  await wait(minimumMs);
};