import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2, Music2, Heart, ListMusic, Trash2, BookmarkCheck, Plus, Search } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Library — Mood Sync" },
      { name: "description", content: "Your saved songs and playlists." },
    ],
  }),
  component: LibraryPage,
});

type SavedTrack = { id: string; name: string; artist: string; album: string; cover: string; savedAt: number };
type Playlist   = { id: string; name: string; tracks: SavedTrack[]; createdAt: number };

const SAVED_KEY  = "moodsync_saved_tracks";
const PLISTS_KEY = "moodsync_playlists";
const load = <T,>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback; } catch { return fallback; } };
const save = (key: string, val: unknown) => localStorage.setItem(key, JSON.stringify(val));

const BG: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: -1,
  background: "#060f24",
  backgroundImage:
    "radial-gradient(ellipse at 15% 10%, #0e2a4a 0%, transparent 45%), " +
    "radial-gradient(ellipse at 85% 85%, #071a30 0%, transparent 45%)",
};

const CARD: React.CSSProperties = {
  background: "rgba(10,25,60,0.85)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border: "1px solid rgba(170, 192, 225, 0.10)",
  boxShadow: "0 4px 32px -4px rgba(0,0,0,0.6), inset 0 1px 0 rgba(148,163,184,0.04)",
  borderRadius: "1rem",
};

function LibraryPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab]             = useState<"saved" | "playlists">("saved");
  const [saved, setSaved]         = useState<SavedTrack[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [search, setSearch]       = useState("");
  const [newName, setNewName]     = useState("");
  const [creating, setCreating]   = useState(false);
  const [activePl, setActivePl]   = useState<Playlist | null>(null);
  const [addMenuId, setAddMenuId] = useState<string | null>(null);

  useEffect(() => { if (!loading && !user) navigate({ to: "/" }); }, [loading, user, navigate]);
  useEffect(() => { setSaved(load(SAVED_KEY, [])); setPlaylists(load(PLISTS_KEY, [])); }, []);

  const removeSaved = (id: string) => { const n = saved.filter(t => t.id !== id); setSaved(n); save(SAVED_KEY, n); };

  const createPlaylist = () => {
    if (!newName.trim()) return;
    const pl: Playlist = { id: Date.now().toString(), name: newName.trim(), tracks: [], createdAt: Date.now() };
    const n = [pl, ...playlists]; setPlaylists(n); save(PLISTS_KEY, n); setNewName(""); setCreating(false);
  };

  const deletePl = (id: string) => {
    const n = playlists.filter(p => p.id !== id); setPlaylists(n); save(PLISTS_KEY, n);
    if (activePl?.id === id) setActivePl(null);
  };

  const addToPl = (pl: Playlist, track: SavedTrack) => {
    if (pl.tracks.find(t => t.id === track.id)) return;
    const updated = { ...pl, tracks: [...pl.tracks, track] };
    const n = playlists.map(p => p.id === pl.id ? updated : p);
    setPlaylists(n); save(PLISTS_KEY, n);
    if (activePl?.id === pl.id) setActivePl(updated);
    setAddMenuId(null);
  };

  const removeFromPl = (plId: string, trackId: string) => {
    const n = playlists.map(p => p.id === plId ? { ...p, tracks: p.tracks.filter(t => t.id !== trackId) } : p);
    setPlaylists(n); save(PLISTS_KEY, n);
    if (activePl?.id === plId) setActivePl(n.find(p => p.id === plId) ?? null);
  };

  const filtered = saved.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.artist.toLowerCase().includes(search.toLowerCase())
  );

  if (loading || !user) {
    return (
      <>
        <div style={BG} />
        <div className="fixed inset-0 grid place-items-center">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#aac0e1" }} />
        </div>
      </>
    );
  }

  return (
    <>
      <div style={BG} />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ minHeight: "100vh", padding: "1.5rem 1rem", maxWidth: 900, margin: "0 auto", position: "relative" }}
        onClick={() => setAddMenuId(null)}
      >
        {/* Header */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem", gap: 12, flexWrap: "wrap" }}>
          <Link to="/" style={{ ...CARD, display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", fontSize: 14, color: "#aac0e1", textDecoration: "none", borderRadius: 999 }}>
            <ArrowLeft size={16} /> Back
          </Link>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#aac0e1", display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
            <ListMusic size={22} /> Library
          </h1>
        </header>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          {(["saved", "playlists"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", transition: "all 0.2s",
                background: tab === t ? "#aac0e1" : "rgba(6,15,36,0.82)",
                color: tab === t ? "#fff" : "#8aafd4",
                boxShadow: tab === t ? "0 4px 16px rgba(170,192,225,0.3)" : "none",
              }}>
              {t === "saved" ? <Heart size={15} /> : <ListMusic size={15} />}
              {t === "saved" ? "Saved Songs" : "Playlists"}
              <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 999, background: tab === t ? "rgba(255,255,255,0.2)" : "rgba(30,41,59,0.8)" }}>
                {t === "saved" ? saved.length : playlists.length}
              </span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ── Saved Songs ── */}
          {tab === "saved" && (
            <motion.div key="saved" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              {/* Search */}
              <div style={{ position: "relative", marginBottom: 16 }}>
                <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#7a9cc4" }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search saved songs…"
                  style={{ width: "100%", background: "rgba(6,15,36,0.7)", border: "1px solid rgba(170,192,225,0.1)", borderRadius: 12, padding: "10px 12px 10px 36px", fontSize: 13, color: "#f5feff", outline: "none", boxSizing: "border-box" }} />
              </div>

              {filtered.length === 0 ? (
                <div style={{ ...CARD, padding: "64px 24px", textAlign: "center" }}>
                  <Heart size={40} style={{ color: "#0e2f76", margin: "0 auto 12px" }} />
                  <p style={{ color: "#7a9cc4", fontSize: 13 }}>{saved.length === 0 ? "No saved songs yet. Save songs from the player!" : "No songs match your search."}</p>
                </div>
              ) : (
                <div style={{ ...CARD }}>
                  {filtered.map((t, i) => (
                    <motion.div key={t.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: i < filtered.length - 1 ? "1px solid rgba(170,192,225,0.06)" : "none", position: "relative" }}
                      className="group">
                      <div style={{ height: 42, width: 42, borderRadius: 10, overflow: "hidden", background: "#0a1a3a", flexShrink: 0 }}>
                        {t.cover
                          ? <img src={t.cover} alt={t.name} style={{ height: "100%", width: "100%", objectFit: "cover" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          : <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><Music2 size={18} style={{ color: "#aac0e1" }} /></div>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: "#f5feff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</p>
                        <p style={{ fontSize: 11, color: "#7a9cc4", margin: 0 }}>{t.artist}{t.album ? ` · ${t.album}` : ""}</p>
                      </div>
                      <p style={{ fontSize: 10, color: "#0e2f76", marginRight: 4 }}>{new Date(t.savedAt).toLocaleDateString()}</p>
                      {/* Add to playlist */}
                      {playlists.length > 0 && (
                        <div style={{ position: "relative" }}>
                          <button onClick={e => { e.stopPropagation(); setAddMenuId(addMenuId === t.id ? null : t.id); }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#aac0e1", padding: 6 }}
                            onMouseEnter={e => (e.currentTarget.style.color = "#aac0e1")}
                            onMouseLeave={e => (e.currentTarget.style.color = "#aac0e1")}>
                            <Plus size={15} />
                          </button>
                          {addMenuId === t.id && (
                            <div style={{ position: "absolute", right: 0, top: 28, zIndex: 20, ...CARD, minWidth: 150, padding: "6px 0", borderRadius: 12 }} onClick={e => e.stopPropagation()}>
                              {playlists.map(pl => (
                                <button key={pl.id} onClick={() => addToPl(pl, t)}
                                  style={{ width: "100%", textAlign: "left", padding: "8px 14px", fontSize: 12, color: "#aac0e1", background: "none", border: "none", cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#aac0e1"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(170,192,225,0.06)"; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#aac0e1"; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}>
                                  {pl.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      <button onClick={() => removeSaved(t.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#0e2f76", padding: 6 }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
                        onMouseLeave={e => (e.currentTarget.style.color = "#0e2f76")}>
                        <Trash2 size={14} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Playlists ── */}
          {tab === "playlists" && (
            <motion.div key="playlists" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
              {/* Create */}
              <div style={{ marginBottom: 20 }}>
                {creating ? (
                  <div style={{ display: "flex", gap: 10 }}>
                    <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") createPlaylist(); if (e.key === "Escape") setCreating(false); }}
                      placeholder="Playlist name…" maxLength={40}
                      style={{ flex: 1, background: "rgba(6,15,36,0.7)", border: "1px solid rgba(170,192,225,0.3)", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#f5feff", outline: "none" }} />
                    <button onClick={createPlaylist}
                      style={{ padding: "10px 20px", borderRadius: 12, background: "#aac0e1", border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      Create
                    </button>
                    <button onClick={() => setCreating(false)}
                      style={{ padding: "10px 16px", borderRadius: 12, ...CARD, border: "1px solid rgba(170,192,225,0.1)", color: "#8aafd4", fontSize: 13, cursor: "pointer" }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setCreating(true)}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 12, background: "rgba(170,192,225,0.08)", border: "1px solid rgba(170,192,225,0.2)", color: "#aac0e1", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    <Plus size={15} /> New Playlist
                  </button>
                )}
              </div>

              {/* Playlist detail */}
              {activePl ? (
                <div>
                  <button onClick={() => setActivePl(null)}
                    style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#7a9cc4", background: "none", border: "none", cursor: "pointer", marginBottom: 16 }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#aac0e1")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#7a9cc4")}>
                    <ArrowLeft size={15} /> All Playlists
                  </button>
                  <div style={{ ...CARD, padding: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
                      <div style={{ height: 52, width: 52, borderRadius: 12, background: "linear-gradient(135deg, #aac0e1, #0e2f76)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <ListMusic size={26} style={{ color: "#fff" }} />
                      </div>
                      <div>
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#aac0e1", margin: 0 }}>{activePl.name}</h2>
                        <p style={{ fontSize: 12, color: "#7a9cc4", margin: 0 }}>{activePl.tracks.length} songs</p>
                      </div>
                    </div>
                    {activePl.tracks.length === 0 ? (
                      <p style={{ color: "#7a9cc4", fontSize: 13, textAlign: "center", padding: "32px 0" }}>No songs yet. Add from your Saved Songs!</p>
                    ) : (
                      activePl.tracks.map((t, i) => (
                        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 8px", borderBottom: i < activePl.tracks.length - 1 ? "1px solid rgba(170,192,225,0.06)" : "none" }}>
                          <span style={{ fontSize: 11, color: "#0e2f76", width: 20, textAlign: "center" }}>{i + 1}</span>
                          <div style={{ height: 36, width: 36, borderRadius: 8, overflow: "hidden", background: "#0a1a3a", flexShrink: 0 }}>
                            {t.cover ? <img src={t.cover} alt={t.name} style={{ height: "100%", width: "100%", objectFit: "cover" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                              : <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><Music2 size={14} style={{ color: "#aac0e1" }} /></div>}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 500, color: "#f5feff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</p>
                            <p style={{ fontSize: 11, color: "#7a9cc4", margin: 0 }}>{t.artist}</p>
                          </div>
                          <button onClick={() => removeFromPl(activePl.id, t.id)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#0e2f76", padding: 6 }}
                            onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
                            onMouseLeave={e => (e.currentTarget.style.color = "#0e2f76")}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : playlists.length === 0 ? (
                <div style={{ ...CARD, padding: "64px 24px", textAlign: "center" }}>
                  <ListMusic size={40} style={{ color: "#0e2f76", margin: "0 auto 12px" }} />
                  <p style={{ color: "#7a9cc4", fontSize: 13 }}>No playlists yet. Create one above!</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
                  {playlists.map((pl, i) => (
                    <motion.div key={pl.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      onClick={() => setActivePl(pl)}
                      style={{ ...CARD, padding: 16, cursor: "pointer", position: "relative" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(170,192,225,0.25)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(170,192,225,0.10)"; }}>
                      <div style={{ height: 80, borderRadius: 10, background: "linear-gradient(135deg, rgba(170,192,225,0.15), rgba(30,58,95,0.4))", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, position: "relative", overflow: "hidden" }}>
                        {pl.tracks[0]?.cover && <img src={pl.tracks[0].cover} alt="" style={{ position: "absolute", inset: 0, height: "100%", width: "100%", objectFit: "cover", opacity: 0.3 }} />}
                        <ListMusic size={28} style={{ color: "#aac0e1", position: "relative", zIndex: 1 }} />
                      </div>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#f5feff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pl.name}</p>
                          <p style={{ fontSize: 11, color: "#7a9cc4", margin: 0 }}>{pl.tracks.length} songs</p>
                        </div>
                        <button onClick={e => { e.stopPropagation(); deletePl(pl.id); }}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#0e2f76", padding: 4, flexShrink: 0 }}
                          onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
                          onMouseLeave={e => (e.currentTarget.style.color = "#0e2f76")}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ marginTop: 32, display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#0e2f76" }}>
          <BookmarkCheck size={13} style={{ color: "#0e2f76" }} />
          Save songs from the player using the bookmark icon. Playlists are stored locally on this device.
        </div>
      </motion.div>
    </>
  );
}



