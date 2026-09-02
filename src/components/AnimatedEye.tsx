import { motion } from "framer-motion";

type State = "open" | "closed" | "idle";

export function AnimatedEye({ state }: { state: State }) {
  const closed = state === "closed";
  return (
    <div className="relative h-16 w-16">
      <div className="absolute inset-0 rounded-full bg-gradient-primary opacity-40 blur-xl" />
      <svg viewBox="0 0 64 32" className={`relative h-16 w-16 ${state === "idle" ? "animate-blink" : ""}`}>
        <defs>
          <linearGradient id="eyeStroke" x1="0" x2="1">
            <stop offset="0%" stopColor="oklch(0.85 0.18 210)" />
            <stop offset="100%" stopColor="oklch(0.7 0.25 260)" />
          </linearGradient>
        </defs>
        <motion.path
          d={closed ? "M4 16 Q32 16 60 16" : "M4 16 Q32 -8 60 16 Q32 40 4 16 Z"}
          fill="none"
          stroke="url(#eyeStroke)"
          strokeWidth="2.2"
          strokeLinecap="round"
          animate={{ d: closed ? "M4 16 Q32 16 60 16" : "M4 16 Q32 -8 60 16 Q32 40 4 16 Z" }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        />
        {!closed && (
          <motion.circle
            cx="32"
            cy="16"
            r="6"
            fill="oklch(0.78 0.22 230)"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
          />
        )}
        {!closed && <circle cx="34" cy="14" r="1.6" fill="white" />}
      </svg>
    </div>
  );
}

