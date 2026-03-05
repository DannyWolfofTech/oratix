import { useState, useEffect, useRef, useCallback } from "react";
import { X, Minus, Plus, FlipHorizontal2, Pause, Play, Mic, MicOff, Video, VideoOff, ArrowUp, EyeOff } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLanguage } from "@/hooks/useLanguage";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

interface TeleprompterViewProps {
  content: string;
  onClose: () => void;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

const TeleprompterView = ({ content, onClose }: TeleprompterViewProps) => {
  const isMobile = useIsMobile();
  const { t, lang } = useLanguage();
  const [speed, setSpeed] = useState(1.5);
  const [fontSize, setFontSize] = useState(() => (window.innerWidth < 768 ? 28 : 42));
  const [mirrored, setMirrored] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceLang, setVoiceLang] = useState<"en-US" | "ro-RO">(lang === "ro" ? "ro-RO" : "en-US");
  const [isRecording, setIsRecording] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const recognitionRef = useRef<any>(null);
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
  // At 1x: ~1 line every 2.5s (slow deliberate pace). Speed scales linearly.
  useEffect(() => {
    let lastTime = performance.now();
    const scroll = (now: number) => {
      const delta = now - lastTime;
      lastTime = now;
      if (scrollRef.current && playingRef.current) {
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
      if (e.key === "ArrowUp") setSpeed((s) => Math.min(s + 0.5, 10));
      if (e.key === "ArrowDown") setSpeed((s) => Math.max(s - 0.5, 1));
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
        setSpeed((s) => Math.min(Math.round((s + 0.5) * 10) / 10, 10));
      } else {
        setSpeed((s) => Math.max(Math.round((s - 0.5) * 10) / 10, 1));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Auto-hide controls
  const handleMouseMove = () => {
    if (isMobile) return;
    setShowControls(true);
    clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, 3000);
  };

  const handleTap = () => {
    if (!isMobile) return;
    setShowControls((prev) => !prev);
  };

  useEffect(() => {
    if (playing) {
      const delay = isMobile ? 0 : 3000;
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), delay);
    } else {
      setShowControls(true);
    }
    return () => clearTimeout(controlsTimeoutRef.current);
  }, [playing, isMobile]);

  // Unified voice recognition: commands + pace adaptation
  const startVoice = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.onend = null; recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = voiceLang;

    const wordTimestamps: number[] = [];
    const WINDOW_MS = 2000;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const now = Date.now();
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const transcript = event.results[i][0].transcript.trim();
          const lower = transcript.toLowerCase();

          if (lower.includes("start") || lower.includes("pornește") || lower.includes("play")) {
            setPlaying(true);
          } else if (lower.includes("stop") || lower.includes("oprește") || lower.includes("pause") || lower.includes("pauză")) {
            setPlaying(false);
          } else if (lower.includes("restart") || lower.includes("repornește") || lower.includes("reset")) {
            if (scrollRef.current) scrollRef.current.scrollTop = 0;
            setPlaying(true);
          }

          const wordCount = transcript.split(/\s+/).filter(Boolean).length;
          for (let w = 0; w < wordCount; w++) {
            wordTimestamps.push(now);
          }

          while (wordTimestamps.length > 0 && now - wordTimestamps[0] > WINDOW_MS) {
            wordTimestamps.shift();
          }

          if (wordTimestamps.length >= 2) {
            const windowStart = wordTimestamps[0];
            const elapsed = (now - windowStart) / 1000;
            if (elapsed > 0.5) {
              const wps = wordTimestamps.length / elapsed;
              const mappedSpeed = Math.round(Math.min(10, Math.max(1, wps * 2.5)) * 2) / 2;
              setSpeed(mappedSpeed);
            }
          }
        }
      }
    };

    let stopped = false;
    recognition.onend = () => {
      if (!stopped && recognitionRef.current === recognition) {
        try { recognition.start(); } catch { stopped = true; setVoiceActive(false); recognitionRef.current = null; }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed" || event.error === "aborted") {
        stopped = true;
        setVoiceActive(false);
        recognitionRef.current = null;
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setVoiceActive(true);
    } catch {
      setVoiceActive(false);
      recognitionRef.current = null;
    }
  }, [voiceLang]);

  const stopVoice = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    setVoiceActive(false);
  }, []);

  useEffect(() => { return () => { stopVoice(); }; }, [stopVoice]);

  const toggleLang = () => {
    const newLang = voiceLang === "en-US" ? "ro-RO" : "en-US";
    setVoiceLang(newLang);
    if (voiceActive) stopVoice();
  };

  const prevLangRef = useRef(voiceLang);
  useEffect(() => {
    if (prevLangRef.current !== voiceLang && !voiceActive) {
      const timer = setTimeout(() => startVoice(), 150);
      prevLangRef.current = voiceLang;
      return () => clearTimeout(timer);
    }
    prevLangRef.current = voiceLang;
  }, [voiceLang, voiceActive, startVoice]);

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
      toast.info(t("saving") || "Se salvează...");
      setTimeout(() => {
        const chunks = chunksRef.current;
        chunksRef.current = [];
        if (chunks.length === 0) { toast.error(t("recordingError")); return; }
        const blob = new Blob(chunks, { type: mimeType });
        if (blob.size === 0) { toast.error(t("recordingError")); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        const ext = mimeType.includes("mp4") ? "mp4" : "webm";
        a.download = `teleprompt-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(t("recordingSaved"));
      }, 300);
    };

    mediaRecorderRef.current = recorder;
    recorder.start(500);
    setIsRecording(true);
  }, [cameraStream, t]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

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

  const startRecordAndScroll = useCallback(async () => {
    if (!cameraStream) await openCamera();
    startRecording();
    startPlayWithCountdown();
  }, [cameraStream, openCamera, startRecording, startPlayWithCountdown]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
      }
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 bg-teleprompter-bg flex flex-col"
      onMouseMove={handleMouseMove}
      onClick={handleTap}
    >
      {/* Controls overlay */}
      <div
        className={`absolute top-0 left-0 right-0 z-30 p-3 sm:p-4 transition-opacity duration-500 max-h-[60vh] overflow-y-auto ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.95) 80%, transparent)" }}
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
                className="p-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition"
              >
                {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <button
                onClick={() => setMirrored(!mirrored)}
                className={`p-2.5 rounded-lg transition-colors ${
                  mirrored ? "bg-primary text-primary-foreground" : "bg-secondary/80 text-foreground hover:text-primary"
                }`}
              >
                <FlipHorizontal2 className="w-5 h-5" />
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-2.5 rounded-lg bg-secondary/80 text-foreground hover:text-destructive transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Speed slider */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-muted-foreground w-14 shrink-0">{t("speed")}</span>
            <button onClick={() => setSpeed((s) => Math.max(s - 0.5, 1))} className="p-1 text-foreground hover:text-primary">
              <Minus className="w-4 h-4" />
            </button>
            <Slider value={[speed]} onValueChange={([v]) => setSpeed(v)} min={1} max={10} step={0.5} className="flex-1" />
            <button onClick={() => setSpeed((s) => Math.min(s + 0.5, 10))} className="p-1 text-foreground hover:text-primary">
              <Plus className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono text-foreground w-8 text-right">{speed}x</span>
          </div>

          {/* Font size slider */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-muted-foreground w-14 shrink-0">{t("size")}</span>
            <button onClick={() => setFontSize((s) => Math.max(s - 4, 16))} className="p-1 text-foreground hover:text-primary text-xs font-mono">A</button>
            <Slider value={[fontSize]} onValueChange={([v]) => setFontSize(v)} min={16} max={80} step={2} className="flex-1" />
            <button onClick={() => setFontSize((s) => Math.min(s + 4, 80))} className="p-1 text-foreground hover:text-primary text-base font-mono font-bold">A</button>
            <span className="text-xs font-mono text-foreground w-8 text-right">{fontSize}px</span>
          </div>

          {/* Voice & Recording controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={voiceActive ? stopVoice : startVoice}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                voiceActive
                  ? "bg-primary text-primary-foreground animate-pulse"
                  : "bg-secondary/80 text-foreground hover:text-primary"
              }`}
            >
              {voiceActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              {voiceActive ? t("voiceOn") : t("voicePace")}
            </button>
            <button
              onClick={toggleLang}
              className="px-3 py-1.5 rounded-lg bg-secondary/80 text-foreground text-xs font-medium hover:text-primary transition-colors"
            >
              {voiceLang === "en-US" ? "🇬🇧 EN" : "🇷🇴 RO"}
            </button>
            {!cameraStream ? (
              <button
                onClick={openCamera}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary/80 text-foreground hover:text-primary transition-colors"
              >
                <Video className="w-4 h-4" />
                {t("openCamera")}
              </button>
            ) : !isRecording ? (
              <>
                <button
                  onClick={startRecording}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive text-destructive-foreground hover:opacity-90 transition-colors"
                >
                  <Video className="w-4 h-4" />
                  {t("startRecording")}
                </button>
                <button
                  onClick={closeCamera}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary/80 text-foreground hover:text-primary transition-colors"
                >
                  <VideoOff className="w-4 h-4" />
                  {t("closeCamera")}
                </button>
              </>
            ) : (
              <button
                onClick={stopRecording}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive text-destructive-foreground animate-pulse transition-colors"
              >
                <VideoOff className="w-4 h-4" />
                {t("stopRecording")}
              </button>
            )}
            {voiceActive && (
              <span className="text-xs text-muted-foreground">{t("adaptingSpeed")}</span>
            )}
          </div>
        </div>
      </div>

      {/* Camera preview */}
      {cameraStream && cameraVisible && (
        <div
          onClick={(e) => { e.stopPropagation(); setCameraVisible(false); }}
          className="fixed top-3 right-3 z-20 rounded-xl overflow-hidden border-2 border-primary/30 shadow-xl cursor-pointer w-40 h-[213px] sm:w-64 sm:h-[341px]"
          title={t("togglePreview") || "Hide preview"}
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover mirror-text"
          />
          {isRecording && (
            <div className="absolute top-1.5 left-1.5 w-3 h-3 rounded-full bg-destructive animate-pulse border border-destructive-foreground" />
          )}
        </div>
      )}
      {cameraStream && !cameraVisible && (
        <button
          onClick={(e) => { e.stopPropagation(); setCameraVisible(true); }}
          className="fixed top-3 right-3 z-20 p-2 rounded-lg bg-secondary/80 text-foreground hover:text-primary transition-colors"
          title={t("togglePreview") || "Show preview"}
        >
          <EyeOff className="w-5 h-5" />
        </button>
      )}

      {/* Reading guide - subtle horizontal bar at top 20% */}
      <div className="absolute left-0 right-0 z-[24] pointer-events-none" style={{ top: '18%' }}>
        <div className="w-full h-1 bg-primary/15 rounded-full" />
      </div>

      {/* Countdown overlay */}
      {countdown !== null && (
        <div className="absolute inset-0 z-[35] flex items-center justify-center pointer-events-none">
          <span className="text-[120px] font-bold text-primary animate-pulse drop-shadow-lg">{countdown}</span>
        </div>
      )}

      {/* Scrolling text */}
      <div ref={scrollRef} className="flex-1 overflow-hidden fade-mask relative z-[25]" style={{ scrollBehavior: 'auto' }}>
        <div
          className={`max-w-4xl mx-auto px-4 sm:px-8 pt-[10vh] pb-[50vh] ${mirrored ? "mirror-text" : ""}`}
          style={{ fontSize: `${fontSize}px`, lineHeight: "1.5" }}
        >
          <p className="text-teleprompter-text font-sans font-medium whitespace-pre-wrap">
            {content}
          </p>
        </div>
      </div>

      {/* Back to Top button */}
      {showBackToTop && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30">
          <button
            onClick={(e) => { e.stopPropagation(); scrollToTop(); }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-lg hover:opacity-90 transition"
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
