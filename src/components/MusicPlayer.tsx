import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { motion } from "framer-motion";
import type { Track } from "@/lib/music";

type Props = {
  track: Track | null;
  playing: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  currentTime?: number;
  onTime?: (t: number) => void;
  controlsDisabled?: boolean;
  isInRoom?: boolean;
  isHost?: boolean;
};

export function MusicPlayer({ track, playing, onTogglePlay, onNext, onPrev, currentTime, onTime, controlsDisabled, isInRoom, isHost }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [muted, setMuted] = useState(false);

  // Visualizer
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);

  // Setup audio context once
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  const ensureAnalyser = () => {
    if (!audioRef.current || analyserRef.current) return;
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctor();
      const src = ctx.createMediaElementSource(audioRef.current);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      ctxRef.current = ctx;
      sourceRef.current = src;
      analyserRef.current = analyser;
      drawViz();
    } catch {
      // CORS-blocked tracks won't visualize; player still works
    }
  };

  const drawViz = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const data = new Uint8Array(analyser.frequencyBinCount);

    const render = () => {
      analyser.getByteFrequencyData(data);
      const w = canvas.width = canvas.clientWidth * window.devicePixelRatio;
      const h = canvas.height = canvas.clientHeight * window.devicePixelRatio;
      ctx.clearRect(0, 0, w, h);
      const bars = 48;
      const step = Math.floor(data.length / bars);
      const bw = w / bars;
      for (let i = 0; i < bars; i++) {
        const v = data[i * step] / 255;
        const bh = Math.max(2, v * h * 0.9);
        const grad = ctx.createLinearGradient(0, h - bh, 0, h);
        grad.addColorStop(0, "oklch(0.85 0.2 210)");
        grad.addColorStop(1, "#c0005a");
        ctx.fillStyle = grad;
        ctx.shadowColor = "oklch(0.78 0.22 230)";
        ctx.shadowBlur = 12;
        const x = i * bw + bw * 0.15;
        const bw2 = bw * 0.7;
        ctx.fillRect(x, h - bh, bw2, bh);
      }
      rafRef.current = requestAnimationFrame(render);
    };
    render();
  };

  // Load new track
  useEffect(() => {
    if (!audioRef.current || !track) return;
    audioRef.current.src = track.url;
    audioRef.current.crossOrigin = "anonymous";
    audioRef.current.load();
    setProgress(0);
  }, [track]);

  // Play / pause
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      ensureAnalyser();
      ctxRef.current?.resume().catch(() => {});
      a.play().catch(() => {});
    } else {
      a.pause();
    }
  }, [playing, track]);

  // Volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = muted ? 0 : volume;
  }, [volume, muted]);

  // External sync (room)
  useEffect(() => {
    if (currentTime == null || !audioRef.current) return;
    if (Math.abs(audioRef.current.currentTime - currentTime) > 1.2) {
      audioRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  const onTimeUpdate = () => {
    const a = audioRef.current;
    if (!a) return;
    setProgress(a.currentTime);
    setDuration(a.duration || 0);
    onTime?.(a.currentTime);
  };

  const seek = (pct: number) => {
    if (controlsDisabled) return;
    const a = audioRef.current;
    if (!a || !duration) return;
    const t = pct * duration;
    a.currentTime = t;
    setProgress(t);
    onTime?.(t);
  };

  const fmt = (s: number) => {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${r.toString().padStart(2, "0")}`;
  };

  const cover = track?.cover;
  const fakeBars = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

  return (
    <div className="glass glow-border rounded-3xl p-5 md:p-6 relative overflow-hidden">
      {/* ambient glow */}
      <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-[#c0005a] opacity-30 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-[#aac0e1] opacity-25 blur-3xl pointer-events-none" />

      <div className="grid md:grid-cols-[200px_1fr] gap-5 items-center relative">
        {/* cover */}
        <motion.div
          key={track?.id}
          initial={{ scale: 0.9, opacity: 0, rotate: -4 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          className="relative aspect-square rounded-2xl overflow-hidden shadow-neon"
        >
          {cover ? (
            <img src={cover} alt={track?.title} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-primary" />
          )}
          {playing && (
            <div className="absolute inset-0 bg-black/30 flex items-end gap-1 p-3">
              {fakeBars.slice(0, 6).map((i) => (
                <span
                  key={i}
                  className="block w-1 bg-white/80 rounded-full animate-wave"
                  style={{ height: 16 + (i % 3) * 8, animationDelay: `${i * 0.08}s` }}
                />
              ))}
            </div>
          )}
        </motion.div>

        {/* meta + controls */}
        <div className="min-w-0">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Now Playing</p>
                {isInRoom && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    isHost
                      ? "bg-[oklch(0.85_0.18_90)]/20 text-[oklch(0.85_0.18_90)] border border-[oklch(0.85_0.18_90)]/30"
                      : "bg-[#aac0e1]/20 text-[#aac0e1] border border-[#aac0e1]/30"
                  }`}>
                    {isHost ? "⚡ Hosting" : "🔗 Synced"}
                  </span>
                )}
              </div>
              <h2 className="text-2xl md:text-3xl font-bold truncate text-gradient">
                {track?.title ?? "Pick a mood to start"}
              </h2>
              <p className="text-sm text-muted-foreground truncate">{track?.artist ?? "—"}</p>
            </div>
          </div>

          {/* visualizer */}
          <div className="mt-4 h-14 rounded-xl bg-black/30 border border-border/60 overflow-hidden">
            <canvas ref={canvasRef} className="h-full w-full" />
          </div>

          {/* progress */}
          <div className="mt-3">
            <div
              className="relative h-1.5 rounded-full bg-white/10 cursor-pointer"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                seek((e.clientX - r.left) / r.width);
              }}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-neon animate-shimmer"
                style={{ width: duration ? `${(progress / duration) * 100}%` : "0%" }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
              <span>{fmt(progress)}</span>
              <span>{fmt(duration)}</span>
            </div>
          </div>

          {/* controls */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <button onClick={onPrev} disabled={controlsDisabled} className="p-2.5 rounded-full glass hover:scale-110 transition-transform disabled:opacity-40 disabled:cursor-not-allowed">
                <SkipBack className="h-4 w-4" />
              </button>
              <button
                onClick={onTogglePlay}
                disabled={!track || controlsDisabled}
                className="p-4 rounded-full bg-gradient-primary text-primary-foreground shadow-glow hover:scale-110 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
              </button>
              <button onClick={onNext} disabled={controlsDisabled} className="p-2.5 rounded-full glass hover:scale-110 transition-transform disabled:opacity-40 disabled:cursor-not-allowed">
                <SkipForward className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => setMuted((m) => !m)} className="p-2 text-muted-foreground hover:text-foreground">
                {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                onChange={(e) => { setVolume(Number(e.target.value)); setMuted(false); }}
                className="w-24 accent-[#aac0e1]"
                aria-label="Volume"
              />
            </div>
          </div>
        </div>
      </div>

      <audio
        ref={audioRef}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onTimeUpdate}
        onEnded={onNext}
      />
    </div>
  );
}

