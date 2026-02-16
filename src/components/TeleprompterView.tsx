import { useState, useEffect, useRef, useCallback } from "react";
import { X, Minus, Plus, FlipHorizontal2, Pause, Play } from "lucide-react";

interface TeleprompterViewProps {
  content: string;
  onClose: () => void;
}

const TeleprompterView = ({ content, onClose }: TeleprompterViewProps) => {
  const [speed, setSpeed] = useState(3);
  const [fontSize, setFontSize] = useState(42);
  const [mirrored, setMirrored] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

  const scroll = useCallback(() => {
    if (scrollRef.current && playing) {
      scrollRef.current.scrollTop += speed * 0.5;
    }
    animRef.current = requestAnimationFrame(scroll);
  }, [playing, speed]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(animRef.current);
  }, [scroll]);

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

  return (
    <div
      className="fixed inset-0 z-50 bg-teleprompter-bg flex flex-col"
      onMouseMove={handleInteraction}
      onTouchStart={handleInteraction}
    >
      {/* Controls overlay */}
      <div
        className={`absolute top-0 left-0 right-0 z-10 p-4 transition-opacity duration-500 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)" }}
      >
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            {/* Speed */}
            <div className="flex items-center gap-1 bg-secondary/80 rounded-lg px-2 py-1">
              <button onClick={() => setSpeed((s) => Math.max(s - 1, 1))} className="p-1 text-foreground hover:text-primary">
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono text-foreground min-w-[3ch] text-center">{speed}x</span>
              <button onClick={() => setSpeed((s) => Math.min(s + 1, 10))} className="p-1 text-foreground hover:text-primary">
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Font size */}
            <div className="flex items-center gap-1 bg-secondary/80 rounded-lg px-2 py-1">
              <button onClick={() => setFontSize((s) => Math.max(s - 4, 16))} className="p-1 text-foreground hover:text-primary text-xs font-mono">
                A
              </button>
              <span className="text-xs font-mono text-foreground min-w-[3ch] text-center">{fontSize}</span>
              <button onClick={() => setFontSize((s) => Math.min(s + 4, 80))} className="p-1 text-foreground hover:text-primary text-base font-mono font-bold">
                A
              </button>
            </div>

            {/* Mirror */}
            <button
              onClick={() => setMirrored(!mirrored)}
              className={`p-2 rounded-lg transition-colors ${
                mirrored ? "bg-primary text-primary-foreground" : "bg-secondary/80 text-foreground hover:text-primary"
              }`}
            >
              <FlipHorizontal2 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPlaying(!playing)}
              className="p-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition"
            >
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-secondary/80 text-foreground hover:text-destructive transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Scrolling text */}
      <div ref={scrollRef} className="flex-1 overflow-hidden fade-mask">
        <div
          className={`max-w-4xl mx-auto px-8 py-[50vh] ${mirrored ? "mirror-text" : ""}`}
          style={{ fontSize: `${fontSize}px`, lineHeight: "1.5" }}
        >
          <p className="text-teleprompter-text font-sans font-medium whitespace-pre-wrap">
            {content}
          </p>
        </div>
      </div>

      {/* Bottom hint */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-10 p-3 text-center transition-opacity duration-500 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        <p className="text-xs text-muted-foreground font-mono">
          Space to play/pause · ↑↓ speed · Esc to exit
        </p>
      </div>
    </div>
  );
};

export default TeleprompterView;
