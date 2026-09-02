import { useMemo } from "react";

export function ParticleField({ count = 40 }: { count?: number }) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 2 + Math.random() * 5,
        duration: 8 + Math.random() * 14,
        delay: Math.random() * -20,
        hue: Math.random() > 0.5 ? "240" : "210",
      })),
    [count],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p) => (
        <span
          key={p.id}
          className="animate-float-up absolute rounded-full"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            background: `oklch(0.8 0.2 ${p.hue} / 0.7)`,
            boxShadow: `0 0 ${p.size * 3}px oklch(0.75 0.22 ${p.hue} / 0.7)`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

