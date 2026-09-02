import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Trash2, TrendingUp, Music2, Clock } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Cell,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { EMOTION_META, type Emotion } from "@/lib/music";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "Mood Insights — Mood Sync" },
      { name: "description", content: "Your mood timeline and listening insights." },
    ],
  }),
  component: InsightsPage,
});

type Row = {
  id: string;
  emotion: Emotion;
  track_id: string | null;
  track_title: string | null;
  track_artist: string | null;
  created_at: string;
};

const BG: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: -1,
  background: "#060f24",
  backgroundImage:
    "radial-gradient(ellipse at 15% 10%, rgba(170,192,225,0.12) 0%, transparent 45%), " +
    "radial-gradient(ellipse at 85% 85%, rgba(170,192,225,0.06) 0%, transparent 45%)",
};

const CARD: React.CSSProperties = {
  background: "rgba(10,25,60,0.85)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border: "1px solid rgba(170, 192, 225, 0.10)",
  boxShadow: "0 4px 32px -4px rgba(0,0,0,0.6), inset 0 1px 0 rgba(148,163,184,0.04)",
  borderRadius: "1rem",
};

function InsightsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("mood_history").select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => setRows((data ?? []) as Row[]));
  }, [user]);

  const weekly = useMemo(() => {
    if (!rows) return [];
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = rows.filter((r) => new Date(r.created_at).getTime() >= cutoff);
    return (Object.keys(EMOTION_META) as Emotion[]).map((e) => ({
      emotion: e,
      label: EMOTION_META[e].emoji + " " + EMOTION_META[e].label,
      count: recent.filter((r) => r.emotion === e).length,
      color: EMOTION_META[e].color,
    }));
  }, [rows]);

  const topTracks = useMemo(() => {
    if (!rows) return {} as Record<Emotion, { title: string; artist: string; count: number }[]>;
    const grouped: Record<string, Record<string, { title: string; artist: string; count: number }>> = {};
    for (const r of rows) {
      if (!r.track_id || !r.track_title) continue;
      grouped[r.emotion] ??= {};
      grouped[r.emotion][r.track_id] ??= { title: r.track_title, artist: r.track_artist ?? "", count: 0 };
      grouped[r.emotion][r.track_id].count++;
    }
    const out: Record<string, { title: string; artist: string; count: number }[]> = {};
    for (const [k, v] of Object.entries(grouped))
      out[k] = Object.values(v).sort((a, b) => b.count - a.count).slice(0, 3);
    return out as Record<Emotion, { title: string; artist: string; count: number }[]>;
  }, [rows]);

  const remove = async (id: string) => {
    await supabase.from("mood_history").delete().eq("id", id);
    setRows((r) => r?.filter((x) => x.id !== id) ?? null);
  };

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
        style={{ minHeight: "100vh", padding: "1.5rem 1rem", maxWidth: 1100, margin: "0 auto", position: "relative" }}
      >
        {/* Header */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem", gap: 12, flexWrap: "wrap" }}>
          <Link to="/" style={{ ...CARD, display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", fontSize: 14, color: "#aac0e1", textDecoration: "none", borderRadius: 999, flexShrink: 0 }}>
            <ArrowLeft size={16} /> Back
          </Link>
          <div style={{ textAlign: "right" }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#aac0e1", display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end", margin: 0 }}>
              <TrendingUp size={20} /> Mood Insights
            </h1>
            <p style={{ fontSize: 11, color: "#7a9cc4", letterSpacing: "0.25em", textTransform: "uppercase", marginTop: 2 }}>your week in feelings</p>
          </div>
        </header>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Total Detections", value: rows?.length ?? "—", icon: <TrendingUp size={16} style={{ color: "#aac0e1" }} /> },
            { label: "This Week", value: weekly.reduce((s, w) => s + w.count, 0), icon: <Clock size={16} style={{ color: "#aac0e1" }} /> },
            { label: "Tracks Logged", value: rows?.filter(r => r.track_id).length ?? "—", icon: <Music2 size={16} style={{ color: "#aac0e1" }} /> },
          ].map((s) => (
            <div key={s.label} style={{ ...CARD, padding: "16px 12px", textAlign: "center" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>{s.icon}</div>
              <p style={{ fontSize: 26, fontWeight: 700, color: "#aac0e1", margin: 0 }}>{s.value}</p>
              <p style={{ fontSize: 11, color: "#7a9cc4", marginTop: 2 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 24 }}>
          {/* Bar chart */}
          <div style={{ ...CARD, padding: 20 }}>
            <h2 style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.25em", color: "#7a9cc4", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <TrendingUp size={13} style={{ color: "#aac0e1" }} /> Last 7 days
            </h2>
            {rows?.length === 0 ? (
              <p style={{ color: "#7a9cc4", fontSize: 13, textAlign: "center", padding: "48px 0" }}>
                No mood detections yet. Go back and tap "Detect My Mood".
              </p>
            ) : (
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(170,192,225,0.07)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#8aafd4" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#8aafd4" }} />
                    <Tooltip contentStyle={{ background: "#060f24", border: "1px solid rgba(170,192,225,0.2)", borderRadius: 10, color: "#f5feff", fontSize: 12 }} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {weekly.map((d) => <Cell key={d.emotion} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Top tracks */}
          <div style={{ ...CARD, padding: 20 }}>
            <h2 style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.25em", color: "#7a9cc4", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <Music2 size={13} style={{ color: "#aac0e1" }} /> Top tracks per mood
            </h2>
            <div style={{ maxHeight: 240, overflowY: "auto" }}>
              {(Object.keys(EMOTION_META) as Emotion[]).map((e) => {
                const list = topTracks[e] ?? [];
                if (!list.length) return null;
                return (
                  <div key={e} style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: EMOTION_META[e].color, marginBottom: 4 }}>
                      {EMOTION_META[e].emoji} {EMOTION_META[e].label}
                    </p>
                    {list.map((t, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#8aafd4", marginBottom: 2 }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                          <span style={{ color: "#f5feff" }}>{t.title}</span> · {t.artist}
                        </span>
                        <span style={{ color: "#aac0e1", marginLeft: 8, flexShrink: 0 }}>×{t.count}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
              {Object.keys(topTracks).length === 0 && (
                <p style={{ color: "#7a9cc4", fontSize: 12, textAlign: "center", padding: "32px 0" }}>Nothing yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div>
          <h2 style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.25em", color: "#7a9cc4", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={13} style={{ color: "#aac0e1" }} /> Timeline
          </h2>
          <div style={{ ...CARD, maxHeight: 400, overflowY: "auto" }}>
            {rows === null && (
              <div style={{ padding: 32, textAlign: "center", color: "#7a9cc4", fontSize: 13 }}>
                <Loader2 size={16} style={{ display: "inline", marginRight: 8, color: "#aac0e1" }} /> Loading…
              </div>
            )}
            {rows?.length === 0 && (
              <div style={{ padding: 32, textAlign: "center", color: "#7a9cc4", fontSize: 13 }}>No history yet.</div>
            )}
            {rows?.map((r, i) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: i < rows.length - 1 ? "1px solid rgba(170,192,225,0.06)" : "none" }}>
                <span style={{ height: 36, width: 36, borderRadius: 10, display: "grid", placeItems: "center", fontSize: 18, flexShrink: 0, background: `${EMOTION_META[r.emotion].color}22` }}>
                  {EMOTION_META[r.emotion].emoji}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "#f5feff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {EMOTION_META[r.emotion].label}
                    {r.track_title && <span style={{ color: "#7a9cc4" }}> · {r.track_title} — {r.track_artist}</span>}
                  </p>
                  <p style={{ fontSize: 11, color: "#aac0e1", margin: 0 }}>{new Date(r.created_at).toLocaleString()}</p>
                </div>
                <button onClick={() => remove(r.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#aac0e1", padding: 8 }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#aac0e1")}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </>
  );
}



