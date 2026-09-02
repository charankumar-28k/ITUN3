import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Copy, Check, Sun, Moon, Pencil, Save, User, Mail, Shield, LogOut } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Mood Sync" },
      { name: "description", content: "Your Mood Sync profile settings." },
    ],
  }),
  component: ProfilePage,
});

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

function ProfilePage() {
  const { user, profile, loading, signOut, updateDisplayName } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  const userId      = user?.id ?? "";
  const displayName = profile?.display_name ?? user?.email?.split("@")[0] ?? "Listener";
  const email       = user?.email ?? "";

  const [copied, setCopied]       = useState(false);
  const [editing, setEditing]     = useState(false);
  const [nameInput, setNameInput] = useState(displayName);
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/" });
  }, [loading, user, navigate]);

  useEffect(() => { setNameInput(displayName); }, [displayName]);

  const copyId = () => {
    navigator.clipboard.writeText(userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const saveUsername = async () => {
    if (!nameInput.trim() || nameInput.trim() === displayName) { setEditing(false); return; }
    setSaving(true);
    const { error } = await updateDisplayName(nameInput.trim());
    setSaving(false);
    if (error) toast.error(error);
    else { toast.success("Username updated!"); setEditing(false); }
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
        style={{ minHeight: "100vh", padding: "1.5rem 1rem", maxWidth: 560, margin: "0 auto", position: "relative" }}
      >
        {/* Header */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem", gap: 12, flexWrap: "wrap" }}>
          <Link to="/" style={{ ...CARD, display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", fontSize: 14, color: "#aac0e1", textDecoration: "none", borderRadius: 999 }}>
            <ArrowLeft size={16} /> Back
          </Link>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#aac0e1", display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
            <User size={22} /> Profile
          </h1>
        </header>

        {/* Avatar card */}
        <div style={{ ...CARD, padding: "32px 24px", marginBottom: 16, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{
            height: 88, width: 88, borderRadius: "50%",
            background: "linear-gradient(135deg, #aac0e1, #0e2f76)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 36, fontWeight: 700, color: "#fff",
            boxShadow: "0 0 32px rgba(170,192,225,0.25)",
            marginBottom: 16, userSelect: "none",
          }}>
            {displayName.slice(0, 1).toUpperCase()}
          </div>

          {editing ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", maxWidth: 260, marginBottom: 8 }}>
              <input
                autoFocus value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveUsername(); if (e.key === "Escape") setEditing(false); }}
                maxLength={32}
                style={{ flex: 1, background: "rgba(15,23,42,0.9)", border: "1px solid rgba(170,192,225,0.4)", borderRadius: 12, padding: "8px 12px", fontSize: 14, textAlign: "center", fontWeight: 600, color: "#f5feff", outline: "none" }}
              />
              <button onClick={saveUsername} disabled={saving}
                style={{ height: 36, width: 36, borderRadius: 10, background: "rgba(170,192,225,0.15)", border: "1px solid rgba(170,192,225,0.3)", color: "#aac0e1", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#aac0e1", margin: 0 }}>{displayName}</h2>
              <button onClick={() => { setNameInput(displayName); setEditing(true); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#7a9cc4", padding: 4 }}
                onMouseEnter={e => (e.currentTarget.style.color = "#aac0e1")}
                onMouseLeave={e => (e.currentTarget.style.color = "#7a9cc4")}>
                <Pencil size={14} />
              </button>
            </div>
          )}
          <p style={{ fontSize: 13, color: "#7a9cc4", display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
            <Mail size={13} /> {email}
          </p>
        </div>

        {/* User ID */}
        <div style={{ ...CARD, padding: 20, marginBottom: 12 }}>
          <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "#7a9cc4", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <Shield size={11} style={{ color: "#aac0e1" }} /> Your User ID
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, background: "rgba(5,10,20,0.7)", border: "1px solid rgba(170,192,225,0.08)" }}>
            <p style={{ flex: 1, fontSize: 11, fontFamily: "monospace", color: "#aac0e1", wordBreak: "break-all", margin: 0, userSelect: "all" }}>{userId}</p>
            <button onClick={copyId}
              style={{ flexShrink: 0, height: 30, width: 30, borderRadius: 8, background: "rgba(30,41,59,0.8)", border: "1px solid rgba(170,192,225,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#8aafd4" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#aac0e1")}
              onMouseLeave={e => (e.currentTarget.style.color = "#8aafd4")}>
              {copied ? <Check size={13} style={{ color: "#4ade80" }} /> : <Copy size={13} />}
            </button>
          </div>
          <p style={{ fontSize: 10, color: "#0e2f76", marginTop: 8, textAlign: "center" }}>Share this ID so friends can add you</p>
        </div>

        {/* Theme toggle */}
        <div style={{ ...CARD, padding: 20, marginBottom: 12 }}>
          <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "#7a9cc4", marginBottom: 14 }}>Appearance</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {theme === "dark"
                ? <Moon size={18} style={{ color: "#aac0e1" }} />
                : <Sun size={18} style={{ color: "#fbbf24" }} />}
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: "#f5feff", margin: 0 }}>{theme === "dark" ? "Dark Mode" : "Light Mode"}</p>
                <p style={{ fontSize: 11, color: "#7a9cc4", margin: 0 }}>{theme === "dark" ? "Easy on the eyes" : "Bright and clear"}</p>
              </div>
            </div>
            <button onClick={toggle} role="switch" aria-checked={theme === "dark"}
              style={{ position: "relative", height: 28, width: 48, borderRadius: 999, border: "none", cursor: "pointer", background: theme === "dark" ? "#aac0e1" : "#aac0e1", transition: "background 0.3s" }}>
              <span style={{ position: "absolute", top: 3, left: 3, height: 22, width: 22, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.3)", transition: "transform 0.3s", transform: theme === "dark" ? "translateX(20px)" : "translateX(0)" }} />
            </button>
          </div>
        </div>

        {/* Sign out */}
        <div style={{ ...CARD, padding: 16 }}>
          <button onClick={() => void signOut()}
            style={{ width: "100%", padding: "12px 0", borderRadius: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)", color: "#f87171", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.16)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.08)"; }}>
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </motion.div>
    </>
  );
}



