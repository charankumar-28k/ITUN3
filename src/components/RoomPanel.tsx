import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Copy, LogOut, Plus, Check, Crown, Wifi, WifiOff, Loader2 } from "lucide-react";
import type { Member } from "@/lib/room";

type Props = {
  code: string | null;
  members: Member[];
  hostId: string | null;
  isHost: boolean;
  connecting: boolean;
  onCreate: () => void;
  onJoin: (code: string) => void;
  onLeave: () => void;
};

export function RoomPanel({ code, members, hostId, isHost, connecting, onCreate, onJoin, onLeave }: Props) {
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const handleConnect = () => {
    if (joinCode.length === 6) onJoin(joinCode);
  };

  return (
    <div className="glass glow-border rounded-2xl p-5 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
          <Users className="h-4 w-4" /> Listen Together
        </h3>
        {code && (
          <button
            onClick={onLeave}
            className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition"
          >
            <LogOut className="h-3 w-3" /> Leave
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {/* ── Lobby (no room yet) ── */}
        {!code ? (
          <motion.div
            key="lobby"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-3 flex-1"
          >
            {/* Create Room */}
            <button
              onClick={onCreate}
              disabled={connecting}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-primary text-primary-foreground font-medium shadow-glow hover:scale-[1.02] transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {connecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {connecting ? "Creating…" : "Create Room"}
            </button>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex-1 h-px bg-border" /> or join <div className="flex-1 h-px bg-border" />
            </div>

            {/* Join by code */}
            <div className="space-y-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                placeholder="Enter 6-digit code"
                maxLength={6}
                className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-center font-mono text-lg tracking-[0.5em] focus:outline-none focus:border-[#aac0e1] focus:shadow-glow transition"
              />
              {/* ── CONNECT BUTTON ── */}
              <button
                onClick={handleConnect}
                disabled={joinCode.length !== 6 || connecting}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-[#aac0e1] text-[#aac0e1] font-semibold hover:bg-[#aac0e1]/10 hover:scale-[1.02] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-glow"
              >
                {connecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wifi className="h-4 w-4" />
                )}
                {connecting ? "Connecting…" : "Connect"}
              </button>
            </div>

            <p className="text-[11px] text-muted-foreground/70 text-center pt-1">
              Share your room code with friends to listen together in real-time.
            </p>
          </motion.div>
        ) : (
          /* ── Inside Room ── */
          <motion.div
            key="room"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col"
          >
            {/* Connected indicator */}
            <div className="flex items-center justify-center gap-2 mb-3 py-1.5 rounded-lg bg-[oklch(0.78_0.2_160)]/10 border border-[oklch(0.78_0.2_160)]/30">
              <Wifi className="h-3.5 w-3.5 text-[oklch(0.78_0.2_160)]" />
              <span className="text-xs text-[oklch(0.78_0.2_160)] font-medium">
                {isHost ? "You are hosting" : "Connected to room"}
              </span>
            </div>

            {/* Room code display */}
            <div className="text-center py-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Room Code</p>
              <button onClick={copy} className="inline-flex items-center gap-3 group">
                <span className="text-3xl font-mono font-bold tracking-[0.4em] text-gradient">{code}</span>
                <span className="p-2 rounded-lg glass glow-border group-hover:scale-110 transition-transform">
                  {copied ? (
                    <Check className="h-4 w-4 text-[oklch(0.78_0.2_160)]" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </span>
              </button>
              <p className="text-[11px] text-muted-foreground mt-1">Tap to copy &amp; share</p>
            </div>

            {/* Members */}
            <div className="mt-2 flex-1">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.78_0.2_160)] animate-pulse inline-block" />
                {members.length} {members.length === 1 ? "listener" : "listeners"} in room
              </p>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <div
                    key={m.user_id}
                    className="px-3 py-1.5 rounded-full glass text-xs flex items-center gap-2"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.78_0.2_160)] animate-pulse" />
                    <span>{m.display_name}</span>
                    {m.user_id === hostId && (
                      <Crown className="h-3 w-3 text-[oklch(0.85_0.18_90)]" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Sync status */}
            {!isHost && (
              <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground/70">
                <WifiOff className="h-3 w-3" />
                Music is controlled by the host
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

