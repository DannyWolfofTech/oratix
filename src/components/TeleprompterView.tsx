import { useState, useEffect, useRef, useCallback } from "react";
import { X, Minus, Plus, Pause, Play, Video, VideoOff, ArrowUp, EyeOff, Maximize, Minimize, Palette } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLanguage } from "@/hooks/useLanguage";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const speedRef = useRef(speed);
  const fontSizeRef = useRef(fontSize);
  const playingRef = useRef(playing);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Keep refs in sync
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { fontSizeRef.current = fontSize; }, [fontSize]);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  const isTouchingRef = useRef(isTouching);
  useEffect(() => { isTouchingRef.current = isTouching; }, [isTouching]);

  // Assign srcObject whenever cameraStream or visibility changes
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream, cameraVisible]);

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
        const lineH = fontSizeRef.current * 1.5;
        const pxPerMs = (speedRef.current * lineH) / 2500;
        scrollRef.current.scrollTop += pxPerMs * delta;
      }
      animRef.current = requestAnimationFrame(scroll);
    };
    animRef.current = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 },
      });
      setCameraStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      console.error("Camera error:", err);
      if (err instanceof Error && err.name === "NotAllowedError") {
        toast.error(t("cameraNotAvailable"));
      } else {
        toast.error(t("recordingError"));
      }
    }
  }, [t]);

  const closeCamera = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    }
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }
    setCameraStream(null);
    setIsRecording(false);
  }, [cameraStream]);

  // Countdown logic
  const startPlayWithCountdown = useCallback(() => {
    setCountdown(3);
  }, []);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      setPlaying(true);
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const startRecording = useCallback(() => {
    if (!cameraStream) return;
    chunksRef.current = [];

    const mimeType = MediaRecorder.isTypeSupported("video/mp4")
      ? "video/mp4"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : MediaRecorder.isTypeSupported("video/webm")
      ? "video/webm"
      : "";

    if (!mimeType) {
      toast.error(t("recordingError"));
      return;
    }

    const recorder = new MediaRecorder(cameraStream, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      toast.info(t("saving"));
      setTimeout(async () => {
        const chunks = chunksRef.current;
        chunksRef.current = [];
        if (chunks.length === 0) { toast.error(t("recordingError")); return; }
        const blob = new Blob(chunks, { type: mimeType });
        if (blob.size === 0) { toast.error(t("recordingError")); return; }
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const ext = mimeType.includes("mp4") ? "mp4" : "webm";
        const fileName = `TelePrompt_Recording_${timestamp}.${ext}`;

        // Strategy 1: Use native share/save (works reliably on mobile)
        if (navigator.share && navigator.canShare) {
          try {
            const file = new File([blob], fileName, { type: mimeType });
            if (navigator.canShare({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: "TelePrompt Recording",
              });
              toast.success(t("recordingSaved"));
              return;
            }
          } catch (err: any) {
            // User cancelled share — fall through to download
            if (err?.name === "AbortError") {
              toast.info(t("shareCancelled"));
              // Still fall through to offer download
            }
          }
        }

        // Strategy 2: Anchor download fallback
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();

        // Give mobile browsers more time before cleanup
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 5000);

        toast.success(t("recordingSavedCheck"), { duration: 8000 });
      }, 500);
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
    startPlayWithCountdown();
  }, [cameraStream, t, startPlayWithCountdown]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setPlaying(false);
    setCountdown(null);
  }, []);

  const startRecordAndScroll = useCallback(async () => {
    if (!cameraStream) await openCamera();
    startRecording();
  }, [cameraStream, openCamera, startRecording]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
      }
    };
  }, []);

  const isFullscreenCamera = !!(cameraStream && cameraMode === "fullscreen");
  const isFraming = !!(cameraStream && !isRecording && !playing && countdown === null && cameraMode === "fullscreen");

  // Warn users in Facebook/Messenger in-app browsers
  useEffect(() => {
    const ua = navigator.userAgent || "";
    if (/FBAN|FBAV/i.test(ua)) {
      toast.warning(t("inAppBrowserWarning"), { duration: 10000 });
    }
  }, [t]);

  return (
    <div
      className="fixed inset-0 z-50 bg-teleprompter-bg flex flex-col"
      onMouseMove={handleMouseMove}
      onClick={handleTap}
    >
      {/* Controls overlay */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`fixed top-0 left-0 right-0 z-[100] p-3 sm:p-4 transition-opacity duration-500 max-h-[60vh] overflow-y-auto bg-background/40 backdrop-blur-xl border-b border-white/10 shadow-lg ${
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
                className="p-3 rounded-full bg-foreground text-background hover:opacity-80 transition"
              >
                {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-3 rounded-full bg-secondary/50 hover:bg-secondary/80 border border-white/5 text-foreground hover:text-destructive transition"
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
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all ${
                    textColor === key
                      ? "bg-foreground text-background ring-2 ring-foreground/50 scale-105"
                      : "bg-secondary/50 hover:bg-secondary/80 border border-white/5 text-foreground"
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full border border-white/20 shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  {t(label)}
                </button>
              ))}
            </div>
          </div>


          {/* Recording controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {!cameraStream ? (
              <button
                onClick={openCamera}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium bg-secondary/50 hover:bg-secondary/80 border border-white/5 text-foreground transition-colors"
              >
                <Video className="w-4 h-4" />
                {t("openCamera")}
              </button>
            ) : !isRecording ? (
              <>
                <button
                  onClick={startRecording}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium bg-destructive text-destructive-foreground hover:opacity-90 shadow-[0_0_15px_hsl(var(--destructive)/0.5)] transition-colors"
                >
                  <Video className="w-4 h-4" />
                  {t("startRecording")}
                </button>
                <button
                  onClick={() => setCameraMode((m) => m === "fullscreen" ? "corner" : "fullscreen")}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium bg-secondary/50 hover:bg-secondary/80 border border-white/5 text-foreground transition-colors"
                >
                  {cameraMode === "fullscreen" ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                  {cameraMode === "fullscreen" ? t("cornerView") : t("fullscreenView")}
                </button>
                <button
                  onClick={closeCamera}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium bg-secondary/50 hover:bg-secondary/80 border border-white/5 text-foreground transition-colors"
                >
                  <VideoOff className="w-4 h-4" />
                  {t("closeCamera")}
                </button>
              </>
            ) : (
              <button
                onClick={stopRecording}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium bg-destructive text-destructive-foreground animate-pulse shadow-[0_0_15px_hsl(var(--destructive)/0.5)] transition-colors"
              >
                <VideoOff className="w-4 h-4" />
                {t("stopRecording")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Camera preview - fullscreen or corner based on cameraMode */}
      {cameraStream && cameraVisible && (
        <div
          onClick={(e) => { e.stopPropagation(); if (cameraMode === "fullscreen") handleTap(); else setCameraVisible(false); }}
          className={`fixed overflow-hidden shadow-2xl transition-all duration-500 ease-in-out ${
            cameraMode === "fullscreen"
              ? "inset-0 z-[10] w-full h-full bg-black rounded-none border-none"
              : "top-3 right-3 z-[20] rounded-2xl ring-1 ring-white/10 cursor-pointer w-40 h-[213px] sm:w-64 sm:h-[341px]"
          }`}
          title={cameraMode === "corner" ? (t("togglePreview") || "Hide preview") : undefined}
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          {isRecording && (
            <div className="absolute top-1.5 left-1.5 w-3 h-3 rounded-full bg-destructive animate-pulse border border-destructive-foreground" />
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
        className={`flex-1 overflow-hidden fade-mask relative z-[25] transition-opacity duration-300 ${isFraming ? "opacity-0 pointer-events-none" : "opacity-100"}`}
        style={{ scrollBehavior: 'auto' }}
        onTouchStart={() => setIsTouching(true)}
        onTouchEnd={() => setIsTouching(false)}
        onMouseDown={() => setIsTouching(true)}
        onMouseUp={() => setIsTouching(false)}
        onMouseLeave={() => setIsTouching(false)}
      >
        <div
          className={`max-w-4xl mx-auto px-4 sm:px-8 pt-[10vh] pb-[120vh] ${isFullscreenCamera ? "bg-black/40 backdrop-blur-sm rounded-2xl" : ""}`}
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
    </div>
  );
};

export default TeleprompterView;
