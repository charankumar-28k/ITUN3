import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type FriendRequest = {
  id: string;
  fromName: string;
  ts: number;
  status: "pending" | "accepted" | "rejected";
};

export type Friend = {
  uid: string;
  displayName: string;
  since: number;
  lastMessage?: string;
  lastMessageTs?: number;
};

export type DM = {
  id: string;
  from: string;
  text: string;
  ts: number;
  read: boolean;
  songMention?: { id: string; name: string; artists: string; cover: string } | null;
};

export function chatId(a: string, b: string) {
  return [a, b].sort().join("_");
}

export function useFriends(userId: string, displayName: string) {
  const [requests, setRequests]         = useState<FriendRequest[]>([]);
  const [friends, setFriends]           = useState<Friend[]>([]);
  const [activeFriend, setActiveFriend] = useState<Friend | null>(null);
  const [dms, setDms]                   = useState<DM[]>([]);
  const [dmLoading, setDmLoading]       = useState(false);
  const [searchUid, setSearchUid]       = useState("");
  const [searchResult, setSearchResult] = useState<{ uid: string; name: string } | null>(null);
  const [searching, setSearching]       = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const dmChannelRef    = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const activeFriendRef = useRef<Friend | null>(null);
  useEffect(() => { activeFriendRef.current = activeFriend; }, [activeFriend]);

  // Load friend requests
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("friend_requests")
      .select("*")
      .eq("to_uid", userId)
      .eq("status", "pending")
      .then(({ data }) => {
        setRequests((data ?? []).map((r) => ({
          id: r.from_uid, fromName: r.from_name, ts: new Date(r.created_at).getTime(), status: "pending",
        })));
      });

    const channel = supabase.channel(`requests:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "friend_requests", filter: `to_uid=eq.${userId}` },
        (payload) => {
          const r = payload.new as any;
          if (r.status === "pending") {
            setRequests((prev) => [...prev, { id: r.from_uid, fromName: r.from_name, ts: Date.now(), status: "pending" }]);
          }
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // Load friends list
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("friends")
      .select("*")
      .or(`user_a=eq.${userId},user_b=eq.${userId}`)
      .then(({ data }) => {
        const list: Friend[] = (data ?? []).map((f) => {
          const friendUid = f.user_a === userId ? f.user_b : f.user_a;
          return {
            uid: friendUid,
            displayName: f.user_a === userId ? (f.name_b ?? "Listener") : (f.name_a ?? "Listener"),
            since: new Date(f.created_at).getTime(),
          };
        });
        setFriends(list);
      });
  }, [userId]);

  const openDm = useCallback(async (friend: Friend) => {
    if (dmChannelRef.current) supabase.removeChannel(dmChannelRef.current);
    setActiveFriend(friend);
    setDms([]);
    setDmLoading(true);

    const cid = chatId(userId, friend.uid);
    const { data } = await supabase
      .from("direct_messages")
      .select("*")
      .eq("chat_id", cid)
      .order("created_at", { ascending: true });

    setDms((data ?? []).map((m) => ({
      id: m.id, from: m.from_uid, text: m.text,
      ts: new Date(m.created_at).getTime(), read: m.read ?? false,
      songMention: m.song_mention ?? null,
    })));
    setDmLoading(false);

    const channel = supabase.channel(`dm:${cid}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages", filter: `chat_id=eq.${cid}` },
        (payload) => {
          const m = payload.new as any;
          setDms((prev) => {
            if (prev.find((d) => d.id === m.id)) return prev;
            return [...prev, { id: m.id, from: m.from_uid, text: m.text, ts: new Date(m.created_at).getTime(), read: m.read ?? false, songMention: m.song_mention ?? null }];
          });
        })
      .subscribe();

    dmChannelRef.current = channel;
  }, [userId]);

  const closeDm = useCallback(() => {
    if (dmChannelRef.current) { supabase.removeChannel(dmChannelRef.current); dmChannelRef.current = null; }
    setActiveFriend(null);
    setDms([]);
  }, []);

  const sendDm = useCallback(async (
    text: string,
    songMention?: { id: string; name: string; artists: string; cover: string } | null,
  ) => {
    const friend = activeFriendRef.current;
    if (!friend || !text.trim()) return;
    const cid = chatId(userId, friend.uid);
    await supabase.from("direct_messages").insert({
      chat_id: cid, from_uid: userId, to_uid: friend.uid,
      text: text.trim(), read: false, song_mention: songMention ?? null,
    });
  }, [userId]);

  const markRead = useCallback(async (friendUid: string) => {
    const cid = chatId(userId, friendUid);
    await supabase.from("direct_messages").update({ read: true })
      .eq("chat_id", cid).eq("to_uid", userId).eq("read", false);
    setUnreadCounts((prev) => ({ ...prev, [friendUid]: 0 }));
  }, [userId]);

  const acceptRequest = useCallback(async (req: FriendRequest) => {
    await supabase.from("friend_requests").update({ status: "accepted" })
      .eq("from_uid", req.id).eq("to_uid", userId);

    const myName = displayName;
    await supabase.from("friends").insert({
      user_a: req.id, user_b: userId, name_a: req.fromName, name_b: myName,
    });

    setRequests((prev) => prev.filter((r) => r.id !== req.id));
    setFriends((prev) => [...prev, { uid: req.id, displayName: req.fromName, since: Date.now() }]);
    toast.success(`You and ${req.fromName} are now friends!`);
  }, [userId, displayName]);

  const rejectRequest = useCallback(async (req: FriendRequest) => {
    await supabase.from("friend_requests").update({ status: "rejected" })
      .eq("from_uid", req.id).eq("to_uid", userId);
    setRequests((prev) => prev.filter((r) => r.id !== req.id));
    toast.info("Request declined.");
  }, [userId]);

  const searchUser = useCallback(async (uid: string) => {
    const trimmed = uid.trim();
    if (!trimmed || trimmed === userId) { toast.error("That's your own User ID!"); return; }
    setSearching(true); setSearchResult(null);
    const { data } = await supabase.from("profiles").select("id, display_name").eq("id", trimmed).single();
    if (data) setSearchResult({ uid: data.id, name: data.display_name });
    else toast.error("User not found.");
    setSearching(false);
  }, [userId]);

  const sendRequest = useCallback(async (toUid: string) => {
    const { error } = await supabase.from("friend_requests").insert({
      from_uid: userId, to_uid: toUid, from_name: displayName, status: "pending",
    });
    if (error) toast.error(error.message);
    else { toast.success("Friend request sent!"); setSearchResult(null); setSearchUid(""); }
  }, [userId, displayName]);

  useEffect(() => () => { dmChannelRef.current && supabase.removeChannel(dmChannelRef.current); }, []);

  return {
    requests, friends, activeFriend, dms, dmLoading,
    searchUid, setSearchUid, searchResult, searching,
    unreadCounts, openDm, closeDm, sendDm, markRead,
    acceptRequest, rejectRequest, searchUser, sendRequest,
  };
}
