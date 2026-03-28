import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface RecordingPreviewPlayerProps {
  src: string;
  detectedDurationMs: number | null;
}

const formatPlaybackTime = (totalSeconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const RecordingPreviewPlayer = ({ src, detectedDurationMs }: RecordingPreviewPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [resolvedDuration, setResolvedDuration] = useState(0);

  const detectedDurationSeconds = useMemo(
    () => (detectedDurationMs && detectedDurationMs > 0 ? detectedDurationMs / 1000 : 0),
    [detectedDurationMs]
  );

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setResolvedDuration(detectedDurationSeconds);
  }, [src, detectedDurationSeconds]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const syncCurrentTime = () => {
      setCurrentTime(video.currentTime || 0);
      setIsPlaying(!video.paused && !video.ended);
    };

    const syncDuration = () => {
      const mediaDuration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
      const nextDuration = Math.max(mediaDuration, detectedDurationSeconds);
      if (nextDuration > 0) setResolvedDuration(nextDuration);
    };

    const applySeekerTrick = () => {
      const expectedDuration = detectedDurationSeconds;
      const mediaDuration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
      const hasWrongDuration = expectedDuration > 3 && mediaDuration > 0 && mediaDuration < expectedDuration * 0.75;
      const missingDuration = !Number.isFinite(video.duration) || video.duration === Infinity || mediaDuration === 0;

      if (!hasWrongDuration && !missingDuration) {
        syncDuration();
        return;
      }

      const previousTime = video.currentTime || 0;
      const handleSeeked = () => {
        const derivedDuration = Number.isFinite(video.duration) && video.duration > 0
          ? video.duration
          : expectedDuration;

        if (derivedDuration > 0) {
          setResolvedDuration(Math.max(derivedDuration, expectedDuration));
        }

        try {
          video.currentTime = Math.min(previousTime, derivedDuration || expectedDuration || 0);
        } catch {
          video.currentTime = 0;
        }
      };

      video.addEventListener("seeked", handleSeeked, { once: true });

      try {
        video.currentTime = Number.MAX_SAFE_INTEGER;
      } catch {
        syncDuration();
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime((prev) => Math.max(prev, detectedDurationSeconds, video.currentTime || 0));
    };

    video.addEventListener("loadedmetadata", applySeekerTrick);
    video.addEventListener("durationchange", syncDuration);
    video.addEventListener("timeupdate", syncCurrentTime);
    video.addEventListener("pause", syncCurrentTime);
    video.addEventListener("play", syncCurrentTime);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("loadedmetadata", applySeekerTrick);
      video.removeEventListener("durationchange", syncDuration);
      video.removeEventListener("timeupdate", syncCurrentTime);
      video.removeEventListener("pause", syncCurrentTime);
      video.removeEventListener("play", syncCurrentTime);
      video.removeEventListener("ended", handleEnded);
    };
  }, [src, detectedDurationSeconds]);

  const effectiveDuration = Math.max(resolvedDuration, detectedDurationSeconds, currentTime, 0);

  const handleTogglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused || video.ended) {
      if (video.ended && effectiveDuration > 0) {
        video.currentTime = 0;
        setCurrentTime(0);
      }

      try {
        await video.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }

      return;
    }

    video.pause();
    setIsPlaying(false);
  };

  const handleSeek = ([nextTime]: number[]) => {
    const video = videoRef.current;
    if (!video) return;

    const safeTime = Math.max(0, Math.min(nextTime, effectiveDuration || nextTime));

    try {
      video.currentTime = safeTime;
      setCurrentTime(safeTime);
    } catch {
      setCurrentTime((prev) => Math.min(prev, effectiveDuration || prev));
    }
  };

  return (
    <div className="space-y-3">
      <video
        ref={videoRef}
        src={src}
        playsInline
        preload="metadata"
        className="w-full rounded-xl bg-black aspect-video"
      />

      <div className="rounded-xl border border-border bg-secondary/20 px-3 py-3 space-y-3">
        <Slider
          value={[Math.min(currentTime, effectiveDuration || currentTime || 0)]}
          onValueChange={handleSeek}
          min={0}
          max={effectiveDuration || 1}
          step={0.1}
          className="w-full"
        />

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleTogglePlayback}
            className="flex items-center justify-center rounded-full bg-primary text-primary-foreground w-11 h-11 hover:bg-primary/90 transition-colors active:scale-[0.98]"
            aria-label={isPlaying ? "Pause preview" : "Play preview"}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>

          <div className="ml-auto text-sm font-mono tabular-nums text-foreground">
            {formatPlaybackTime(currentTime)} / {formatPlaybackTime(effectiveDuration)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecordingPreviewPlayer;