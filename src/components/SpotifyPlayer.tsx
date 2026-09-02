import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Search, Music2, Loader2, RefreshCw, ListPlus, X, AlertCircle,
} from "lucide-react";
import type { Emotion } from "@/lib/music";

// ── Types ─────────────────────────────────────────────────────────────────
type Track = {
  id: string; name: string; artist: string;
  album: string; cover: string; url: string; duration: number;
};

export type RoomSyncState = {
  trackId: string | null; playing: boolean;
  positionMs: number; updatedAt: number; lastUpdatedBy: string | null;
};

type Props = {
  userId: string; mood: Emotion | null; isInRoom: boolean;
  onTrackChange: (id: string, ms: number, playing: boolean) => void;
  onPlayPause:   (playing: boolean, ms: number) => void;
  onTimeUpdate:  (ms: number) => void;
  syncState:     RoomSyncState | null;
  onCurrentTrackChange?: (t: { id: string; name: string; artists: string; cover: string } | null) => void;
};

// ── Config ────────────────────────────────────────────────────────────────
const API = "http://localhost:3001/api";

const LANGUAGES = [
  { label: "All",       value: "" },
  { label: "Hindi",     value: "hindi" },
  { label: "English",   value: "english" },
  { label: "Tamil",     value: "tamil" },
  { label: "Telugu",    value: "telugu" },
  { label: "Kannada",   value: "kannada" },
  { label: "Malayalam", value: "malayalam" },
  { label: "Punjabi",   value: "punjabi" },
  { label: "Bengali",   value: "bengali" },
  { label: "Marathi",   value: "marathi" },
  { label: "Gujarati",  value: "gujarati" },
];

type Language = "" | "hindi" | "english" | "tamil" | "telugu" | "kannada" | "malayalam" | "punjabi" | "bengali" | "marathi" | "gujarati";

const MOOD_SEARCH: Record<string, string> = {
  happy: "happy", sad: "sad", angry: "rock",
  neutral: "chill", surprised: "dance", tired: "relax",
};

const MOOD_EMOJI: Record<string, string> = {
  happy: "😄", sad: "😢", angry: "😠", neutral: "😐", surprised: "😲", tired: "😴",
};

const fmt = (s: number) =>
  isFinite(s) && s > 0 ? `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}` : "0:00";

async function apiFetch(path: string): Promise<Track[]> {
  const res  = await fetch(API + path, { signal: AbortSignal.timeout(12000) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data.tracks ?? [];
}

// ── Component ─────────────────────────────────────────────────────────────
export function SpotifyPlayer({ userId, mood, isInRoom, onTrackChange, onPlayPause, onTimeUpdate, syncState, onCurrentTrackChange }: Props) {
  const audioRef  = useRef<HTMLAudioElement>(null);
  const tracksRef = useRef<Track[]>([]);
  const prevSync  = useRef<string | null>(null);
  const lastQ     = useRef("");

  const [tracks,    setTracks]    = useState<Track[]>([]);
  const [queue,     setQueue]     = useState<Track[]>([]);
  const [current,   setCurrent]   = useState<Track | null>(null);
  const [playing,   setPlaying]   = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [duration,  setDuration]  = useState(0);
  const [volume,    setVolume]    = useState(0.8);
  const [muted,     setMuted]     = useState(false);
  const [query,     setQuery]     = useState("");
  const [language,  setLanguage]  = useState<Language>("");
  const [loading,   setLoading]   = useState(true);
  const [searching, setSearching] = useState(false);
  const [error,     setError]     = useState("");
  const [miniOpen,  setMiniOpen]  = useState(false);

  const volumeRef = useRef(volume);
  const mutedRef  = useRef(muted);
  useEffect(() => { volumeRef.current = volume; mutedRef.current = muted; }, [volume, muted]);

  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { prevSync.current = null; }, [isInRoom]);
  useEffect(() => { if (audioRef.current) audioRef.current.volume = muted ? 0 : volume; }, [volume, muted]);

  // ── Load & play ───────────────────────────────────────────────────────
  const loadAndPlay = useCallback((track: Track, startSec = 0, autoPlay = true) => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    // Route through local proxy — aac.saavncdn.com blocks direct browser requests
    a.src = `${API}/stream?url=${encodeURIComponent(track.url)}`;
    a.volume = mutedRef.current ? 0 : volumeRef.current;
    setCurrent(track);
    setProgress(0);
    setError("");
    a.load();
    a.addEventListener("canplay", () => {
      a.currentTime = startSec;
      if (autoPlay) a.play().catch(e => setError("Playback blocked: " + e.message));
    }, { once: true });
  }, []);

  // ── Fetch tracks ──────────────────────────────────────────────────────
  const loadTracks = useCallback(async (q: string, lang: Language = "") => {
    lastQ.current = q;
    setLoading(true);
    setError("");
    try {
      const path = q
        ? `/search?q=${encodeURIComponent(q)}&lang=${lang}`
        : `/trending?lang=${lang}`;
      let results = await apiFetch(path);
      if (results.length === 0) results = await apiFetch(`/trending?lang=`);
      if (results.length === 0) { setError("No songs found."); setTracks([]); }
      else {
        setTracks(results);
        if (!tracksRef.current.length) loadAndPlay(results[0], 0, false);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load songs.");
    } finally {
      setLoading(false);
    }
  }, [loadAndPlay]);

  useEffect(() => {
    loadTracks(mood ? MOOD_SEARCH[mood] ?? "" : "", language);
  }, [mood, language, loadTracks]);

  useEffect(() => {
    onCurrentTrackChange?.(current
      ? { id: current.id, name: current.name, artists: current.artist, cover: current.cover }
      : null);
  }, [current, onCurrentTrackChange]);

  // ── Controls ──────────────────────────────────────────────────────────
  const playTrack = useCallback((track: Track) => {
    loadAndPlay(track, 0, true);
    prevSync.current = track.id;
    onTrackChange(track.id, 0, true);
  }, [loadAndPlay, onTrackChange]);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!current || !a) return;
    if (playing) { a.pause(); onPlayPause(false, a.currentTime * 1000); }
    else { a.play().catch(() => {}); onPlayPause(true, a.currentTime * 1000); }
  }, [current, playing, onPlayPause]);

  const playNext = useCallback(() => {
    if (queue.length > 0) { const [n, ...rest] = queue; setQueue(rest); playTrack(n); return; }
    const idx = tracksRef.current.findIndex(t => t.id === current?.id);
    if (idx >= 0 && idx < tracksRef.current.length - 1) playTrack(tracksRef.current[idx + 1]);
  }, [queue, current, playTrack]);

  const playPrev = useCallback(() => {
    const idx = tracksRef.current.findIndex(t => t.id === current?.id);
    if (idx > 0) playTrack(tracksRef.current[idx - 1]);
  }, [current, playTrack]);

  const seek = (pct: number) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    a.currentTime = pct * duration;
    setProgress(pct * duration);
  };

  const addToQueue = (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    setQueue(q => q.find(t => t.id === track.id) ? q : [...q, track]);
  };

  // ── Room sync ─────────────────────────────────────────────────────────
  // Guard against re-firing when syncState is a new object with identical
  // values (Firebase listeners emit new references on every snapshot).
  const lastSyncKey = useRef<string>("");
  useEffect(() => {
    if (!syncState?.trackId || syncState.lastUpdatedBy === userId) return;
    // Build a key from the fields that actually require action.
    const key = `${syncState.trackId}|${syncState.playing}|${Math.round(syncState.positionMs / 1500)}|${syncState.updatedAt}`;
    if (key === lastSyncKey.current) return;
    lastSyncKey.current = key;
    const a = audioRef.current; if (!a) return;
    const lag = syncState.playing ? Math.max(0, Date.now() - syncState.updatedAt) : 0;
    const sec = Math.max(0, (syncState.positionMs + lag) / 1000);
    if (syncState.trackId !== prevSync.current) {
      prevSync.current = syncState.trackId;
      const m = tracksRef.current.find(t => t.id === syncState.trackId);
      if (m) loadAndPlay(m, sec, syncState.playing);
      return;
    }
    if (Math.abs(a.currentTime - sec) > 1.5) a.currentTime = sec;
    if (syncState.playing && a.paused) a.play().catch(() => {});
    if (!syncState.playing && !a.paused) a.pause();
  }, [syncState, userId, loadAndPlay]);

  const doSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    await loadTracks(query.trim(), language);
    setSearching(false);
  };

  const currentIdx = tracks.findIndex(t => t.id === current?.id);

  return (
    <>
      <div className="space-y-4">
        {/* ── Player ── */}
        <div className="glass glow-border rounded-3xl p-5 md:p-6 relative overflow-hidden">
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-[#c0005a] opacity-30 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-[#aac0e1] opacity-25 blur-3xl pointer-events-none" />

          <div className="flex gap-4 items-center relative">
            {/* Cover — fixed size on all screen sizes */}
            <motion.div key={current?.id ?? "empty"} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="relative rounded-2xl overflow-hidden shadow-neon cursor-pointer flex-shrink-0"
              style={{ width: 100, height: 100 }}
              onClick={() => current && setMiniOpen(v => !v)}>
              {current?.cover
                ? <img src={current.cover} alt={current.name} className="absolute inset-0 h-full w-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                : <div className="absolute inset-0 bg-gradient-primary flex items-center justify-center"><Music2 className="h-12 w-12 opacity-40" /></div>
              }
              {playing && (
                <div className="absolute inset-0 bg-black/30 flex items-end gap-1 p-3">
                  {[0,1,2,3,4].map(i => (
                    <span key={i} className="block w-1 bg-white/80 rounded-full animate-wave"
                      style={{ height: 16 + (i % 3) * 8, animationDelay: `${i * 0.08}s` }} />
                  ))}
                </div>
              )}
            </motion.div>

            {/* Info + controls */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Now Playing</p>
                {isInRoom && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border bg-[#aac0e1]/20 text-[#aac0e1] border-[#aac0e1]/30">🔗 Synced</span>}
                <span className="ml-auto text-[10px] text-[#aac0e1] font-semibold">🎵 Free Music</span>
              </div>

              {mood && (
                <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-base">{MOOD_EMOJI[mood]}</span>
                  <p className="text-[11px] text-muted-foreground">Mood: <span className="font-semibold text-foreground capitalize">{mood}</span></p>
                </div>
              )}

              <h2 className="text-lg md:text-2xl font-bold truncate text-gradient">{current?.name ?? "Pick a song below"}</h2>
              <p className="text-sm text-muted-foreground truncate">{current?.artist ?? "—"}</p>
              {current?.album && <p className="text-xs text-muted-foreground/60 truncate">{current.album}</p>}
              {error && <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{error}</p>}

              {/* Progress */}
              <div className="mt-4">
                <div className="relative h-1.5 rounded-full bg-white/10 cursor-pointer group"
                  onClick={e => { const r = e.currentTarget.getBoundingClientRect(); seek((e.clientX - r.left) / r.width); }}>
                  <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-neon transition-all"
                    style={{ width: duration ? `${(progress / duration) * 100}%` : "0%" }} />
                  <div className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-white shadow opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ left: duration ? `calc(${(progress / duration) * 100}% - 6px)` : "0" }} />
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                  <span>{fmt(progress)}</span>
                  <span>{fmt(duration || (current?.duration ?? 0))}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  <button onClick={playPrev} disabled={currentIdx <= 0} className="p-2.5 rounded-full glass hover:scale-110 transition-transform disabled:opacity-40"><SkipBack className="h-4 w-4" /></button>
                  <button onClick={togglePlay} disabled={!current} className="p-4 rounded-full bg-gradient-primary text-primary-foreground shadow-glow hover:scale-110 transition-transform disabled:opacity-40">
                    {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                  </button>
                  <button onClick={playNext} disabled={currentIdx >= tracks.length - 1 && queue.length === 0} className="p-2.5 rounded-full glass hover:scale-110 transition-transform disabled:opacity-40"><SkipForward className="h-4 w-4" /></button>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setMuted(m => !m)} className="p-2 text-muted-foreground hover:text-foreground">
                    {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </button>
                  <input type="range" min={0} max={1} step={0.01} value={muted ? 0 : volume}
                    onChange={e => { setVolume(+e.target.value); setMuted(false); }}
                    className="w-20 accent-[#aac0e1]" />
                </div>
              </div>
            </div>
          </div>

          <audio ref={audioRef}
            onTimeUpdate={() => { const a = audioRef.current; if (!a) return; setProgress(a.currentTime); setDuration(a.duration || 0); onTimeUpdate(a.currentTime * 1000); }}
            onPlay={() => { setPlaying(true); setError(""); }}
            onPause={() => setPlaying(false)}
            onError={() => {
              setPlaying(false);
              const idx = tracksRef.current.findIndex(t => t.id === current?.id);
              if (idx >= 0 && idx < tracksRef.current.length - 1)
                setTimeout(() => loadAndPlay(tracksRef.current[idx + 1], 0, true), 800);
              else setError("Could not play. Try another song.");
            }}
            onEnded={playNext}
          />
        </div>

        {/* ── Track List ── */}
        <div className="glass glow-border rounded-2xl p-4">
          {/* Search */}
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input value={query} onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && doSearch()}
                placeholder="Search songs, artists…"
                className="w-full bg-input border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-[#aac0e1] transition" />
            </div>
            <button onClick={doSearch} disabled={searching || !query.trim()}
              className="px-5 rounded-xl bg-[#0e2f76] text-white font-bold hover:scale-105 transition-transform disabled:opacity-40 flex items-center gap-2">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {searching ? "…" : "Search"}
            </button>
          </div>

          {/* Language chips */}
          <div className="flex gap-1.5 flex-wrap mb-3">
            {LANGUAGES.map(l => (
              <button key={l.value} onClick={() => setLanguage(l.value as Language)}
                className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all border ${
                  language === l.value ? "bg-[#0e2f76] text-white border-[#0e2f76]" : "glass border-white/10 text-muted-foreground hover:border-[#aac0e1] hover:text-[#aac0e1]"
                }`}>{l.label}</button>
            ))}
          </div>

          {/* Queue */}
          {queue.length > 0 && (
            <div className="mb-3 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] text-muted-foreground font-medium">Up Next ({queue.length})</p>
                <button onClick={() => setQueue([])} className="text-[10px] text-muted-foreground hover:text-red-400">Clear</button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {queue.map((t, i) => (
                  <div key={t.id} className="flex-shrink-0 flex items-center gap-2 px-2 py-1.5 rounded-lg glass border border-white/10">
                    <span className="text-[10px] text-muted-foreground">{i + 1}</span>
                    {t.cover && <img src={t.cover} alt={t.name} className="h-6 w-6 rounded object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium truncate max-w-[80px]">{t.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate max-w-[80px]">{t.artist}</p>
                    </div>
                    <button onClick={() => setQueue(q => q.filter((_, qi) => qi !== i))} className="text-muted-foreground hover:text-red-400 text-[10px] ml-1">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted-foreground">
              {loading ? "Loading songs…" : error ? "" : `${tracks.length} songs`}
            </p>
            <button onClick={() => loadTracks(query.trim() || (mood ? MOOD_SEARCH[mood] ?? "" : ""), language)} disabled={loading}
              className="flex items-center gap-1 px-3 py-1 rounded-full glass border border-white/10 text-[11px] text-muted-foreground hover:text-[#aac0e1] hover:border-[#aac0e1] transition disabled:opacity-40">
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>

          {/* Error */}
          {error && !loading && (
            <div className="flex flex-col items-center py-8 gap-3">
              <AlertCircle className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground text-center">{error}</p>
              <button onClick={() => loadTracks(lastQ.current, language)}
                className="px-5 py-2 rounded-xl bg-[#0e2f76] text-white text-sm font-semibold hover:scale-105 transition-transform">
                Retry
              </button>
            </div>
          )}

          {/* Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 max-h-80 overflow-y-auto pr-1">
            {loading && Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="glass rounded-xl p-2.5 animate-pulse">
                <div className="aspect-square rounded-lg bg-white/10 mb-2" />
                <div className="h-2.5 rounded bg-white/10 mb-1.5 w-3/4" />
                <div className="h-2 rounded bg-white/10 w-1/2" />
              </div>
            ))}

            {!loading && !error && tracks.map((t, i) => (
              <motion.div key={t.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                onClick={() => playTrack(t)} whileHover={{ y: -3 }}
                className={`glass rounded-xl p-2.5 cursor-pointer transition ${current?.id === t.id ? "glow-border shadow-neon" : "hover:bg-white/5"}`}>
                <div className="aspect-square rounded-lg overflow-hidden mb-2 relative bg-gradient-primary">
                  {t.cover
                    ? <img src={t.cover} alt={t.name} className="absolute inset-0 h-full w-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    : <div className="absolute inset-0 flex items-center justify-center"><Music2 className="h-6 w-6 opacity-30" /></div>
                  }
                  {current?.id === t.id && playing && (
                    <div className="absolute inset-0 bg-black/50 flex items-end gap-0.5 p-1.5">
                      {[0,1,2].map(k => (
                        <span key={k} className="block w-1 bg-white rounded-full animate-wave"
                          style={{ height: 8 + k * 4, animationDelay: `${k * 0.1}s` }} />
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs font-medium truncate">{t.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{t.artist}</p>
                <div role="button" tabIndex={0}
                  onClick={e => { e.stopPropagation(); addToQueue(t, e as any); }}
                  onKeyDown={e => e.key === "Enter" && addToQueue(t, e as any)}
                  className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-[#aac0e1] transition cursor-pointer">
                  <ListPlus className="h-3 w-3" /> Queue
                </div>
              </motion.div>
            ))}

            {!loading && !error && tracks.length === 0 && (
              <div className="col-span-full flex flex-col items-center py-10 gap-2">
                <Music2 className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No songs found.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Mini Player ── */}
      <AnimatePresence>
        {current && miniOpen && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
            className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/10 px-4 py-3 flex items-center gap-4">
            <img src={current.cover} alt={current.name} className="h-12 w-12 rounded-xl object-cover flex-shrink-0 bg-white/10"
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{current.name}</p>
              <p className="text-xs text-muted-foreground truncate">{current.artist}</p>
              <div className="mt-1 h-1 rounded-full bg-white/10 cursor-pointer"
                onClick={e => { const r = e.currentTarget.getBoundingClientRect(); seek((e.clientX - r.left) / r.width); }}>
                <div className="h-full rounded-full bg-gradient-neon" style={{ width: duration ? `${(progress / duration) * 100}%` : "0%" }} />
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={playPrev} className="p-2 glass rounded-full hover:scale-110 transition-transform"><SkipBack className="h-4 w-4" /></button>
              <button onClick={togglePlay} className="p-3 rounded-full bg-gradient-primary text-primary-foreground shadow-glow hover:scale-110 transition-transform">
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
              </button>
              <button onClick={playNext} className="p-2 glass rounded-full hover:scale-110 transition-transform"><SkipForward className="h-4 w-4" /></button>
              <button onClick={() => setMiniOpen(false)} className="p-2 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}


