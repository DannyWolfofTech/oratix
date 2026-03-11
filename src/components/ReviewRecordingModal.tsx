import { useState, useEffect, useRef, useCallback } from "react";
import { Download, X, Share2 } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";

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

export async function storeBlob(blob: Blob, mimeType: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put({ blob, mimeType, timestamp: Date.now() }, DB_KEY);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadBlob(): Promise<{ blob: Blob; mimeType: string } | null> {
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
  onClose: () => void;
}

const ReviewRecordingModal = ({ blob, mimeType, onClose }: ReviewRecordingModalProps) => {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeBlob, setActiveBlob] = useState<Blob | null>(blob);
  const [activeMime, setActiveMime] = useState(mimeType);

  // On mount: persist blob to IndexedDB, or recover from it
  useEffect(() => {
    const init = async () => {
      if (blob && blob.size > 0) {
        setActiveBlob(blob);
        setActiveMime(mimeType);
        await storeBlob(blob, mimeType);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      } else {
        // Try to recover from IndexedDB
        const stored = await loadBlob();
        if (stored) {
          setActiveBlob(stored.blob);
          setActiveMime(stored.mimeType);
          const url = URL.createObjectURL(stored.blob);
          setPreviewUrl(url);
        }
      }
    };
    init();

    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = useCallback(async () => {
    if (!activeBlob) return;
    setSaving(true);

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const ext = activeMime.includes("mp4") ? "mp4" : "webm";
    const fileName = `TelePrompt_Recording_${timestamp}.${ext}`;

    // Strategy 1: Native share (mobile)
    if (navigator.share && navigator.canShare) {
      try {
        const file = new File([activeBlob], fileName, { type: activeMime });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "TelePrompt Recording" });
          toast.success(t("recordingSaved"), { duration: 6000 });
          await clearBlob();
          setSaving(false);
          onClose();
          return;
        }
      } catch (err: any) {
        if (err?.name === "AbortError") {
          toast.info(t("shareCancelled"));
        }
      }
    }

    // Strategy 2: Anchor download
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
    // Don't clear IndexedDB immediately — keep as backup until user dismisses
    setSaving(false);
    // Close the modal after download is triggered
    onClose();
  }, [activeBlob, activeMime, t, onClose]);

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
            <video
              ref={videoPreviewRef}
              src={previewUrl}
              controls
              playsInline
              className="w-full rounded-xl bg-black aspect-video"
            />
          ) : (
            <div className="w-full aspect-video bg-secondary/30 rounded-xl flex items-center justify-center">
              <p className="text-sm text-muted-foreground">{t("loading")}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex flex-col gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !activeBlob}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-base hover:bg-primary/90 disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {isMobile ? <Share2 className="w-5 h-5" /> : <Download className="w-5 h-5" />}
            {saving ? t("saving") : t("saveToDevice")}
          </button>

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
