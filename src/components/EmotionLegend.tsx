import { motion } from "framer-motion";
import { EMOTION_META, type Emotion } from "@/lib/music";

export function EmotionLegend({ current, onPick }: { current: Emotion | null; onPick: (e: Emotion) => void }) {
  return (
    <div className="glass glow-border rounded-full px-4 py-2 flex items-center gap-1 md:gap-2">
      {(Object.keys(EMOTION_META) as Emotion[]).map((e, i) => {
        const active = current === e;
        const meta = EMOTION_META[e];
        return (
          <motion.button
            key={e}
            onClick={() => onPick(e)}
            whileHover={{ scale: 1.15, y: -2 }}
            animate={active ? { scale: [1, 1.15, 1] } : {}}
            transition={active ? { duration: 1.6, repeat: Infinity } : { delay: i * 0.05 }}
            className={`relative h-9 w-9 md:h-10 md:w-10 rounded-full flex items-center justify-center text-lg md:text-xl transition ${
              active ? "shadow-neon" : "hover:bg-white/5"
            }`}
            style={active ? { background: `${meta.color} / 0.15`, boxShadow: `0 0 24px ${meta.color}80` } : {}}
            aria-label={meta.label}
            title={meta.label}
          >
            {meta.emoji}
          </motion.button>
        );
      })}
    </div>
  );
}

