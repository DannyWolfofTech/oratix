import { useState, useEffect, useCallback } from "react";
import { Download, X, Share2 } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { measureBlobDuration } from "@/lib/recording";
import { toast } from "sonner";
import RecordingPreviewPlayer from "@/components/RecordingPreviewPlayer";

const DB_NAME = "TelePromptRecordings";
const STORE_NAME = "blobs";
const DB_KEY = "latest_recording";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function storeBlob(blob: Blob, mimeType: string, detectedDurationMs: number | null = null): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put({ blob, mimeType, timestamp: Date.now(), detectedDurationMs }, DB_KEY);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadBlob(): Promise<{ blob: Blob; mimeType: string; detectedDurationMs?: number | null } | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(DB_KEY);
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function clearBlob(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(DB_KEY);
  } catch { /* ignore */ }
}

interface ReviewRecordingModalProps {
  blob: Blob | null;
  mimeType: string;
  detectedDurationMs?: number | null;
  onClose: () => void;
}

const ReviewRecordingModal = ({ blob, mimeType, detectedDurationMs: initialDetectedDurationMs = null, onClose }: ReviewRecordingModalProps) => {
  const { t } = useLanguage();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeBlob, setActiveBlob] = useState<Blob | null>(blob);
  const [activeMime, setActiveMime] = useState(mimeType);
  const [detectedDurationMs, setDetectedDurationMs] = useState<number | null>(initialDetectedDurationMs);

  // On mount: persist blob to IndexedDB, or recover from it
  useEffect(() => {
    // Track the URL created in this effect run so the cleanup can always revoke it,
    // regardless of whether setPreviewUrl has caused a re-render yet.
    let localUrl: string | null = null;

    const init = async () => {
      if (blob && blob.size > 0) {
        setActiveBlob(blob);
        setActiveMime(mimeType);
        setDetectedDurationMs(initialDetectedDurationMs);
        await storeBlob(blob, mimeType, initialDetectedDurationMs);
        localUrl = URL.createObjectURL(blob);
        setPreviewUrl(localUrl);
      } else {
        // Try to recover from IndexedDB
        const stored = await loadBlob();
        if (stored) {
          setActiveBlob(stored.blob);
          setActiveMime(stored.mimeType);
          setDetectedDurationMs(stored.detectedDurationMs ?? null);
          localUrl = URL.createObjectURL(stored.blob);
          setPreviewUrl(localUrl);
        }
      }
    };
    init();

    return () => {
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [blob, initialDetectedDurationMs, mimeType]);

  useEffect(() => {
    let cancelled = false;

    const resolveDuration = async () => {
      if (!activeBlob || detectedDurationMs) return;

      const measuredDuration = await measureBlobDuration(activeBlob);
      if (cancelled) return;

      if (measuredDuration && measuredDuration > 0) {
        const nextDetectedDurationMs = Math.round(measuredDuration * 1000);
        setDetectedDurationMs(nextDetectedDurationMs);
        await storeBlob(activeBlob, activeMime, nextDetectedDurationMs);
      }
    };

    resolveDuration();

    return () => {
      cancelled = true;
    };
  }, [activeBlob, activeMime, detectedDurationMs]);

  const getFileName = useCallback(() => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const ext = activeMime.includes("mp4") ? "mp4" : "webm";
    return `TelePrompt_Recording_${timestamp}.${ext}`;
  }, [activeMime]);

  // For sharing: Messenger and other apps recognize .mp4 better than .webm
  const getShareFileName = useCallback(() => {
    return `oratix-video.mp4`;
  }, []);

  // Detect if the browser can share files (not just URLs/text)
  const [canShareFiles, setCanShareFiles] = useState(false);
  useEffect(() => {
    if (!activeBlob || typeof navigator === "undefined" || !navigator.canShare) {
      setCanShareFiles(false);
      return;
    }
    try {
      const probeFile = new File([activeBlob], getShareFileName(), { type: "video/mp4" });
      setCanShareFiles(navigator.canShare({ files: [probeFile] }));
    } catch {
      setCanShareFiles(false);
    }
  }, [activeBlob, getShareFileName]);

  // Direct download to device
  const handleDownload = useCallback(async () => {
    if (!activeBlob) return;
    setSaving(true);
    const fileName = getFileName();
    const detectedDuration = detectedDurationMs ? detectedDurationMs / 1000 : await measureBlobDuration(activeBlob);
    console.log("[Recording Download]", {
      fileName,
      mimeType: activeMime,
      blobSizeBytes: activeBlob.size,
      detectedDurationSeconds: detectedDuration,
    });
    const url = URL.createObjectURL(activeBlob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 5000);
    toast.success(t("reviewSaveSuccess"), { duration: 10000 });
    setSaving(false);
    onClose();
  }, [activeBlob, activeMime, detectedDurationMs, getFileName, t, onClose]);

  // Share to apps (Drive, Messenger, etc.)
  const handleSave = useCallback(async () => {
    if (!activeBlob) return;
    setSaving(true);
    // Force .mp4 extension + video/mp4 mime so Messenger recognizes the codec immediately
    const fileName = getShareFileName();
    try {
      const file = new File([activeBlob], fileName, { type: "video/mp4" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Oratix Recording" });
        toast.success(t("recordingSaved"), { duration: 6000 });
        await clearBlob();
        setSaving(false);
        onClose();
        return;
      }
      // canShare returned false — show Messenger safety hint
      toast.error(
        "Messenger are uneori erori. Descarcă videoul în telefon și trimite-l direct din Galerie!",
        { duration: 8000 }
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        toast.info(t("shareCancelled"));
      } else {
        // Permission / NotAllowedError on Android/Messenger
        toast.error(
          "Messenger are uneori erori. Descarcă videoul în telefon și trimite-l direct din Galerie!",
          { duration: 8000 }
        );
      }
    }
    setSaving(false);
  }, [activeBlob, getShareFileName, t, onClose]);

  const handleDiscard = useCallback(async () => {
    await clearBlob();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    onClose();
  }, [previewUrl, onClose]);

  if (!previewUrl && !activeBlob) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div
        className="relative w-full max-w-lg bg-background rounded-2xl border border-border shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">{t("reviewTitle")}</h2>
          <button
            onClick={handleDiscard}
            className="p-2 rounded-full hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video preview */}
        <div className="p-4">
          {previewUrl ? (
            <RecordingPreviewPlayer
              src={previewUrl}
              detectedDurationMs={detectedDurationMs}
            />
          ) : (
            <div className="w-full aspect-video bg-secondary/30 rounded-xl flex items-center justify-center">
              <p className="text-sm text-muted-foreground">{t("loading")}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex flex-col gap-3">
          {/* Direct download button */}
          <button
            onClick={handleDownload}
            disabled={saving || !activeBlob}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-base hover:bg-primary/90 disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            <Download className="w-5 h-5" />
            {t("downloadVideo")}
          </button>

          {/* Share to apps (Drive, Messenger, etc.) — only if browser can share files */}
          {canShareFiles && (
            <button
              onClick={handleSave}
              disabled={saving || !activeBlob}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-secondary text-foreground font-medium text-sm hover:bg-secondary/80 border border-border disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              <Share2 className="w-5 h-5" />
              {saving ? t("saving") : t("shareVideo")}
            </button>
          )}

          <button
            onClick={handleDiscard}
            className="w-full py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition"
          >
            {t("discardRecording")}
          </button>

          {/* Help hint */}
          <p className="text-xs text-muted-foreground text-center px-2 leading-relaxed">
            {t("reviewSaveHint")}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReviewRecordingModal;
