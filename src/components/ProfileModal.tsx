import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check, Sun, Moon, Pencil, Save, User } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string;
  displayName: string;
  email: string;
};

export function ProfileModal({ open, onClose, userId, displayName, email }: Props) {
  const { theme, toggle } = useTheme();
  const { updateDisplayName } = useAuth();

  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(displayName);
  const [saving, setSaving] = useState(false);

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
    if (error) { toast.error(error); }
    else { toast.success("Username updated!"); setEditing(false); }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 24 }}
            transition={{ type: "spring", stiffness: 360, damping: 28 }}
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm px-4"
          >
            <div className="glass glow-border rounded-3xl p-6 relative">

              {/* Close */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 h-8 w-8 rounded-full glass border border-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-white/30 transition"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Avatar + name */}
              <div className="flex flex-col items-center mb-5 pt-1">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-[#aac0e1] to-[#c0005a] flex items-center justify-center text-2xl font-bold text-white shadow-neon mb-3 select-none">
                  {displayName.slice(0, 1).toUpperCase()}
                </div>

                {/* Editable username */}
                {editing ? (
                  <div className="flex items-center gap-2 w-full max-w-[220px]">
                    <input
                      autoFocus
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveUsername(); if (e.key === "Escape") setEditing(false); }}
                      maxLength={32}
                      className="flex-1 bg-input border border-[#aac0e1]/50 rounded-xl px-3 py-1.5 text-sm text-center font-semibold focus:outline-none focus:border-[#aac0e1] transition"
                    />
                    <button
                      onClick={saveUsername}
                      disabled={saving}
                      className="h-8 w-8 rounded-xl bg-[#aac0e1]/20 border border-[#aac0e1]/40 text-[#aac0e1] flex items-center justify-center hover:bg-[#aac0e1]/30 transition disabled:opacity-50"
                    >
                      <Save className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-gradient">{displayName}</h2>
                    <button
                      onClick={() => { setNameInput(displayName); setEditing(true); }}
                      className="p-1 rounded-lg text-muted-foreground hover:text-[#aac0e1] transition"
                      title="Edit username"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">{email}</p>
              </div>

              {/* User ID */}
              <div className="mb-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <User className="h-3 w-3" /> Your User ID
                </p>
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10">
                  <p className="flex-1 text-[11px] font-mono text-[#aac0e1] break-all leading-relaxed select-all">
                    {userId}
                  </p>
                  <button
                    onClick={copyId}
                    className="flex-shrink-0 h-7 w-7 rounded-lg glass border border-white/10 flex items-center justify-center text-muted-foreground hover:text-[#aac0e1] hover:border-[#aac0e1]/40 transition"
                    title="Copy ID"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground/50 mt-1.5 text-center">
                  Share this ID so friends can add you
                </p>
              </div>

              {/* Theme toggle */}
              <div className="flex items-center justify-between px-3 py-3 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-2.5">
                  {theme === "dark"
                    ? <Moon className="h-4 w-4 text-[#aac0e1]" />
                    : <Sun className="h-4 w-4 text-amber-400" />
                  }
                  <span className="text-sm font-medium">{theme === "dark" ? "Dark Mode" : "Light Mode"}</span>
                </div>
                {/* Toggle pill */}
                <button
                  onClick={toggle}
                  role="switch"
                  aria-checked={theme === "dark"}
                  className={`relative h-6 w-11 rounded-full transition-colors duration-300 focus:outline-none ${
                    theme === "dark" ? "bg-[#aac0e1]" : "bg-white/20"
                  }`}
                >
                  <span
                    className={`absolute top-[3px] left-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-md transition-transform duration-300 ${
                      theme === "dark" ? "translate-x-[20px]" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

