// useFirebaseRoom.ts
// Drop-in replacement for the Supabase useRoom hook.
// Swap import in Dashboard.tsx:
//   import { useRoom } from "@/lib/room"  →  import { useRoom } from "@/lib/useFirebaseRoom"

import { useCallback, useEffect, useRef, useState } from "react";
import { createRoom, joinRoom, leaveRoom, subscribeRoom } from "./room-firebase.js";
import { sendMessage as fbSendMessage, subscribeChat } from "./chat-firebase.js";
import { hostUpdateState, startHostBroadcast } from "./player-firebase.js";

export type RoomState = {
  trackId: string | null;
  playing: boolean;
  positionMs: number;
  updatedAt: number;
};

export type ChatMsg = {
  id: string;
  user_id: string;
  user_name: string;
  text: string;
  ts: number;
};

export type Member = { user_id: string; display_name: string };

type Opts = { userId: string; displayName: string };

export function useRoom({ userId, displayName }: Opts) {
  const [code, setCode]       = useState<string | null>(null);
  const [roomId, setRoomId]   = useState<string | null>(null);
  const [hostId, setHostId]   = useState<string | null>(null);
  const [state, setState]     = useState<RoomState | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError]     = useState<string | null>(null);

  const unsubRoomRef  = useRef<(() => void) | null>(null);
  const unsubChatRef  = useRef<(() => void) | null>(null);
  const stopBroadcast = useRef<(() => void) | null>(null);

  const isHost = hostId === userId;

  // Clean up all Firebase listeners
  const cleanup = useCallback(() => {
    unsubRoomRef.current?.();
    unsubChatRef.current?.();
    stopBroadcast.current?.();
    unsubRoomRef.current = null;
    unsubChatRef.current = null;
    stopBroadcast.current = null;
  }, []);

  // Wire up Firebase listeners for a given room
  const attachListeners = useCallback((rid: string) => {
    // Room state + members listener
    unsubRoomRef.current = subscribeRoom(
      rid,
      (data: any) => {
        setState({
          trackId: data.songId ?? null,
          playing: data.isPlaying ?? false,
          positionMs: data.positionMs ?? 0,
          updatedAt: data.updatedAt ?? Date.now(),
        });
      },
      (mems: any[]) => {
        setMembers(mems.map((m) => ({ user_id: m.uid, display_name: m.displayName })));
      },
    );

    // Chat listener
    unsubChatRef.current = subscribeChat(rid, (msgs: any[]) => {
      setMessages(
        msgs.map((m) => ({
          id: m.id,
          user_id: m.uid,
          user_name: m.user,
          text: m.text,
          ts: m.timestamp ?? Date.now(),
        })),
      );
    });
  }, []);

  const create = useCallback(async () => {
    setError(null);
    const res = await createRoom({ uid: userId, displayName });
    if ("error" in res) { setError(res.error); return; }
    setCode(res.code);
    setRoomId(res.roomId);
    setHostId(userId);
    attachListeners(res.roomId);
  }, [userId, displayName, attachListeners]);

  const join = useCallback(async (c: string) => {
    setError(null);
    const res = await joinRoom({ uid: userId, displayName }, c);
    if ("error" in res) { setError(res.error); return; }
    setCode(res.code);
    setRoomId(res.roomId);
    setHostId(res.host);
    attachListeners(res.roomId);
  }, [userId, displayName, attachListeners]);

  const leave = useCallback(async () => {
    if (roomId) await leaveRoom(roomId, userId, isHost);
    cleanup();
    setCode(null); setRoomId(null); setHostId(null);
    setState(null); setMessages([]); setMembers([]);
  }, [roomId, userId, isHost, cleanup]);

  // Host broadcasts state to Firebase
  const broadcastState = useCallback(
    async (s: { trackId: string | null; playing: boolean; positionMs: number }) => {
      if (!roomId || !isHost) return;
      await hostUpdateState(roomId, {
        songId: s.trackId ?? "",
        isPlaying: s.playing,
        positionMs: s.positionMs,
      });
    },
    [roomId, isHost],
  );

  // Host: start periodic position broadcast when playing
  useEffect(() => {
    if (!roomId || !isHost) return;
    // startHostBroadcast is called from Dashboard via broadcastState interval
    // so no extra interval needed here — kept for completeness
  }, [roomId, isHost]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!roomId || !text.trim()) return;
      void fbSendMessage(roomId, { uid: userId, displayName }, text);
    },
    [roomId, userId, displayName],
  );

  // Cleanup on unmount
  useEffect(() => () => cleanup(), [cleanup]);

  return {
    code, roomId, hostId, isHost,
    state, messages, members, error,
    create, join, leave, broadcastState, sendMessage,
  };
}
