import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Disc3, LogOut, Eye, EyeOff, Sun, Moon, ListMusic } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ParticleField } from "./ParticleField";
import { SpotifyPlayer } from "./SpotifyPlayer";
import { RoomPanel } from "./RoomPanel";
import { ChatPanel } from "./ChatPanel";
import { FriendsPanel } from "./FriendsPanel";
import { Whiteboard } from "./Whiteboard";
import { useRoom } from "@/lib/room";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

export function Dashboard() {
  const { user, profile, signOut } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const userId      = user?.id ?? "";
  const displayName = profile?.display_name ?? (user as any)?.email?.split("@")[0] ?? "Listener";

  const [reduceMotion, setReduceMotion] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<{ id: string; name: string; artists: string; cover: string } | null>(null);
  const room        = useRoom({ userId, displayName });
  const positionRef = useRef(0);

  const handleCurrentTrackChange = useCallback(
    (t: { id: string; name: string; artists: string; cover: string } | null) => {
      setCurrentTrack(t ? { id: t.id, name: t.name, artists: t.artists, cover: t.cover ?? "" } : null);
    },
    []
  );

  const syncState = useMemo(
    () => (room.code ? room.state : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [room.code, room.state?.trackId, room.state?.playing, room.state?.positionMs, room.state?.updatedAt, room.state?.lastUpdatedBy]
  );

  const handleTrackChange = (trackId: string, positionMs: number, playing: boolean) => {
    if (!room.code) return;
    void room.broadcastState({ trackId, playing, positionMs });
  };

  const handlePlayPause = (playing: boolean, positionMs: number) => {
    if (!room.code) return;
    void room.broadcastState({ trackId: room.state?.trackId ?? null, playing, positionMs });
  };

  const handleTimeUpdate = (positionMs: number) => {
    positionRef.current = positionMs;
  };

  useEffect(() => {
    if (!room.code) return;
    const id = setInterval(() => {
      if (room.state?.playing) {
        void room.broadcastState({
          trackId:    room.state.trackId,
          playing:    true,
          positionMs: positionRef.current,
        });
      }
    }, 3000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.code, room.state?.playing, room.state?.trackId]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, filter: "blur(10px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0)" }}
      transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
      className="min-h-screen relative"
    >
      <div className="absolute inset-0 cyber-grid opacity-25 pointer-events-none" />
      {!reduceMotion && <ParticleField count={28} />}

      <header className="relative z-10 px-4 md:px-8 py-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0">
            <Disc3 className="h-8 w-8 text-[#f5feff] animate-spin-slow" />
            <div className="absolute inset-0 rounded-full bg-[oklch(0.78_0.2_210)] blur-xl opacity-40" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-lg font-bold leading-none text-gradient">ITUN3</h1>
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mt-1">cyber edition</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <Link to="/library" className="p-2 rounded-full glass hover:scale-110 transition-transform" title="Library">
            <ListMusic className="h-4 w-4" />
          </Link>
          <button onClick={toggleTheme} className="p-2 rounded-full glass hover:scale-110 transition-transform" title="Toggle theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button onClick={() => setReduceMotion((v) => !v)} className="p-2 rounded-full glass hover:scale-110 transition-transform">
            {reduceMotion ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <Link
            to="/profile"
            className="flex items-center gap-2 px-3 py-1.5 rounded-full glass hover:scale-105 transition-transform"
          >
            <div className="h-7 w-7 rounded-full bg-gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
            <span className="text-sm">{displayName}</span>
          </Link>
          <button onClick={() => void signOut()} className="p-2 rounded-full glass hover:text-destructive transition" title="Logout">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="relative z-10 px-4 md:px-8 pb-32 max-w-7xl mx-auto">
        <div className="mb-5">
          <SpotifyPlayer
            userId={userId}
            mood={null}
            isInRoom={!!room.code}
            onTrackChange={handleTrackChange}
            onPlayPause={handlePlayPause}
            onTimeUpdate={handleTimeUpdate}
            syncState={syncState}
            onCurrentTrackChange={handleCurrentTrackChange}
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-5 mb-5">
          <RoomPanel
            code={room.code}
            members={room.members}
            hostId={room.hostId}
            isHost={room.isHost}
            connecting={room.connecting}
            onCreate={() => void room.create()}
            onJoin={(c) => void room.join(c)}
            onLeave={() => void room.leave()}
          />
          <ChatPanel
            userId={userId}
            displayName={displayName}
            enabled={!!room.code}
            messages={room.messages}
            onSend={room.sendMessage}
            currentTrack={currentTrack}
          />
          <FriendsPanel
            userId={userId}
            displayName={displayName}
            currentTrack={currentTrack}
          />
        </div>

        <div className="mb-5">
          <Whiteboard
            roomId={room.roomId}
            userId={userId}
            displayName={displayName}
            memberCount={room.members.length}
          />
        </div>
      </main>
    </motion.div>
  );
}
