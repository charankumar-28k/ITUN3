import { useCallback, useEffect, useRef, useState } from "react";
import {
  ref, set, get, push, update, remove,
  onValue, off, serverTimestamp, query, orderByChild, equalTo,
} from "firebase/database";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

export type RoomState = {
  trackId: string | null;
  trackName: string | null;
  trackArtists: string | null;
  trackCover: string | null;
  trackUrl: string | null;
  playing: boolean;
  positionMs: number;
  updatedAt: number;
  lastUpdatedBy: string | null;
};

export type ChatMsg = {
  id: string;
  user_id: string;
  user_name: string;
  text: string;
  ts: number;
  songMention?: { id: string; name: string; artists: string; cover: string } | null;
};

export type Member = { user_id: string; display_name: string };

export const generateCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

type Opts = { userId: string; displayName: string };

export function useRoom({ userId, displayName }: Opts) {
  const [code, setCode]             = useState<string | null>(null);
  const [roomId, setRoomId]         = useState<string | null>(null);
  const [hostId, setHostId]         = useState<string | null>(null);
  const [state, setState]           = useState<RoomState | null>(null);
  const [messages, setMessages]     = useState<ChatMsg[]>([]);
  const [members, setMembers]       = useState<Member[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const listenersRef = useRef<string[]>([]);
  const isHost = hostId === userId;

  const cleanup = useCallback(() => {
    listenersRef.current.forEach((path) => off(ref(db, path)));
    listenersRef.current = [];
  }, []);

  const attachListeners = useCallback((rid: string) => {
    cleanup();
    const paths = {
      room:    `rooms/${rid}`,
      members: `rooms/${rid}/members`,
      chat:    `rooms/${rid}/chat`,
    };
    listenersRef.current = Object.values(paths);

    onValue(ref(db, paths.room), (snap) => {
      if (!snap.exists()) {
        toast.error("Room was closed.");
        cleanup();
        setCode(null); setRoomId(null); setHostId(null);
        setState(null); setMessages([]); setMembers([]);
        return;
      }
      const d = snap.val();
      setState({
        trackId:       d.songId          ?? null,
        trackName:     d.trackName       ?? null,
        trackArtists:  d.trackArtists    ?? null,
        trackCover:    d.trackCover      ?? null,
        trackUrl:      d.trackUrl        ?? null,
        playing:       d.isPlaying       ?? false,
        positionMs:    d.positionMs      ?? 0,
        updatedAt:     typeof d.updatedAt === "number" ? d.updatedAt : Date.now(),
        lastUpdatedBy: d.lastUpdatedBy   ?? null,
      });
    });

    onValue(ref(db, paths.members), (snap) => {
      const list: Member[] = [];
      snap.forEach((child) => {
        list.push({ user_id: child.key!, display_name: child.val().displayName ?? "Listener" });
      });
      setMembers(list);
    });

    onValue(ref(db, paths.chat), (snap) => {
      const msgs: ChatMsg[] = [];
      snap.forEach((child) => {
        const v = child.val();
        const ts = typeof v.timestamp === "number"
          ? v.timestamp
          : typeof v.ts === "number"
          ? v.ts
          : Date.now();
        msgs.push({
          id:          child.key!,
          user_id:     v.uid         ?? "",
          user_name:   v.user        ?? "Listener",
          text:        v.text        ?? "",
          ts,
          songMention: v.songMention ?? null,
        });
      });
      msgs.sort((a, b) => a.ts - b.ts);
      setMessages(msgs);
    });
  }, [cleanup]);

  const create = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      const code = generateCode();
      const roomRef = push(ref(db, "rooms"));
      const rid = roomRef.key!;
      await set(roomRef, {
        code, host: userId,
        songId: null, isPlaying: false, positionMs: 0,
        trackName: null, trackArtists: null, trackCover: null, trackUrl: null,
        updatedAt: serverTimestamp(), lastUpdatedBy: userId,
      });
      await set(ref(db, `rooms/${rid}/members/${userId}`), {
        displayName, joinedAt: serverTimestamp(),
      });
      setCode(code); setRoomId(rid); setHostId(userId);
      attachListeners(rid);
      toast.success(`Room created! Code: ${code}`);
    } catch (err: any) {
      const msg = err.message ?? "Failed to create room";
      setError(msg); toast.error(msg);
    } finally {
      setConnecting(false);
    }
  }, [userId, displayName, attachListeners]);

  const join = useCallback(async (inputCode: string) => {
    setError(null);
    setConnecting(true);
    try {
      const q = query(ref(db, "rooms"), orderByChild("code"), equalTo(inputCode.trim()));
      const snap = await get(q);
      if (!snap.exists()) {
        const msg = "Room not found.";
        setError(msg); toast.error(msg); return;
      }
      let rid = ""; let roomData: any = null;
      snap.forEach((child) => { rid = child.key!; roomData = child.val(); });
      await set(ref(db, `rooms/${rid}/members/${userId}`), {
        displayName, joinedAt: serverTimestamp(),
      });
      setCode(roomData.code); setRoomId(rid); setHostId(roomData.host);
      attachListeners(rid);
      toast.success("Connected to room!");
    } catch (err: any) {
      const msg = err.message ?? "Failed to join room";
      setError(msg); toast.error(msg);
    } finally {
      setConnecting(false);
    }
  }, [userId, displayName, attachListeners]);

  const leave = useCallback(async () => {
    if (roomId) await remove(ref(db, `rooms/${roomId}/members/${userId}`));
    cleanup();
    setCode(null); setRoomId(null); setHostId(null);
    setState(null); setMessages([]); setMembers([]);
    toast.success("Left the room.");
  }, [roomId, userId, cleanup]);

  const broadcastState = useCallback(
    async (s: {
      trackId: string | null;
      trackName?: string | null;
      trackArtists?: string | null;
      trackCover?: string | null;
      trackUrl?: string | null;
      playing: boolean;
      positionMs: number;
    }) => {
      if (!roomId) return;
      await update(ref(db, `rooms/${roomId}`), {
        songId:        s.trackId,
        isPlaying:     s.playing,
        positionMs:    Math.floor(s.positionMs),
        trackName:     s.trackName    ?? null,
        trackArtists:  s.trackArtists ?? null,
        trackCover:    s.trackCover   ?? null,
        trackUrl:      s.trackUrl     ?? null,
        updatedAt:     serverTimestamp(),
        lastUpdatedBy: userId,
      });
    },
    [roomId, userId],
  );

  const sendMessage = useCallback(
    (text: string, songMention?: { id: string; name: string; artists: string; cover: string } | null) => {
      if (!roomId || !text.trim()) return;
      push(ref(db, `rooms/${roomId}/chat`), {
        uid: userId, user: displayName,
        text: text.trim(),
        timestamp: serverTimestamp(),
        ts: Date.now(),
        songMention: songMention ?? null,
      });
    },
    [roomId, userId, displayName],
  );

  useEffect(() => () => cleanup(), [cleanup]);

  return {
    code, roomId, hostId, isHost,
    state, messages, members,
    connecting, error,
    create, join, leave,
    broadcastState, sendMessage,
  };
}
