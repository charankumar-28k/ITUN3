import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserPlus, MessageCircle, Check, CheckCheck, X, Send, ChevronLeft,
  Search, Loader2, Lock, Music2, Users2, Phone, Video, UserCheck,
} from "lucide-react";
import { useFriends, type Friend, type DM } from "@/lib/friends";

type SongMention = { id: string; name: string; artists: string; cover: string };

type Props = {
  userId: string;
  displayName: string;
  currentTrack?: { id: string; name: string; artists: string; cover: string } | null;
};

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(ts: number) {
  const d = new Date(ts), today = new Date(), yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}
function sameDay(a: number, b: number) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

// ── Chat bubble ───────────────────────────────────────────────────────────────
function Bubble({ dm, mine, showTail }: { dm: DM; mine: boolean; showTail: boolean }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} ${showTail ? "mt-2" : "mt-0.5"}`}>
      <div className={`max-w-[75%] flex flex-col ${mine ? "items-end" : "items-start"}`}>
        <div className={`px-3.5 py-2 text-sm leading-snug break-words whitespace-pre-wrap ${
          mine
            ? "bg-[#c0005a] text-white"
            : "bg-white/10 border border-white/10 text-foreground"
        } ${showTail ? (mine ? "rounded-2xl rounded-br-sm" : "rounded-2xl rounded-bl-sm") : "rounded-2xl"}`}>
          {/* Greeting image */}
          {dm.greetingImage && (
            <img
              src={dm.greetingImage}
              alt="Greeting"
              className="rounded-xl mb-2 max-w-full max-h-48 object-contain border border-white/10"
            />
          )}
          {/* Song mention */}
          {dm.songMention && (
            <div className="flex items-center gap-2 mb-1.5 p-2 rounded-xl bg-black/20 border border-white/10">
              {dm.songMention.cover && <img src={dm.songMention.cover} alt={dm.songMention.name} className="h-8 w-8 rounded object-cover flex-shrink-0" />}
              <div className="min-w-0">
                <p className="text-[11px] font-semibold truncate text-orange-300">🎵 {dm.songMention.name}</p>
                <p className="text-[10px] opacity-70 truncate">{dm.songMention.artists}</p>
              </div>
            </div>
          )}
          <span>{dm.text}</span>
          <span className="inline-flex items-center gap-1 ml-2 float-right mt-1 -mb-0.5">
            <span className="text-[10px] opacity-60">{fmtTime(dm.ts)}</span>
            {mine && (dm.read
              ? <CheckCheck className="h-3 w-3 text-[#aac0e1]" />
              : <Check className="h-3 w-3 opacity-50" />
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function FriendsPanel({ userId, displayName, currentTrack }: Props) {
  const {
    requests, friends, activeFriend, dms, dmLoading,
    searchUid, setSearchUid, searchResult, searching,
    openDm, closeDm, sendDm, markRead,
    acceptRequest, rejectRequest,
    searchUser, sendRequest,
    unreadCounts,
  } = useFriends(userId, displayName);

  const [text, setText]                   = useState("");
  const [pendingMention, setPendingMention] = useState<SongMention | null>(null);
  const [tab, setTab]                     = useState<"chats" | "requests" | "add">("chats");
  const [sendingReq, setSendingReq]       = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [dms]);

  useEffect(() => {
    if (activeFriend) markRead(activeFriend.uid);
  }, [dms, activeFriend, markRead]);

const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !pendingMention) return;
    await sendDm(text.trim() || `🎵 ${pendingMention!.name}`, pendingMention);
    setText(""); setPendingMention(null);
    inputRef.current?.focus();
  }, [text, pendingMention, sendDm]);

  const handleSendRequest = async (uid: string) => {
    setSendingReq(true);
    await sendRequest(uid);
    setSendingReq(false);
  };

  // ── DM view ────────────────────────────────────────────────────────────────
  if (activeFriend) {
    const items: Array<
      | { type: "date"; label: string }
      | { type: "msg"; dm: DM; showTail: boolean }
    > = [];
    dms.forEach((dm, i) => {
      const prev = dms[i - 1];
      if (!prev || !sameDay(prev.ts, dm.ts))
        items.push({ type: "date", label: fmtDate(dm.ts) });
      const showTail = !prev || prev.from !== dm.from || !sameDay(prev.ts, dm.ts);
      items.push({ type: "msg", dm, showTail });
    });

    return (
      <div className="glass glow-border rounded-2xl flex flex-col h-full min-h-[480px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8 bg-white/3">
          <button onClick={closeDm} className="p-1.5 rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground transition">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="relative">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#aac0e1] to-[#c0005a] flex items-center justify-center text-sm font-bold text-white select-none">
              {activeFriend.displayName.slice(0, 1).toUpperCase()}
            </div>
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-400 border-2 border-background" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{activeFriend.displayName}</p>
            <p className="text-[10px] text-green-400 flex items-center gap-1">
              <Lock className="h-2.5 w-2.5" /> end-to-end encrypted
            </p>
          </div>
          <button className="p-2 rounded-full hover:bg-white/10 text-muted-foreground transition" title="Voice (coming soon)">
            <Phone className="h-4 w-4" />
          </button>
          <button className="p-2 rounded-full hover:bg-white/10 text-muted-foreground transition" title="Video (coming soon)">
            <Video className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3" style={{ background: "oklch(0.10 0.03 260 / 0.5)" }}>
          {dmLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : dms.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
              <Lock className="h-7 w-7 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground/50">Messages are end-to-end encrypted.<br />Say hello 👋</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {items.map((item, idx) =>
                item.type === "date" ? (
                  <div key={`d-${idx}`} className="flex justify-center my-3">
                    <span className="text-[10px] text-muted-foreground/60 px-3 py-1 rounded-full bg-white/5 border border-white/8">
                      {item.label}
                    </span>
                  </div>
                ) : (
                  <motion.div
                    key={item.dm.id}
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  >
                    <Bubble dm={item.dm} mine={item.dm.from === userId} showTail={item.showTail} />
                  </motion.div>
                )
              )}
            </AnimatePresence>
          )}
        </div>

        {/* Input */}
        <div className="px-3 py-2.5 border-t border-white/8 bg-white/3">
          {pendingMention && (
            <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/30">
              {pendingMention.cover && <img src={pendingMention.cover} alt={pendingMention.name} className="h-6 w-6 rounded object-cover" />}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium truncate text-orange-400">{pendingMention.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{pendingMention.artists}</p>
              </div>
              <button type="button" onClick={() => setPendingMention(null)} className="text-muted-foreground hover:text-red-400">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <form onSubmit={submit} className="flex items-center gap-2">
            {currentTrack && (
              <button type="button" title="Share song"
                onClick={() => setPendingMention({ id: currentTrack.id, name: currentTrack.name, artists: currentTrack.artists, cover: currentTrack.cover })}
                className="flex-shrink-0 h-9 w-9 rounded-full glass border border-white/10 flex items-center justify-center text-muted-foreground hover:text-orange-400 hover:border-orange-400 transition">
                <Music2 className="h-4 w-4" />
              </button>
            )}
            <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) submit(e); }}
              placeholder="Message…" maxLength={500}
              className="flex-1 bg-white/8 border border-white/10 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-[#aac0e1]/60 transition" />
            <button type="submit" disabled={!text.trim() && !pendingMention}
              className="flex-shrink-0 h-9 w-9 rounded-full bg-[#c0005a] text-white flex items-center justify-center hover:bg-[oklch(0.65_0.22_260)] transition disabled:opacity-40 disabled:cursor-not-allowed">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <div className="glass glow-border rounded-2xl flex flex-col h-full min-h-[320px] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8">
        <Users2 className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Friends</h3>
        {requests.length > 0 && (
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 animate-pulse font-medium">
            {requests.length} new
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/8">
        {(["chats", "requests", "add"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-[11px] font-medium transition-all relative ${
              tab === t ? "text-[#aac0e1]" : "text-muted-foreground hover:text-foreground"
            }`}>
            {t === "chats"
              ? `Chats (${friends.length})`
              : t === "requests"
              ? `Requests${requests.length ? ` (${requests.length})` : ""}`
              : "Add Friend"}
            {tab === t && (
              <motion.div layoutId="fp-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#aac0e1] rounded-full" />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* ── Chats ── */}
        {tab === "chats" && (
          friends.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 px-6 text-center">
              <MessageCircle className="h-10 w-10 text-muted-foreground/20" />
              <p className="text-xs text-muted-foreground/60">No friends yet.<br />Go to "Add Friend" to connect.</p>
            </div>
          ) : (
            friends.map((f) => {
              const unread = unreadCounts[f.uid] ?? 0;
              return (
                <motion.button key={f.uid} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  onClick={() => openDm(f)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition text-left border-b border-white/5 last:border-0">
                  <div className="relative flex-shrink-0">
                    <div className="h-11 w-11 rounded-full bg-gradient-to-br from-[#aac0e1] to-[#c0005a] flex items-center justify-center text-sm font-bold text-white select-none">
                      {f.displayName.slice(0, 1).toUpperCase()}
                    </div>
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-400 border-2 border-background" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold truncate">{f.displayName}</p>
                      {f.lastMessageTs && <span className="text-[10px] text-muted-foreground ml-2 flex-shrink-0">{fmtTime(f.lastMessageTs)}</span>}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                        {f.lastMessage ?? <span className="flex items-center gap-1 opacity-60"><Lock className="h-2.5 w-2.5" /> E2E encrypted</span>}
                      </p>
                      {unread > 0 && (
                        <span className="flex-shrink-0 ml-2 h-5 min-w-[20px] px-1.5 rounded-full bg-[#c0005a] text-white text-[10px] font-bold flex items-center justify-center">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.button>
              );
            })
          )
        )}

        {/* ── Requests ── */}
        {tab === "requests" && (
          <div className="p-3 space-y-2">
            {requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                <UserCheck className="h-8 w-8 text-muted-foreground/20" />
                <p className="text-xs text-muted-foreground/60">No pending requests.<br />Requests appear here instantly.</p>
              </div>
            ) : (
              <AnimatePresence>
                {requests.map((req) => (
                  <motion.div key={req.id}
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex items-center gap-3 px-3 py-3 rounded-2xl glass border border-white/10">
                    <div className="h-11 w-11 rounded-full bg-gradient-to-br from-[#aac0e1] to-[#c0005a] flex items-center justify-center text-sm font-bold text-white flex-shrink-0 select-none">
                      {req.fromName.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{req.fromName}</p>
                      <p className="text-[10px] text-muted-foreground">wants to connect with you</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => acceptRequest(req)}
                        className="px-3 py-1.5 rounded-xl bg-[#c0005a] text-white text-xs font-semibold hover:opacity-90 transition flex items-center gap-1">
                        <Check className="h-3 w-3" /> Accept
                      </button>
                      <button onClick={() => rejectRequest(req)}
                        className="px-3 py-1.5 rounded-xl glass border border-white/10 text-muted-foreground text-xs hover:text-red-400 hover:border-red-400/30 transition flex items-center gap-1">
                        <X className="h-3 w-3" /> Decline
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        )}

        {/* ── Add Friend ── */}
        {tab === "add" && (
          <div className="p-4 space-y-4">
            <p className="text-[11px] text-muted-foreground/70">
              Paste a friend's User ID to send them a request.
            </p>

            {/* Search bar */}
            <div className="flex gap-2">
              <input
                value={searchUid}
                onChange={(e) => setSearchUid(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !searching && searchUid.trim() && searchUser(searchUid)}
                placeholder="Paste User ID…"
                className="flex-1 bg-input border border-border rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#aac0e1] transition"
              />
              <button
                onClick={() => searchUser(searchUid)}
                disabled={!searchUid.trim() || searching}
                className="px-4 rounded-2xl bg-[#c0005a] text-white font-semibold hover:opacity-90 transition disabled:opacity-40 flex items-center gap-2 text-sm">
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {searching ? "…" : "Find"}
              </button>
            </div>

            {/* Search result */}
            <AnimatePresence>
              {searchResult && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-[#aac0e1]/40 bg-[#aac0e1]/5">
                  <div className="h-11 w-11 rounded-full bg-gradient-to-br from-[#aac0e1] to-[#c0005a] flex items-center justify-center text-sm font-bold text-white flex-shrink-0 select-none">
                    {searchResult.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{searchResult.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate font-mono">{searchResult.uid.slice(0, 20)}…</p>
                  </div>
                  <button
                    onClick={() => handleSendRequest(searchResult.uid)}
                    disabled={sendingReq}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-[#c0005a] text-white text-xs font-semibold hover:opacity-90 transition disabled:opacity-50 flex-shrink-0">
                    {sendingReq ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                    {sendingReq ? "Sending…" : "Add Friend"}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Your own UID */}
            <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/10">
              <p className="text-[10px] text-muted-foreground mb-1.5 font-medium uppercase tracking-wider">Your User ID</p>
              <p
                className="text-[11px] font-mono text-[#aac0e1] cursor-pointer hover:opacity-80 transition break-all select-all"
                onClick={() => { navigator.clipboard.writeText(userId); }}
                title="Click to copy">
                {userId}
              </p>
              <p className="text-[10px] text-muted-foreground/50 mt-1.5">Tap to copy · share with friends</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

