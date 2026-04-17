import { useState, useEffect, useRef, useCallback } from "react";
import { X, Minus, Plus, Pause, Play, Video, VideoOff, ArrowUp, EyeOff, Maximize, Minimize, Palette, RefreshCw } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLanguage } from "@/hooks/useLanguage";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import ReviewRecordingModal, { storeBlob, loadBlob } from "@/components/ReviewRecordingModal";
import { finalizeRecordingBlob, getPreferredRecordingMimeType, waitForFinalizationWindow } from "@/lib/recording";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface TeleprompterViewProps {
  content: string;
  onClose: () => void;
}

const TeleprompterView = ({ content, onClose }: TeleprompterViewProps) => {
  const isMobile = useIsMobile();
  const { t } = useLanguage();
  const [speed, setSpeed] = useState(1.5);
  const [fontSize, setFontSize] = useState(() => (window.innerWidth < 768 ? 28 : 42));
  const [playing, setPlaying] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(true);
  const [cameraMode, setCameraMode] = useState<"corner" | "fullscreen">("fullscreen");
  const [isTouching, setIsTouching] = useState(false);
  const [textColor, setTextColor] = useState<"white" | "red" | "blue">("white");
  const [isWebView] = useState(() => /FBAN|FBAV|Instagram|Line\/|MicroMessenger|Snapchat/i.test(navigator.userAgent || ""));
  const [reviewBlob, setReviewBlob] = useState<Blob | null>(null);
  const [reviewMime, setReviewMime] = useState("");
  const [reviewDetectedDurationMs, setReviewDetectedDurationMs] = useState<number | null>(null);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [processingStage, setProcessingStage] = useState<"processing" | "finalizing" | null>(null);
  const [cameraBlockedOpen, setCameraBlockedOpen] = useState(false);
  const [showHowToFix, setShowHowToFix] = useState(false);
  const [blackScreenDetected, setBlackScreenDetected] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<"idle" | "asking" | "granted" | "denied" | "notfound">("idle");
  const blackScreenCheckRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const speedRef = useRef(speed);
  const fontSizeRef = useRef(fontSize);
  const playingRef = useRef(playing);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number>(0);
  const pendingRecordRef = useRef(false);
  // Used by startRecordAndScroll to kick off recording once the camera stream is available.
  const pendingCameraRecordRef = useRef(false);
  const requestDataIntervalRef = useRef<number | null>(null);

  const clearRequestDataInterval = useCallback(() => {
    if (requestDataIntervalRef.current !== null) {
      window.clearInterval(requestDataIntervalRef.current);
      requestDataIntervalRef.current = null;
    }
  }, []);

  // Keep refs in sync
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { fontSizeRef.current = fontSize; }, [fontSize]);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  const isTouchingRef = useRef(isTouching);
  useEffect(() => { isTouchingRef.current = isTouching; }, [isTouching]);

  // Assign srcObject whenever cameraStream changes
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream, cameraVisible]);

  // Moved: pendingCameraRecord effect is placed after startRecording declaration

  // Show Back to Top when paused and not at top
  useEffect(() => {
    if (!playing && scrollRef.current && scrollRef.current.scrollTop > 100) {
      setShowBackToTop(true);
    } else if (playing) {
      setShowBackToTop(false);
    }
  }, [playing]);

  // Detect scroll reaching the end
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 50;
      if (atBottom && playing) {
        setPlaying(false);
        setShowBackToTop(true);
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [playing]);

  const scrollToTop = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
    setShowBackToTop(false);
  }, []);

  // Font-relative scrolling via requestAnimationFrame
  useEffect(() => {
    let lastTime = performance.now();
    const scroll = (now: number) => {
      const delta = now - lastTime;
      lastTime = now;
      if (scrollRef.current && playingRef.current && !isTouchingRef.current) {
        // 1x speed = one line every 2.5s (line height = fontSize * 1.5)
        const lineH = fontSizeRef.current * 1.5;
        const pxPerMs = (speedRef.current * lineH) / 2500;
        scrollRef.current.scrollTop += pxPerMs * delta;
      }
      animRef.current = requestAnimationFrame(scroll);
    };
    animRef.current = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  // Keep a ref to reviewBlob for close guards
  const reviewBlobRef = useRef<Blob | null>(null);
  useEffect(() => { reviewBlobRef.current = reviewBlob; }, [reviewBlob]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Don't close teleprompter while review modal is open
        if (reviewBlobRef.current) return;
        onClose();
      }
      if (e.key === " ") { e.preventDefault(); setPlaying((p) => !p); }
      if (e.key === "ArrowUp") setSpeed((s) => Math.min(Math.round((s + 0.1) * 10) / 10, 10));
      if (e.key === "ArrowDown") setSpeed((s) => Math.max(Math.round((s - 0.1) * 10) / 10, 0.5));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Mouse wheel speed control
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        setSpeed((s) => Math.min(Math.round((s + 0.1) * 10) / 10, 10));
      } else {
        setSpeed((s) => Math.max(Math.round((s - 0.1) * 10) / 10, 0.5));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Auto-hide controls
  const handleMouseMove = () => {
    if (isMobile) return;
    if (countdown !== null) return;
    setShowControls(true);
    clearTimeout(controlsTimeoutRef.current);
    if (playing) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  const handleTap = () => {
    if (!isMobile) return;
    if (countdown !== null) return;
    if (cameraMode === "fullscreen" && !playing && !isRecording) {
      setShowControls(true);
      return;
    }
    setShowControls((prev) => !prev);
  };

  useEffect(() => {
    if (countdown !== null) {
      setShowControls(false);
    } else if (playing) {
      const delay = isMobile ? 0 : 3000;
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), delay);
    } else {
      setShowControls(true);
    }
    return () => clearTimeout(controlsTimeoutRef.current);
  }, [playing, isMobile, countdown]);

  // Camera: open/close separately from recording
  const openCamera = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error(t("cameraNotAvailable"));
      console.error("mediaDevices API not available – possibly blocked by Permissions-Policy or insecure context");
      setPermissionStatus("denied");
      return;
    }
    setPermissionStatus("asking");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 },
      });
      setCameraStream(stream);
      setBlackScreenDetected(false);
      setPermissionStatus("granted");
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      console.error("Camera error:", err);
      if (err instanceof Error && err.name === "NotAllowedError") {
        setPermissionStatus("denied");
        setCameraBlockedOpen(true);
      } else if (err instanceof Error && err.name === "NotFoundError") {
        setPermissionStatus("notfound");
        toast.error(t("permNotFoundBanner"), { duration: 8000 });
      } else {
        setPermissionStatus("denied");
        toast.error(t("recordingError"));
      }
    }
  }, [t]);

  // Black screen detection: sample pixels after camera opens
  useEffect(() => {
    if (!cameraStream || !videoRef.current) {
      setBlackScreenDetected(false);
      if (blackScreenCheckRef.current) clearInterval(blackScreenCheckRef.current);
      return;
    }
    if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
    const canvas = canvasRef.current;
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext("2d");
    let checks = 0;

    blackScreenCheckRef.current = window.setInterval(() => {
      checks++;
      if (!videoRef.current || !ctx || !cameraStream) return;
      ctx.drawImage(videoRef.current, 0, 0, 16, 16);
      const data = ctx.getImageData(0, 0, 16, 16).data;
      let totalBrightness = 0;
      for (let i = 0; i < data.length; i += 4) {
        totalBrightness += data[i] + data[i + 1] + data[i + 2];
      }
      const avgBrightness = totalBrightness / (16 * 16 * 3);
      if (avgBrightness < 5 && checks >= 8) {
        setBlackScreenDetected(true);
      } else if (avgBrightness >= 5) {
        setBlackScreenDetected(false);
      }
      // Stop checking after 10 checks (~5 seconds)
      if (checks >= 10 && blackScreenCheckRef.current) {
        clearInterval(blackScreenCheckRef.current);
      }
    }, 500);

    return () => {
      if (blackScreenCheckRef.current) clearInterval(blackScreenCheckRef.current);
    };
  }, [cameraStream, cameraVisible]);

  const resetCamera = useCallback(async () => {
    // Stop current stream
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }
    setCameraStream(null);
    setBlackScreenDetected(false);
    // Re-open after a small delay
    await new Promise((r) => setTimeout(r, 300));
    await openCamera();
  }, [cameraStream, openCamera]);

  const closeCamera = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      // Wait for onstop to fire before killing tracks
      const origOnStop = recorder.onstop;
      recorder.onstop = (ev) => {
        if (origOnStop) origOnStop.call(recorder, ev);
        if (cameraStream) {
          cameraStream.getTracks().forEach((track) => track.stop());
        }
        setCameraStream(null);
      };
      try { recorder.stop(); } catch { /* ignore */ }
      setIsRecording(false);
    } else {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
      setCameraStream(null);
      setIsRecording(false);
    }
  }, [cameraStream]);

  // Countdown logic
  const startPlayWithCountdown = useCallback(() => {
    setCountdown(3);
  }, []);

  const actuallyStartRecorder = useCallback(() => {
    if (!cameraStream) return;
    chunksRef.current = [];

    // Broad codec fallback for maximum mobile compatibility (audio codec errors)
    const mimeType = getPreferredRecordingMimeType();

    if (!mimeType) { toast.error(t("recordingError")); return; }
    console.log("[Recording] Using codec:", mimeType);

    const recorderOptions: MediaRecorderOptions = { mimeType };
    // Set a reasonable bitrate for mobile devices
    try {
      recorderOptions.videoBitsPerSecond = 2_500_000; // 2.5 Mbps
      recorderOptions.audioBitsPerSecond = 128_000;
    } catch { /* ignore if unsupported */ }

    const recorder = new MediaRecorder(cameraStream, recorderOptions);
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      clearRequestDataInterval();
      const chunks = chunksRef.current;
      chunksRef.current = [];
      if (chunks.length === 0) { toast.error(t("recordingError")); setProcessingStage(null); return; }
      const rawBlob = new Blob(chunks, { type: mimeType });
      if (rawBlob.size === 0) { toast.error(t("recordingError")); setProcessingStage(null); return; }

      const duration = Date.now() - recordingStartRef.current;
      // recordingStartRef is set after the countdown, so `duration` is already the
      // true recording length — no need to subtract the countdown period again.
      const durationForMetadataMs = Math.max(duration, 1000);
      setProcessingStage("finalizing");

      const finalize = async (blob: Blob, detectedDurationMs: number | null) => {
        try {
          await storeBlob(blob, mimeType, detectedDurationMs);
        } catch { /* best effort */ }
        setProcessingStage(null);
        setReviewBlob(blob);
        setReviewMime(mimeType);
        setReviewDetectedDurationMs(detectedDurationMs);
      };

      const [finalizedRecording] = await Promise.all([
        finalizeRecordingBlob(rawBlob, mimeType, durationForMetadataMs),
        waitForFinalizationWindow(2500),
      ]);

      await finalize(finalizedRecording.blob, finalizedRecording.detectedDurationMs);
    };

    recorder.onerror = (event) => {
      clearRequestDataInterval();
      console.error("[Recording] MediaRecorder error:", event);
      toast.error(t("recordingError"));
      setIsRecording(false);
      setProcessingStage(null);
    };

    mediaRecorderRef.current = recorder;
    recordingStartRef.current = Date.now();
    recorder.start(1000); // 1-second timeslices to prevent data loss
    requestDataIntervalRef.current = window.setInterval(() => {
      try {
        if (recorder.state === "recording") {
          recorder.requestData();
        }
      } catch (error) {
        console.warn("[Recording] requestData failed", error);
      }
    }, 1000);
    setIsRecording(true);
  }, [cameraStream, clearRequestDataInterval, t]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      setPlaying(true);
      if (pendingRecordRef.current) {
        pendingRecordRef.current = false;
        actuallyStartRecorder();
      }
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(timer);
  }, [countdown, actuallyStartRecorder]);

  const startRecording = useCallback(() => {
    if (!cameraStream) return;
    pendingRecordRef.current = true;
    startPlayWithCountdown();
  }, [cameraStream, startPlayWithCountdown]);

  // When startRecordAndScroll requested recording before the camera was open,
  // trigger it now that cameraStream is available.
  useEffect(() => {
    if (cameraStream && pendingCameraRecordRef.current) {
      pendingCameraRecordRef.current = false;
      startRecording();
    }
  }, [cameraStream, startRecording]);

  const stopRecording = useCallback(() => {
    pendingRecordRef.current = false;
    const wasRecording = mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive";
    if (wasRecording) {
      try {
        mediaRecorderRef.current?.requestData();
      } catch (error) {
        console.warn("[Recording] final requestData failed", error);
      }
      clearRequestDataInterval();
      mediaRecorderRef.current!.stop();
      setProcessingStage("processing");
    }
    setIsRecording(false);
    setPlaying(false);
    setCountdown(null);
  }, [clearRequestDataInterval]);

  const startRecordAndScroll = useCallback(async () => {
    if (!cameraStream) {
      // Set the flag BEFORE awaiting; the useEffect above will call startRecording()
      // once cameraStream state is set, avoiding the stale-closure race condition.
      pendingCameraRecordRef.current = true;
      await openCamera();
    } else {
      startRecording();
    }
  }, [cameraStream, openCamera, startRecording]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        clearRequestDataInterval();
        try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
      }
    };
  }, [clearRequestDataInterval]);

  // Recover orphaned recording from IndexedDB on mount
  useEffect(() => {
    const recover = async () => {
      if (reviewBlob) return; // already have one
      const stored = await loadBlob();
      if (stored && stored.blob.size > 0) {
        setReviewBlob(stored.blob);
        setReviewMime(stored.mimeType);
        setReviewDetectedDurationMs(stored.detectedDurationMs ?? null);
      }
    };
    recover();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recording timer — only ticks while actively recording AND playing (pauses when paused)
  const timerAccumulatedRef = useRef(0);
  const timerLastTickRef = useRef(0);
  useEffect(() => {
    if (!isRecording) {
      setRecordingElapsed(0);
      timerAccumulatedRef.current = 0;
      timerLastTickRef.current = 0;
      return;
    }
    if (!playing) {
      // Paused: accumulate from refs so we don't need recordingElapsed in deps
      // (adding it would restart the interval every second).
      if (timerLastTickRef.current > 0) {
        timerAccumulatedRef.current += Math.floor((Date.now() - timerLastTickRef.current) / 1000);
        timerLastTickRef.current = 0;
        setRecordingElapsed(timerAccumulatedRef.current);
      }
      return;
    }
    // Running: start ticking from accumulated
    timerLastTickRef.current = Date.now();
    const interval = setInterval(() => {
      const elapsed = timerAccumulatedRef.current + Math.floor((Date.now() - timerLastTickRef.current) / 1000);
      setRecordingElapsed(elapsed);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRecording, playing]);

  const formatTime = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  };

  const isFullscreenCamera = !!(cameraStream && cameraMode === "fullscreen");
  const isFraming = !!(cameraStream && !isRecording && !playing && countdown === null && cameraMode === "fullscreen");

  // Warn users in any detected in-app browser (same set as the isWebView banner)
  useEffect(() => {
    if (isWebView) {
      toast.warning(t("inAppBrowserWarning"), { duration: 10000 });
    }
  }, [isWebView, t]);

  return (
    <div
      className="fixed inset-0 z-50 bg-teleprompter-bg flex flex-col"
      style={{ height: "100svh" }}
      onMouseMove={handleMouseMove}
      onClick={handleTap}
    >
      {/* WebView warning banner */}
      {isWebView && (
        <div className="fixed top-0 left-0 right-0 z-[150] bg-destructive text-destructive-foreground text-sm font-semibold text-center px-4 py-3 shadow-lg">
          {t("webviewWarning")}
        </div>
      )}

      {/* Permission denied/notfound banner */}
      {!cameraStream && (permissionStatus === "denied" || permissionStatus === "notfound") && (
        <div className="fixed top-0 left-0 right-0 z-[150] bg-destructive text-destructive-foreground text-sm font-semibold text-center px-4 py-3 shadow-lg flex items-center justify-center gap-3 flex-wrap"
          onClick={(e) => e.stopPropagation()}
        >
          <span>{permissionStatus === "denied" ? t("permDeniedBanner") : t("permNotFoundBanner")}</span>
          {permissionStatus === "denied" && (
            <button
              onClick={() => setCameraBlockedOpen(true)}
              className="px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-sm font-semibold transition-colors shrink-0"
            >
              {t("howToFix")}
            </button>
          )}
        </div>
      )}

      {/* Controls overlay */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`fixed top-0 left-0 right-0 z-[110] p-3 sm:p-4 transition-opacity duration-500 max-h-[60vh] overflow-y-auto bg-background/40 backdrop-blur-xl border-b border-white/10 shadow-lg ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex flex-col gap-3 max-w-3xl mx-auto">
          {/* Top row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (!playing) {
                    startPlayWithCountdown();
                  } else {
                    setPlaying(false);
                  }
                }}
                className="p-3 min-w-[44px] min-h-[44px] rounded-full bg-foreground text-background hover:opacity-80 transition flex items-center justify-center"
              >
                {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
            </div>
            <button
              onClick={() => {
                // Don't close teleprompter while review modal is open
                if (reviewBlob) return;
                onClose();
              }}
              className="p-3 min-w-[44px] min-h-[44px] rounded-full bg-secondary/50 hover:bg-secondary/80 border border-white/5 text-foreground hover:text-destructive transition flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Speed slider */}
          <div className="flex items-center gap-3">
            <span className="uppercase tracking-wider text-[10px] font-mono text-muted-foreground/80 w-14 shrink-0">{t("speed")}</span>
            <button onClick={() => setSpeed((s) => Math.max(Math.round((s - 0.1) * 10) / 10, 0.5))} className="p-1.5 rounded-full bg-secondary/50 hover:bg-secondary/80 border border-white/5 text-foreground transition">
              <Minus className="w-3.5 h-3.5" />
            </button>
            <Slider value={[speed]} onValueChange={([v]) => setSpeed(Math.round(v * 10) / 10)} min={0.5} max={10} step={0.1} className="flex-1" />
            <button onClick={() => setSpeed((s) => Math.min(Math.round((s + 0.1) * 10) / 10, 10))} className="p-1.5 rounded-full bg-secondary/50 hover:bg-secondary/80 border border-white/5 text-foreground transition">
              <Plus className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono text-foreground/90 w-8 text-right">{speed}x</span>
          </div>

          {/* Font size slider */}
          <div className="flex items-center gap-3">
            <span className="uppercase tracking-wider text-[10px] font-mono text-muted-foreground/80 w-14 shrink-0">{t("size")}</span>
            <button onClick={() => setFontSize((s) => Math.max(s - 4, 16))} className="p-1.5 rounded-full bg-secondary/50 hover:bg-secondary/80 border border-white/5 text-foreground text-xs font-mono transition">A</button>
            <Slider value={[fontSize]} onValueChange={([v]) => setFontSize(v)} min={16} max={80} step={2} className="flex-1" />
            <button onClick={() => setFontSize((s) => Math.min(s + 4, 80))} className="p-1.5 rounded-full bg-secondary/50 hover:bg-secondary/80 border border-white/5 text-foreground text-base font-mono font-bold transition">A</button>
            <span className="text-[10px] font-mono text-foreground/90 w-8 text-right">{fontSize}px</span>
          </div>

          {/* Text color picker */}
          <div className="flex items-center gap-3">
            <span className="uppercase tracking-wider text-[10px] font-mono text-muted-foreground/80 w-14 shrink-0 flex items-center gap-1">
              <Palette className="w-3 h-3" />
              {t("textColor")}
            </span>
            <div className="flex items-center gap-2">
              {([
                { key: "white" as const, label: "colorWhite", color: "hsl(0 0% 100%)" },
                { key: "red" as const, label: "colorRed", color: "hsl(0 85% 60%)" },
                { key: "blue" as const, label: "colorBlue", color: "hsl(200 95% 60%)" },
              ] as const).map(({ key, label, color }) => (
                <button
                  key={key}
                  onClick={() => setTextColor(key)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                    textColor === key
                      ? "bg-foreground text-background ring-2 ring-foreground/50 scale-105"
                      : "bg-secondary/50 hover:bg-secondary/80 border border-white/5 text-foreground"
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  {t(label)}
                </button>
              ))}
            </div>
          </div>


          {/* Recording controls */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {!cameraStream ? (
                <button
                  onClick={openCamera}
                  translate="no"
                  className="notranslate flex items-center gap-2 px-5 py-3 rounded-full text-sm font-medium bg-secondary/50 hover:bg-secondary/80 border border-white/5 text-foreground transition-colors"
                >
                  <Video className="w-4 h-4" />
                  {t("openCamera")}
                </button>
              ) : !isRecording ? (
                <>
                  <button
                    onClick={() => setCameraMode((m) => m === "fullscreen" ? "corner" : "fullscreen")}
                    className="flex items-center gap-2 px-5 py-3 rounded-full text-sm font-medium bg-secondary/50 hover:bg-secondary/80 border border-white/5 text-foreground transition-colors"
                  >
                    {cameraMode === "fullscreen" ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                    {cameraMode === "fullscreen" ? t("cornerView") : t("fullscreenView")}
                  </button>
                  <button
                    onClick={closeCamera}
                    className="flex items-center gap-2 px-5 py-3 rounded-full text-sm font-medium bg-secondary/50 hover:bg-secondary/80 border border-white/5 text-foreground transition-colors"
                  >
                    <VideoOff className="w-4 h-4" />
                    {t("closeCamera")}
                  </button>
                </>
              ) : (
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-2 px-5 py-3 rounded-full text-sm font-medium bg-destructive text-destructive-foreground animate-pulse shadow-[0_0_15px_hsl(var(--destructive)/0.5)] transition-colors"
                >
                  <VideoOff className="w-4 h-4" />
                  {t("stopRecording")}
                </button>
              )}
            </div>

            {/* Start Recording - separate row to prevent accidental taps */}
            {cameraStream && !isRecording && (
              <button
                onClick={startRecording}
                translate="no"
                className="notranslate flex items-center justify-center gap-2 w-full px-5 py-3.5 rounded-full text-sm font-semibold bg-destructive text-destructive-foreground hover:opacity-90 shadow-[0_0_15px_hsl(var(--destructive)/0.5)] transition-colors"
              >
                <Video className="w-5 h-5" />
                {t("startRecording")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Camera preview - fullscreen or corner based on cameraMode */}
      {cameraStream && cameraVisible && (
        <div
          onClick={(e) => { e.stopPropagation(); if (cameraMode === "fullscreen") handleTap(); else setCameraVisible(false); }}
          translate="no"
          className={`notranslate fixed overflow-hidden shadow-2xl transition-all duration-500 ease-in-out ${
            cameraMode === "fullscreen"
              ? "inset-0 z-[20] w-full h-full bg-black rounded-none border-none"
              : "top-3 right-3 z-[110] rounded-2xl ring-1 ring-white/10 cursor-pointer w-40 h-[213px] sm:w-64 sm:h-[341px]"
          }`}
          style={cameraMode === "fullscreen" ? { height: "100svh" } : undefined}
          title={cameraMode === "corner" ? (t("togglePreview") || "Hide preview") : undefined}
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            translate="no"
            className="notranslate w-full h-full object-cover"
          />
          {/* Permission status dot - top right */}
          <div className="absolute top-3 right-3 z-[35] flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${
              permissionStatus === "granted" ? "bg-green-500 shadow-[0_0_6px_hsl(142_76%_36%)]" :
              permissionStatus === "asking" ? "bg-yellow-400 animate-pulse" :
              "bg-red-500 shadow-[0_0_6px_hsl(0_84%_60%)]"
            }`} />
            <span className="text-[10px] font-mono text-white/80">
              {permissionStatus === "granted" ? t("permGranted") :
               permissionStatus === "asking" ? t("permAsking") :
               t("permBlocked")}
            </span>
          </div>

          {isRecording && (
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
              <div className="w-3 h-3 rounded-full bg-destructive animate-pulse border border-destructive-foreground" />
              <span className="text-sm font-mono font-semibold text-white tabular-nums">{formatTime(recordingElapsed)}</span>
            </div>
          )}

          {/* Black screen detection banner */}
          {blackScreenDetected && !isRecording && (
            <div className="absolute bottom-4 left-4 right-4 z-[30] flex items-center gap-3 bg-destructive/90 backdrop-blur-sm text-destructive-foreground rounded-xl px-4 py-3 shadow-lg">
              <span className="text-sm font-medium flex-1">{t("blackScreenDetected")}</span>
              <button
                onClick={(e) => { e.stopPropagation(); resetCamera(); }}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 hover:bg-white/30 text-sm font-semibold transition-colors shrink-0"
              >
                <RefreshCw className="w-4 h-4" />
                {t("resetCamera")}
              </button>
            </div>
          )}
        </div>
      )}
      {cameraStream && !cameraVisible && cameraMode === "corner" && (
        <button
          onClick={(e) => { e.stopPropagation(); setCameraVisible(true); }}
          className="fixed top-3 right-3 z-[20] p-3 rounded-full bg-secondary/50 hover:bg-secondary/80 border border-white/5 text-foreground transition-colors"
          title={t("togglePreview") || "Show preview"}
        >
          <EyeOff className="w-5 h-5" />
        </button>
      )}

      {/* Reading guide */}
      <div className="absolute left-0 right-0 z-[24] pointer-events-none" style={{ top: '18%' }}>
        <div className="w-full h-1 bg-foreground/10 rounded-full" />
      </div>

      {/* Countdown overlay */}
      {countdown !== null && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center pointer-events-none">
          <span className="text-[120px] font-bold text-foreground animate-pulse drop-shadow-lg">{countdown}</span>
        </div>
      )}

      {/* Scrolling text */}
      <div
        ref={scrollRef}
        className={`flex-1 overflow-hidden fade-mask relative z-[100] transition-opacity duration-300 ${isFraming ? "opacity-0 pointer-events-none" : "opacity-100"} ${isFullscreenCamera ? "pointer-events-none" : ""}`}
        style={{ scrollBehavior: 'auto' }}
        onTouchStart={() => setIsTouching(true)}
        onTouchEnd={() => setIsTouching(false)}
        onMouseDown={() => setIsTouching(true)}
        onMouseUp={() => setIsTouching(false)}
        onMouseLeave={() => setIsTouching(false)}
      >
        <div
          className={`max-w-4xl mx-auto px-4 sm:px-8 pt-[20vh] pb-[140vh] ${isFullscreenCamera ? "bg-black/30 backdrop-blur-[2px] rounded-2xl" : ""}`}
          style={{ fontSize: `${fontSize}px`, lineHeight: "1.5" }}
        >
          <p
            className="font-sans font-medium whitespace-pre-wrap"
            style={{
              color: textColor === "red"
                ? "hsl(0 85% 60%)"
                : textColor === "blue"
                ? "hsl(200 95% 60%)"
                : "hsl(0 0% 100%)",
              textShadow: isFullscreenCamera
                ? `0 2px 8px rgba(0,0,0,1), 0 0px 20px rgba(0,0,0,0.8), 0 0 4px rgba(0,0,0,0.9)`
                : "0 2px 6px rgba(0,0,0,0.7), 0 0 2px rgba(0,0,0,0.5)",
            }}
          >
            {content}
          </p>
        </div>
      </div>

      {/* Back to Top button */}
      {showBackToTop && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30">
          <button
            onClick={(e) => { e.stopPropagation(); scrollToTop(); }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-foreground text-background text-sm font-medium shadow-lg hover:opacity-80 transition"
          >
            <ArrowUp className="w-4 h-4" />
            {t("backToTop")}
          </button>
        </div>
      )}

      {/* Bottom hint */}
      <div className={`absolute bottom-0 left-0 right-0 z-30 p-3 text-center transition-opacity duration-500 ${showControls ? "opacity-100" : "opacity-0"}`}>
        <p className="text-xs text-muted-foreground">
          {isMobile ? t("mobileHint") : t("desktopHint")}
        </p>
      </div>

      {/* Processing spinner */}
      {processingStage && !reviewBlob && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-lg font-semibold text-white">{t(processingStage === "finalizing" ? "finalizingVideo" : "processingVideo")}</p>
        </div>
      )}

      {/* Review Recording Modal */}
      {reviewBlob && (
        <ReviewRecordingModal
          blob={reviewBlob}
          mimeType={reviewMime}
          detectedDurationMs={reviewDetectedDurationMs}
          onClose={() => { setReviewBlob(null); setReviewMime(""); setReviewDetectedDurationMs(null); }}
        />
      )}

      {/* Camera Blocked Dialog */}
      <Dialog open={cameraBlockedOpen} onOpenChange={setCameraBlockedOpen}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-xl">{t("cameraBlockedTitle")}</DialogTitle>
            <DialogDescription>{t("cameraBlockedDesc")}</DialogDescription>
          </DialogHeader>

          {!showHowToFix ? (
            <div className="flex flex-col gap-3 pt-2">
              <Button onClick={() => setShowHowToFix(true)} variant="default" className="w-full py-3 text-base">
                {t("howToFix")}
              </Button>
              <Button onClick={() => setCameraBlockedOpen(false)} variant="outline" className="w-full py-3">
                {t("close")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4 pt-2">
              <div className="bg-muted rounded-xl p-4 space-y-3">
                <p className="text-sm font-medium">{t("cameraBlockedStep1")}</p>
                <p className="text-sm font-medium">{t("cameraBlockedStep2")}</p>
                <p className="text-sm font-medium">{t("cameraBlockedStep3")}</p>
              </div>
              <Button
                onClick={() => window.location.reload()}
                variant="default"
                className="w-full py-3 text-base gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                {t("refreshPage")}
              </Button>
              <Button onClick={() => { setShowHowToFix(false); setCameraBlockedOpen(false); }} variant="outline" className="w-full py-3">
                {t("close")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeleprompterView;
