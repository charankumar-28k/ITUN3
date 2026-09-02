import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Lock, Mail, Sparkles, User as UserIcon, Loader2 } from "lucide-react";
import { z } from "zod";
import { useNavigate } from "@tanstack/react-router";
import { ParticleField } from "./ParticleField";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const emailSchema = z.string().trim().email("Invalid email").max(255);
const pwSchema    = z.string().min(6, "Min 6 characters").max(72);
const nameSchema  = z.string().trim().min(1, "Required").max(40);

// Music note characters (plain text, no emoji encoding issues)
const NOTES = ["♩","♪","♫","♬","♩","♪","♫","♬","♩","♪","♫","♬","♩","♪","♫","♬"];

// Each note's orbit config — radius uses vmin so it scales with viewport
const ORBIT_CONFIG = NOTES.map((_, i) => ({
  radius:    i % 2 === 0 ? 38 : 42,   // vmin units, applied via CSS calc
  duration:  10 + (i % 4) * 3,
  direction: i % 3 === 0 ? -1 : 1,
  startDeg:  (360 / NOTES.length) * i,
  size:      16 + (i % 4) * 4,
  opacity:   0.45 + (i % 3) * 0.18,
}));

export function AuthPage() {
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate({ to: "/", replace: true });
  }, [user, navigate]);

  const [mode, setMode]   = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [pw, setPw]       = useState("");
  const [name, setName]   = useState("");
  const [focus, setFocus] = useState<"email" | "pw" | "name" | null>(null);
  const [busy, setBusy]   = useState(false);

  const DEMO_EMAIL    = import.meta.env.VITE_DEMO_EMAIL    ?? "demo@moodsync.app";
  const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD ?? "Demo@2024";

  const loginAsDemo = async () => {
    setBusy(true);
    const res = await signIn(DEMO_EMAIL, DEMO_PASSWORD);
    if (res.error) {
      const reg = await signUp(DEMO_EMAIL, DEMO_PASSWORD, "Demo User");
      if (reg.error) toast.error(reg.error);
      else toast.success("Demo account created! You're in.");
    }
    setBusy(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(email);
      pwSchema.parse(pw);
      if (mode === "signup") nameSchema.parse(name);
    } catch (err) {
      const ze = err as z.ZodError;
      toast.error(ze.issues[0]?.message ?? "Invalid input");
      return;
    }
    setBusy(true);
    const res = mode === "login" ? await signIn(email, pw) : await signUp(email, pw, name);
    setBusy(false);
    if (res.error) { toast.error(res.error); return; }
    if (mode === "signup") toast.success("Welcome! Check your email if confirmation is required.");
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4">
      <div className="absolute inset-0 cyber-grid opacity-50" />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 30%, #060f24 85%)" }} />
      <ParticleField count={30} />

      {/* ── Orbiting music notes ── */}
      <div
        className="pointer-events-none absolute"
        style={{ width: 0, height: 0, left: "50%", top: "50%" }}
      >
        {ORBIT_CONFIG.map((cfg, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              width: cfg.size,
              height: cfg.size,
              left: -cfg.size / 2,
              top: -cfg.size / 2,
              animation: `orbit-${i} ${cfg.duration}s linear infinite`,
              // hide on very small screens to avoid overflow
            }}
          >
            <span style={{
              fontSize: cfg.size,
              opacity: cfg.opacity,
              color: i % 2 === 0 ? "#aac0e1" : "#f5feff",
              filter: `drop-shadow(0 0 8px ${i % 2 === 0 ? "#aac0e1" : "#0e2f76"})`,
              display: "block",
              lineHeight: 1,
              userSelect: "none",
            }}>
              {NOTES[i]}
            </span>
          </div>
        ))}
      </div>

      {/* Inject keyframes for each note */}
      <style>{
        ORBIT_CONFIG.map((cfg, i) => {
          const dir = cfg.direction;
          const r   = cfg.radius;  // vmin
          const s   = cfg.startDeg;
          return `
            @keyframes orbit-${i} {
              from { transform: rotate(${s}deg) translateX(${r}vmin) rotate(${-s}deg); }
              to   { transform: rotate(${s + dir * 360}deg) translateX(${r}vmin) rotate(${-(s + dir * 360)}deg); }
            }
          `;
        }).join("")
      }</style>

      {/* ── Login card ── */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
        className="glass glow-border rounded-3xl p-8 md:p-10 w-full max-w-md relative z-10"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center gap-2 mt-4">
            <Sparkles className="h-4 w-4 text-[#aac0e1]" />
            <span className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Mood Sync</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mt-2 text-gradient text-center">Feel · Listen · Share</h1>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            {mode === "login" ? "Sign in to sync your mood." : "Create your account."}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Display name</span>
              <div className="relative mt-1">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text" value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={() => setFocus("name")} onBlur={() => setFocus(null)}
                  required maxLength={40}
                  className="w-full bg-input border border-border rounded-xl pl-10 pr-3 py-3 focus:outline-none focus:border-[#aac0e1] focus:shadow-glow transition"
                  placeholder="Cosmic Listener"
                />
              </div>
            </label>
          )}

          <label className="block">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Email</span>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocus("email")} onBlur={() => setFocus(null)}
                required
                className="w-full bg-input border border-border rounded-xl pl-10 pr-3 py-3 focus:outline-none focus:border-[#aac0e1] focus:shadow-glow transition"
                placeholder="you@cosmos.fm"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Password</span>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="password" value={pw}
                onChange={(e) => setPw(e.target.value)}
                onFocus={() => setFocus("pw")} onBlur={() => setFocus(null)}
                required minLength={6}
                className="w-full bg-input border border-border rounded-xl pl-10 pr-3 py-3 focus:outline-none focus:border-[#aac0e1] focus:shadow-glow transition"
                placeholder="••••••••"
              />
            </div>
          </label>

          <button
            type="submit" disabled={busy}
            className="w-full py-3 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow animate-pulse-glow hover:scale-[1.02] active:scale-[0.99] transition-transform disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login" ? "Enter the Cosmos" : "Create account"}
          </button>

          {mode === "login" && (
            <button
              type="button" onClick={loginAsDemo} disabled={busy}
              className="w-full py-2.5 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground hover:border-[#aac0e1] transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Use Demo Account
            </button>
          )}

          <button
            type="button"
            onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
            className="w-full text-xs text-muted-foreground hover:text-foreground transition"
          >
            {mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
