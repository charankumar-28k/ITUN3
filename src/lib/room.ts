import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isHost = hostId === userId;

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  const attachListeners = useCallback((rid: string, initialMembers: Member[]) => {
    cleanup();
    setMembers(initialMembers);

    // Load existing messages
    supabase
      .from("room_messages")
      .select("*")
      .eq("room_id", rid)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setMessages(data.map((m) => ({
          id: m.id, user_id: m.user_id, user_name: m.text.startsWith("[") ? "Listener" : m.user_id,
          text: m.text, ts: new Date(m.created_at).getTime(), songMention: null,
        })));
      });

    const channel = supabase.channel(`room:${rid}`)
      // Room state sync via broadcast
      .on("broadcast", { event: "state" }, ({ payload }) => {
        setState({
          trackId:      payload.trackId      ?? null,
          trackName:    payload.trackName    ?? null,
          trackArtists: payload.trackArtists ?? null,
          trackCover:   payload.trackCover   ?? null,
          trackUrl:     payload.trackUrl     ?? null,
          playing:      payload.playing      ?? false,
          positionMs:   payload.positionMs   ?? 0,
          updatedAt:    payload.updatedAt    ?? Date.now(),
          lastUpdatedBy: payload.lastUpdatedBy ?? null,
        });
      })
      // Chat messages via broadcast
      .on("broadcast", { event: "chat" }, ({ payload }) => {
        setMessages((prev) => {
          if (prev.find((m) => m.id === payload.id)) return prev;
          return [...prev, payload as ChatMsg].sort((a, b) => a.ts - b.ts);
        });
      })
      // Member presence
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ user_id: string; display_name: string }>();
        const list: Member[] = Object.values(state).flat().map((p) => ({
          user_id: p.user_id,
          display_name: p.display_name,
        }));
        setMembers(list);
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        setMembers((prev) => prev.filter((m) =>
          !leftPresences.some((p: any) => p.user_id === m.user_id)
        ));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: userId, display_name: displayName });
        }
      });

    channelRef.current = channel;
  }, [cleanup, userId, displayName]);

  const create = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      const code = generateCode();
      const { data: room, error: err } = await supabase
        .from("rooms")
        .insert({ code, host_id: userId })
        .select()
        .single();
      if (err || !room) throw new Error(err?.message ?? "Failed to create room");

      await supabase.from("room_members").insert({ room_id: room.id, user_id: userId });
      await supabase.from("room_state").insert({
        room_id: room.id, track_id: null, playing: false, position_ms: 0,
      });

      setCode(code); setRoomId(room.id); setHostId(userId);
      attachListeners(room.id, [{ user_id: userId, display_name: displayName }]);
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
      const { data: room, error: err } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", inputCode.trim())
        .single();
      if (err || !room) throw new Error("Room not found.");

      await supabase.from("room_members").upsert({ room_id: room.id, user_id: userId });

      const { data: existingMembers } = await supabase
        .from("room_members")
        .select("user_id")
        .eq("room_id", room.id);

      setCode(room.code); setRoomId(room.id); setHostId(room.host_id);
      attachListeners(room.id, (existingMembers ?? []).map((m) => ({
        user_id: m.user_id, display_name: "Listener",
      })));
      toast.success("Connected to room!");
    } catch (err: any) {
      const msg = err.message ?? "Failed to join room";
      setError(msg); toast.error(msg);
    } finally {
      setConnecting(false);
    }
  }, [userId, attachListeners]);

  const leave = useCallback(async () => {
    if (roomId) {
      await supabase.from("room_members").delete().eq("room_id", roomId).eq("user_id", userId);
      if (isHost) {
        await supabase.from("room_state").delete().eq("room_id", roomId);
        await supabase.from("room_messages").delete().eq("room_id", roomId);
        await supabase.from("room_members").delete().eq("room_id", roomId);
        await supabase.from("rooms").delete().eq("id", roomId);
      }
    }
    cleanup();
    setCode(null); setRoomId(null); setHostId(null);
    setState(null); setMessages([]); setMembers([]);
    toast.success("Left the room.");
  }, [roomId, userId, isHost, cleanup]);

  const broadcastState = useCallback(async (s: {
    trackId: string | null;
    trackName?: string | null;
    trackArtists?: string | null;
    trackCover?: string | null;
    trackUrl?: string | null;
    playing: boolean;
    positionMs: number;
  }) => {
    if (!roomId || !channelRef.current) return;
    const payload = {
      trackId:      s.trackId,
      trackName:    s.trackName    ?? null,
      trackArtists: s.trackArtists ?? null,
      trackCover:   s.trackCover   ?? null,
      trackUrl:     s.trackUrl     ?? null,
      playing:      s.playing,
      positionMs:   Math.floor(s.positionMs),
      updatedAt:    Date.now(),
      lastUpdatedBy: userId,
    };
    setState(payload);
    await channelRef.current.send({ type: "broadcast", event: "state", payload });
    // Also persist to room_state table
    await supabase.from("room_state").update({
      track_id: s.trackId, playing: s.playing,
      position_ms: Math.floor(s.positionMs), updated_by: userId,
    }).eq("room_id", roomId);
  }, [roomId, userId]);

  const sendMessage = useCallback((
    text: string,
    songMention?: { id: string; name: string; artists: string; cover: string } | null,
  ) => {
    if (!roomId || !text.trim() || !channelRef.current) return;
    const msg: ChatMsg = {
      id: crypto.randomUUID(),
      user_id: userId,
      user_name: displayName,
      text: text.trim(),
      ts: Date.now(),
      songMention: songMention ?? null,
    };
    channelRef.current.send({ type: "broadcast", event: "chat", payload: msg });
    setMessages((prev) => [...prev, msg]);
    // Persist to DB
    supabase.from("room_messages").insert({
      id: msg.id, room_id: roomId, user_id: userId, text: text.trim(),
    });
  }, [roomId, userId, displayName]);

  useEffect(() => () => cleanup(), [cleanup]);

  return {
    code, roomId, hostId, isHost,
    state, messages, members,
    connecting, error,
    create, join, leave,
    broadcastState, sendMessage,
  };
}
