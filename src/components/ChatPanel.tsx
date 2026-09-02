import { useEffect, useRef, useState } from "react";
import { Send, MessageCircle, Music2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { ChatMsg } from "@/lib/room";

type SongMention = { id: string; name: string; artists: string; cover: string };

type Props = {
  userId: string;
  displayName?: string;
  enabled: boolean;
  messages: ChatMsg[];
  onSend: (text: string, songMention?: SongMention | null) => void;
  currentTrack?: { id: string; name: string; artists: string; cover: string } | null;
};

function Avatar({ name, mine }: { name: string; mine: boolean }) {
  return (
    <div
      className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold select-none ${
        mine
          ? "bg-[#aac0e1] text-white"
          : "bg-[#c0005a] text-white"
      }`}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function ChatPanel({ userId, displayName, enabled, messages, onSend, currentTrack }: Props) {
  const [text, setText] = useState("");
  const [pendingMention, setPendingMention] = useState<SongMention | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !pendingMention) return;
    onSend(text.trim() || (pendingMention ? `🎵 ${pendingMention.name}` : ""), pendingMention);
    setText("");
    setPendingMention(null);
  };

  // Group consecutive messages from the same user
  const grouped = messages.map((m, i) => {
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const isFirst = !prev || prev.user_id !== m.user_id;
    const isLast  = !next || next.user_id !== m.user_id;
    return { ...m, isFirst, isLast };
  });

  return (
    <div className="glass glow-border rounded-2xl p-4 h-full flex flex-col min-h-[320px]">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <MessageCircle className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Live Chat</h3>
        {enabled && messages.length > 0 && (
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-[#aac0e1]/20 text-[#aac0e1] border border-[#aac0e1]/30">
            {messages.length}
          </span>
        )}
      </div>

      {!enabled ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 px-6">
          <div className="h-12 w-12 rounded-full glass flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-muted-foreground/50" />
          </div>
          <p className="text-sm text-muted-foreground/70">
            Join or create a room to chat with friends.
          </p>
        </div>
      ) : (
        <>
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto pr-1 mb-3 max-h-72 space-y-0.5">
            <AnimatePresence initial={false}>
              {messages.length === 0 ? (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-muted-foreground/50 text-center py-8"
                >
                  Say hi 👋
                </motion.p>
              ) : (
                grouped.map((m) => {
                  const mine = m.user_id === userId;
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : "flex-row"} ${
                        m.isFirst ? "mt-3" : "mt-0.5"
                      }`}
                    >
                      {/* Avatar — only on last bubble in a group */}
                      <div className="w-7 flex-shrink-0">
                        {m.isLast ? (
                          <Avatar name={m.user_name} mine={mine} />
                        ) : null}
                      </div>

                      {/* Bubble */}
                      <div className={`flex flex-col max-w-[72%] ${mine ? "items-end" : "items-start"}`}>
                        {/* Name — only on first bubble in a group, receiver only */}
                        {!mine && m.isFirst && (
                          <span className="text-[10px] text-muted-foreground ml-3 mb-0.5 font-medium">
                            {m.user_name}
                          </span>
                        )}

                        <div
                          className={`relative px-3.5 py-2 text-sm leading-snug break-words whitespace-pre-wrap ${
                            mine
                              ? [
                                  "bg-gradient-to-br from-[#aac0e1] to-[#c0005a]",
                                  "text-white shadow-[0_0_12px_#aac0e1/40]",
                                  m.isFirst && m.isLast ? "rounded-2xl rounded-br-sm"
                                  : m.isFirst              ? "rounded-2xl rounded-br-sm rounded-bl-2xl"
                                  : m.isLast               ? "rounded-2xl rounded-br-sm"
                                  :                          "rounded-2xl",
                                ].join(" ")
                              : [
                                  "bg-white/8 border border-white/10 backdrop-blur-sm text-foreground",
                                  m.isFirst && m.isLast ? "rounded-2xl rounded-bl-sm"
                                  : m.isFirst              ? "rounded-2xl rounded-bl-sm"
                                  : m.isLast               ? "rounded-2xl rounded-bl-sm"
                                  :                          "rounded-2xl",
                                ].join(" ")
                          }`}
                        >
                          {m.songMention && (
                            <div className="flex items-center gap-2 mb-1.5 p-2 rounded-xl bg-black/20 border border-white/10">
                              {m.songMention.cover && <img src={m.songMention.cover} alt={m.songMention.name} className="h-8 w-8 rounded object-cover flex-shrink-0" />}
                              <div className="min-w-0">
                                <p className="text-[11px] font-semibold truncate text-orange-300">🎵 {m.songMention.name}</p>
                                <p className="text-[10px] opacity-70 truncate">{m.songMention.artists}</p>
                              </div>
                            </div>
                          )}
                          {m.text}
                        </div>

                        {/* Timestamp — only on last bubble */}
                        {m.isLast && (
                          <span className={`text-[10px] mt-1 px-1 text-muted-foreground/60`}>
                            {new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>

          {/* Input */}
          <form onSubmit={submit} className="flex gap-2 items-center">
            <div className="flex-1 relative">
              {pendingMention && (
                <div className="flex items-center gap-2 mb-1.5 px-3 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/30">
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
              <div className="flex gap-1">
                {currentTrack && (
                  <button
                    type="button"
                    title="Mention current song"
                    onClick={() => setPendingMention({ id: currentTrack.id, name: currentTrack.name, artists: currentTrack.artists, cover: currentTrack.cover })}
                    className="p-2 rounded-xl glass border border-white/10 text-muted-foreground hover:text-orange-400 hover:border-orange-400 transition flex-shrink-0"
                  >
                    <Music2 className="h-4 w-4" />
                  </button>
                )}
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) submit(e); }}
                  placeholder={pendingMention ? "Add a message…" : "Type a message…"}
                  maxLength={500}
                  className="flex-1 bg-input border border-border rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#aac0e1] focus:shadow-[0_0_0_2px_#aac0e1/20] transition"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={!text.trim() && !pendingMention}
              className="h-10 w-10 flex-shrink-0 rounded-2xl bg-gradient-to-br from-[#aac0e1] to-[#c0005a] text-white flex items-center justify-center shadow-[0_0_12px_#aac0e1/40] hover:scale-110 transition-transform disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </>
      )}
    </div>
  );
}

