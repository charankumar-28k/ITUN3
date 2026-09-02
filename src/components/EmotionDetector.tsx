import { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import { motion, AnimatePresence } from "framer-motion";
import { EMOTION_META, type Emotion } from "@/lib/music";
import { Loader2, ScanFace, X } from "lucide-react";

const ALL_EMOJIS = Object.values(EMOTION_META).map((m) => m.emoji);

type Props = {
  onDetected: (e: Emotion) => void;
  current: Emotion | null;
};

const MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";

export function EmotionDetector({ onDetected, current }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<"idle" | "loading" | "scanning" | "done" | "error">("idle");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>("");
  const [detectedEmoji, setDetectedEmoji] = useState<string>("");
  const [liveEmoji, setLiveEmoji] = useState<string>("");
  const liveEmojiTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => stopStream();
  }, []);

  const stopStream = () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const start = async () => {
    setOpen(true);
    setError("");
    setDetectedEmoji("");
    setLiveEmoji("");
    setPhase("loading");
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      ]);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 360 }, audio: false });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setPhase("scanning");

      // Cycle random emojis while scanning for visual feedback
      liveEmojiTimer.current = setInterval(() => {
        setLiveEmoji(ALL_EMOJIS[Math.floor(Math.random() * ALL_EMOJIS.length)]);
      }, 300);

      // give camera ~1.2s to expose, then sample a few frames
      await new Promise((r) => setTimeout(r, 1200));
      const samples: faceapi.FaceExpressions[] = [];
      for (let i = 0; i < 5; i++) {
        const res = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }))
          .withFaceExpressions();
        if (res?.expressions) samples.push(res.expressions);
        await new Promise((r) => setTimeout(r, 250));
      }
      if (liveEmojiTimer.current) clearInterval(liveEmojiTimer.current);
      stopStream();

      if (!samples.length) {
        setError("No face detected. Try better lighting.");
        setPhase("error");
        return;
      }

      // Average expression scores
      const avg: Record<string, number> = {};
      for (const s of samples) {
        for (const k of Object.keys(s) as (keyof faceapi.FaceExpressions)[]) {
          avg[k] = (avg[k] || 0) + (s[k] as number);
        }
      }
      const top = Object.entries(avg).sort((a, b) => b[1] - a[1])[0][0];
      const mapped: Emotion =
        top === "happy" ? "happy" :
        top === "sad" ? "sad" :
        top === "angry" || top === "disgusted" ? "angry" :
        top === "surprised" || top === "fearful" ? "surprised" :
        top === "neutral" ? "neutral" : "tired";

      setDetectedEmoji(EMOTION_META[mapped].emoji);
      setPhase("done");
      setTimeout(() => {
        onDetected(mapped);
        setOpen(false);
        setPhase("idle");
        setDetectedEmoji("");
      }, 1400);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Camera unavailable";
      setError(msg);
      setPhase("error");
      stopStream();
    }
  };

  const close = () => {
    if (liveEmojiTimer.current) clearInterval(liveEmojiTimer.current);
    stopStream();
    setOpen(false);
    setPhase("idle");
    setDetectedEmoji("");
    setLiveEmoji("");
  };

  return (
    <>
      <div className="glass glow-border rounded-2xl p-5 h-full flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-sm uppercase tracking-[0.3em] text-muted-foreground">AI Mood Scanner</h3>
            <p className="text-xs text-muted-foreground/70 mt-1">Privacy-safe · no face data stored</p>
          </div>
          {current && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="px-3 py-1.5 rounded-full text-xs font-medium border"
              style={{
                background: `${EMOTION_META[current].color} / 0.15`,
                borderColor: EMOTION_META[current].color,
                color: EMOTION_META[current].color,
                boxShadow: `0 0 20px ${EMOTION_META[current].color}55`,
              }}
            >
              {EMOTION_META[current].emoji} {EMOTION_META[current].label}
            </motion.div>
          )}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
            className="relative h-24 w-24 rounded-full"
            style={{
              background: "conic-gradient(from 0deg, transparent, oklch(0.78 0.22 230 / 0.6), transparent)",
              filter: "blur(0.5px)",
            }}
          >
            <div className="absolute inset-2 rounded-full glass flex items-center justify-center">
              {current ? (
                <span className="text-4xl">{EMOTION_META[current].emoji}</span>
              ) : (
                <ScanFace className="h-10 w-10 text-[#aac0e1]" />
              )}
            </div>
          </motion.div>

          <button
            onClick={start}
            className="group relative px-6 py-2.5 rounded-full font-medium text-sm bg-gradient-primary text-primary-foreground shadow-glow animate-pulse-glow hover:scale-[1.03] transition-transform"
          >
            <span className="relative z-10">Detect My Mood</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass glow-border rounded-3xl p-6 w-full max-w-md relative"
            >
              <button onClick={close} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
              <h3 className="text-lg font-semibold mb-1">Mood Scan</h3>
              <p className="text-xs text-muted-foreground mb-4">Look at the camera. Stays on your device.</p>

              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-black/60 border border-border">
                <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover" />

                {/* Scan overlay */}
                {(phase === "loading" || phase === "scanning") && (
                  <>
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute left-0 right-0 h-12 bg-gradient-to-b from-transparent via-[oklch(0.78_0.22_230_/_0.4)] to-transparent animate-scan" />
                    </div>
                    <div className="absolute inset-4 border-2 border-[oklch(0.85_0.18_210_/_0.6)] rounded-2xl animate-pulse" />
                    {/* Corner brackets */}
                    <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-[#aac0e1] rounded-tl-lg" />
                    <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-[#aac0e1] rounded-tr-lg" />
                    <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-[#aac0e1] rounded-bl-lg" />
                    <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-[#aac0e1] rounded-br-lg" />
                  </>
                )}

                {/* Loading state */}
                {phase === "loading" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-sm">
                    <Loader2 className="h-5 w-5 animate-spin text-[#aac0e1]" />
                    <span className="text-xs text-muted-foreground">Loading AI models…</span>
                  </div>
                )}

                {/* Live emoji cycling during scan */}
                {phase === "scanning" && liveEmoji && (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={liveEmoji}
                      initial={{ scale: 0.4, opacity: 0, y: 10 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 1.4, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="absolute bottom-3 right-3 text-4xl pointer-events-none select-none drop-shadow-lg"
                    >
                      {liveEmoji}
                    </motion.div>
                  </AnimatePresence>
                )}

                {/* Detection result */}
                {phase === "done" && detectedEmoji && (
                  <motion.div
                    initial={{ scale: 0.3, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute inset-0 flex flex-col items-center justify-center bg-black/65 gap-3"
                  >
                    <motion.span
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 0.6, repeat: 1 }}
                      className="text-7xl drop-shadow-lg"
                    >
                      {detectedEmoji}
                    </motion.span>
                    <span className="text-lg font-bold text-gradient">Mood locked ✓</span>
                  </motion.div>
                )}
              </div>

              {error && <p className="text-destructive text-sm mt-3">{error}</p>}
              <p className="text-[11px] text-muted-foreground mt-3">
                Webcam stream is processed in your browser only. Nothing is uploaded.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

