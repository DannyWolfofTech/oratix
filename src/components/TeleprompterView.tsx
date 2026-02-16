import { useState, useEffect, useRef, useCallback } from "react";
import { X, Minus, Plus, FlipHorizontal2, Pause, Play, Mic, MicOff } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLanguage } from "@/hooks/useLanguage";
import { Slider } from "@/components/ui/slider";

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
  const [speed, setSpeed] = useState(1);
  const [fontSize, setFontSize] = useState(() => (window.innerWidth < 768 ? 28 : 42));
  const [mirrored, setMirrored] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceLang, setVoiceLang] = useState<"en-US" | "ro-RO">(lang === "ro" ? "ro-RO" : "en-US");
  const scrollRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const recognitionRef = useRef<any>(null);

  // Smooth scrolling via requestAnimationFrame
  const scroll = useCallback(() => {
    if (scrollRef.current && playing) {
      scrollRef.current.scrollTop += speed * 0.3;
    }
    animRef.current = requestAnimationFrame(scroll);
  }, [playing, speed]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(animRef.current);
  }, [scroll]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === " ") { e.preventDefault(); setPlaying((p) => !p); }
      if (e.key === "ArrowUp") setSpeed((s) => Math.min(s + 1, 10));
      if (e.key === "ArrowDown") setSpeed((s) => Math.max(s - 1, 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Mouse wheel speed control (desktop)
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
  const handleInteraction = () => {
    setShowControls(true);
    clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, 3000);
  };

  useEffect(() => {
    if (playing) {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    } else {
      setShowControls(true);
    }
    return () => clearTimeout(controlsTimeoutRef.current);
  }, [playing]);

  // Voice recognition for speed adaptation
  const startVoice = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error("Speech recognition not supported");
      return;
    }

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
          const mappedSpeed = Math.round(Math.min(10, Math.max(1, wps * 2.5)));
          setSpeed(mappedSpeed);
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setVoiceActive(false);
        recognitionRef.current = null;
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        try { recognition.start(); } catch {
          setVoiceActive(false);
          recognitionRef.current = null;
        }
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
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setVoiceActive(false);
  }, []);

  useEffect(() => {
    return () => { stopVoice(); };
  }, [stopVoice]);

  const toggleLang = () => {
    const newLang = voiceLang === "en-US" ? "ro-RO" : "en-US";
    setVoiceLang(newLang);
    if (voiceActive) {
      stopVoice();
    }
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

  return (
    <div
      className="fixed inset-0 z-50 bg-teleprompter-bg flex flex-col"
      onMouseMove={handleInteraction}
      onTouchStart={handleInteraction}
    >
      {/* Controls overlay */}
      <div
        className={`absolute top-0 left-0 right-0 z-10 p-3 sm:p-4 transition-opacity duration-500 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.9), transparent)" }}
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
            <button onClick={() => setSpeed((s) => Math.max(s - 1, 1))} className="p-1 text-foreground hover:text-primary">
              <Minus className="w-4 h-4" />
            </button>
            <Slider value={[speed]} onValueChange={([v]) => setSpeed(v)} min={1} max={10} step={1} className="flex-1" />
            <button onClick={() => setSpeed((s) => Math.min(s + 1, 10))} className="p-1 text-foreground hover:text-primary">
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

          {/* Voice control */}
          <div className="flex items-center gap-2">
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
            {voiceActive && (
              <span className="text-xs text-muted-foreground">{t("adaptingSpeed")}</span>
            )}
          </div>
        </div>
      </div>

      {/* Scrolling text */}
      <div ref={scrollRef} className="flex-1 overflow-hidden fade-mask">
        <div
          className={`max-w-4xl mx-auto px-4 sm:px-8 py-[50vh] ${mirrored ? "mirror-text" : ""}`}
          style={{ fontSize: `${fontSize}px`, lineHeight: "1.5" }}
        >
          <p className="text-teleprompter-text font-sans font-medium whitespace-pre-wrap">
            {content}
          </p>
        </div>
      </div>

      {/* Bottom hint */}
      <div className={`absolute bottom-0 left-0 right-0 z-10 p-3 text-center transition-opacity duration-500 ${showControls ? "opacity-100" : "opacity-0"}`}>
        <p className="text-xs text-muted-foreground">
          {isMobile ? t("mobileHint") : t("desktopHint")}
        </p>
      </div>
    </div>
  );
};

export default TeleprompterView;
