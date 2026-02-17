import { useState, useEffect, useRef, useCallback } from "react";
import { X, Minus, Plus, FlipHorizontal2, Pause, Play, Mic, MicOff, Video, VideoOff, ArrowUp } from "lucide-react";
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
  const [showControls, setShowControls] = useState(true);
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceLang, setVoiceLang] = useState<"en-US" | "ro-RO">(lang === "ro" ? "ro-RO" : "en-US");
  const [isRecording, setIsRecording] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const recognitionRef = useRef<any>(null);
  const speedRef = useRef(speed);
  const playingRef = useRef(playing);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Keep refs in sync
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { playingRef.current = playing; }, [playing]);

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

  // Smooth scrolling via requestAnimationFrame
  useEffect(() => {
    const scroll = () => {
      if (scrollRef.current && playingRef.current) {
        scrollRef.current.scrollTop += speedRef.current * 0.3;
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

  // Voice commands recognition
  const startVoiceCommands = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const cmdRecognition = new SpeechRecognition();
    cmdRecognition.continuous = true;
    cmdRecognition.interimResults = false;
    cmdRecognition.lang = voiceLang;
    cmdRecognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const transcript = event.results[i][0].transcript.trim().toLowerCase();
          if (transcript.includes("start") || transcript.includes("pornește") || transcript.includes("play")) {
            setPlaying(true);
          } else if (transcript.includes("stop") || transcript.includes("oprește") || transcript.includes("pause") || transcript.includes("pauză")) {
            setPlaying(false);
          } else if (transcript.includes("restart") || transcript.includes("repornește") || transcript.includes("reset")) {
            if (scrollRef.current) scrollRef.current.scrollTop = 0;
            setPlaying(true);
          }
        }
      }
    };
    cmdRecognition.onend = () => {
      if (recognitionRef.current === cmdRecognition) {
        try { cmdRecognition.start(); } catch { /* ignore */ }
      }
    };
    cmdRecognition.onerror = (event: any) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setVoiceActive(false);
        recognitionRef.current = null;
      }
    };
    recognitionRef.current = cmdRecognition;
    try { cmdRecognition.start(); setVoiceActive(true); } catch { setVoiceActive(false); recognitionRef.current = null; }
  }, [voiceLang]);

  // Voice recognition for speed adaptation
  const startVoice = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = voiceLang;
    let totalWords = 0;
    let sessionStart = Date.now();
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const now = Date.now();
      let finalWordCount = 0;
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalWordCount += event.results[i][0].transcript.trim().split(/\s+/).length;
        }
      }
      if (finalWordCount > totalWords) {
        totalWords = finalWordCount;
        const elapsedSeconds = (now - sessionStart) / 1000;
        if (elapsedSeconds > 1) {
          const wps = totalWords / elapsedSeconds;
          const mappedSpeed = Math.round(Math.min(10, Math.max(1, wps * 2.5)) * 2) / 2;
          setSpeed(mappedSpeed);
        }
      }
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const transcript = event.results[i][0].transcript.trim().toLowerCase();
          if (transcript.includes("restart") || transcript.includes("repornește") || transcript.includes("reset")) {
            if (scrollRef.current) scrollRef.current.scrollTop = 0;
            setPlaying(true);
          } else if (transcript.includes("stop") || transcript.includes("oprește") || transcript.includes("pauză")) {
            setPlaying(false);
          } else if (transcript.includes("start") || transcript.includes("pornește") || transcript.includes("play")) {
            setPlaying(true);
          }
        }
      }
    };
    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setVoiceActive(false);
        recognitionRef.current = null;
      }
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        try { recognition.start(); } catch { setVoiceActive(false); recognitionRef.current = null; }
      }
    };
    recognitionRef.current = recognition;
    try { recognition.start(); setVoiceActive(true); } catch { setVoiceActive(false); recognitionRef.current = null; }
  }, [voiceLang]);

  const stopVoice = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
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

  // Camera recording - rewritten for file integrity
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const mimeType = MediaRecorder.isTypeSupported("video/mp4")
        ? "video/mp4"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "";

      if (!mimeType) {
        toast.error(t("recordingError"));
        stream.getTracks().forEach((track) => track.stop());
        setCameraStream(null);
        return;
      }

      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      // CRITICAL: Download ONLY happens here, after stop is fully complete
      recorder.onstop = () => {
        toast.info(t("saving") || "Saving...");
        setTimeout(() => {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          chunksRef.current = [];

          // Stop and release camera tracks AFTER blob is created
          stream.getTracks().forEach((track) => track.stop());
          setCameraStream(null);

          if (blob.size === 0) {
            toast.error(t("recordingError"));
            return;
          }

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
        }, 200);
      };

      mediaRecorderRef.current = recorder;
      // Start with timeslice to ensure regular data chunks
      recorder.start(500);
      setIsRecording(true);
    } catch (err) {
      console.error("Camera error:", err);
      if (err instanceof Error && err.name === "NotAllowedError") {
        toast.error(t("cameraNotAvailable"));
      } else {
        toast.error(t("recordingError"));
      }
      setIsRecording(false);
    }
  }, [t]);

  // Stop: ONLY call recorder.stop(). Do NOT touch stream/camera here.
  // The onstop handler above handles cleanup + download.
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    mediaRecorderRef.current = null;
  }, []);

  // "Start Recording & Scroll" combo
  const startRecordAndScroll = useCallback(async () => {
    await startRecording();
    setPlaying(true);
  }, [startRecording]);

  // Cleanup camera on unmount only
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
                onClick={() => setPlaying(!playing)}
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
            {!isRecording ? (
              <>
                <button
                  onClick={startRecording}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary/80 text-foreground hover:text-primary transition-colors"
                >
                  <Video className="w-4 h-4" />
                  {t("record")}
                </button>
                <button
                  onClick={startRecordAndScroll}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-colors"
                >
                  <Video className="w-4 h-4" />
                  {t("startRecordAndScroll")}
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

      {/* Camera preview - fixed size, top-right, pointer-events-none */}
      {cameraStream && (
        <div
          className="fixed top-3 right-3 z-20 rounded-xl overflow-hidden border-2 border-primary/30 shadow-lg pointer-events-none"
          style={{ width: 120, height: 160 }}
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

      {/* Scrolling text - highest z-index for touch */}
      <div ref={scrollRef} className="flex-1 overflow-hidden fade-mask relative z-[25]">
        <div
          className={`max-w-4xl mx-auto px-4 sm:px-8 pt-[70vh] sm:pt-[50vh] pb-[50vh] ${mirrored ? "mirror-text" : ""}`}
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
