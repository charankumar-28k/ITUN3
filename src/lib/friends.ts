import { useCallback, useEffect, useRef, useState } from "react";
import { ref, push, set, get, update, onValue, off, serverTimestamp } from "firebase/database";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { getOrCreateKeyPair, getSharedKey, encryptMessage, decryptMessage } from "@/lib/crypto";

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
  publicKey: string;
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
  greetingImage?: string | null;
  failed?: boolean;
};

export function chatId(a: string, b: string) {
  return [a, b].sort().join("_");
}

export async function registerPublicKey(uid: string) {
  const { publicKeyB64 } = await getOrCreateKeyPair(uid);
  await set(ref(db, `users/${uid}/publicKey`), publicKeyB64);
  return publicKeyB64;
}

export async function sendFriendRequest(fromUid: string, fromName: string, toUid: string): Promise<{ error?: string }> {
  if (fromUid === toUid) return { error: "You can't add yourself." };
  try {
    const [alreadySnap, existSnap] = await Promise.all([
      get(ref(db, `friends/${fromUid}/${toUid}`)),
      get(ref(db, `friendRequests/${toUid}/${fromUid}`)),
    ]);
    if (alreadySnap.exists()) return { error: "Already friends." };
    if (existSnap.exists() && existSnap.val().status === "pending") return { error: "Request already sent." };
    await set(ref(db, `friendRequests/${toUid}/${fromUid}`), {
      fromName, fromUid, ts: serverTimestamp(), status: "pending",
    });
    return {};
  } catch (err: any) {
    return { error: err?.message ?? "Failed to send request" };
  }
}

export async function acceptFriendRequest(myUid: string, myName: string, fromUid: string, fromName: string) {
  const updates: Record<string, any> = {};
  updates[`friendRequests/${myUid}/${fromUid}/status`] = "accepted";
  updates[`friends/${myUid}/${fromUid}`] = { displayName: fromName, since: serverTimestamp() };
  updates[`friends/${fromUid}/${myUid}`] = { displayName: myName, since: serverTimestamp() };
  await update(ref(db), updates);
}

export async function rejectFriendRequest(myUid: string, fromUid: string) {
  await update(ref(db, `friendRequests/${myUid}/${fromUid}`), { status: "rejected" });
}

export function useFriends(userId: string, displayName: string) {
  const [requests, setRequests]     = useState<FriendRequest[]>([]);
  const [friends, setFriends]       = useState<Friend[]>([]);
  const [activeFriend, setActiveFriend] = useState<Friend | null>(null);
  const [dms, setDms]               = useState<DM[]>([]);
  const [dmLoading, setDmLoading]   = useState(false);
  const [searchUid, setSearchUid]   = useState("");
  const [searchResult, setSearchResult] = useState<{ uid: string; name: string } | null>(null);
  const [searching, setSearching]   = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const unsubDmRef      = useRef<(() => void) | null>(null);
  const sharedKeyRef    = useRef<CryptoKey | null>(null);
  const activeFriendRef = useRef<Friend | null>(null);

  useEffect(() => { activeFriendRef.current = activeFriend; }, [activeFriend]);

  useEffect(() => {
    if (userId) registerPublicKey(userId).catch(() => {});
  }, [userId]);

  // Friend requests
  useEffect(() => {
    if (!userId) return;
    const r = ref(db, `friendRequests/${userId}`);
    onValue(r, (snap) => {
      const list: FriendRequest[] = [];
      snap.forEach((child) => {
        const v = child.val();
        if (v.status === "pending")
          list.push({ id: child.key!, fromName: v.fromName, ts: v.ts ?? Date.now(), status: "pending" });
      });
      setRequests(list);
    });
    return () => off(r);
  }, [userId]);

  // Friends list + last message preview + unread counts
  useEffect(() => {
    if (!userId) return;
    const r = ref(db, `friends/${userId}`);
    onValue(r, async (snap) => {
      const list: Friend[] = [];
      const promises: Promise<void>[] = [];
      snap.forEach((child) => {
        const v = child.val();
        const uid = child.key!;
        const cid = chatId(userId, uid);
        promises.push(
          Promise.all([
            get(ref(db, `users/${uid}/publicKey`)),
            get(ref(db, `directChats/${cid}/meta/${userId}`)),
          ]).then(([pkSnap, metaSnap]) => {
            const meta = metaSnap.val() ?? {};
            list.push({
              uid,
              displayName: v.displayName ?? "Listener",
              since: v.since ?? Date.now(),
              publicKey: pkSnap.val() ?? "",
              lastMessage: meta.lastMessage ?? null,
              lastMessageTs: meta.lastMessageTs ?? null,
            });
          }),
        );
      });
      await Promise.all(promises);
      // Sort by lastMessageTs desc
      list.sort((a, b) => (b.lastMessageTs ?? 0) - (a.lastMessageTs ?? 0));
      setFriends(list);

      // Unread counts
      const counts: Record<string, number> = {};
      for (const f of list) {
        const cid = chatId(userId, f.uid);
        const metaSnap = await get(ref(db, `directChats/${cid}/meta/${userId}`));
        counts[f.uid] = metaSnap.val()?.unread ?? 0;
      }
      setUnreadCounts(counts);
    });
    return () => off(r);
  }, [userId]);

  // Open DM
  const openDm = useCallback(async (friend: Friend) => {
    unsubDmRef.current?.();
    sharedKeyRef.current = null;
    setActiveFriend(friend);
    setDms([]);
    setDmLoading(true);

    if (!friend.publicKey) { toast.error("Friend's encryption key not found."); setDmLoading(false); return; }
    const sharedKey = await getSharedKey(userId, friend.publicKey);
    if (!sharedKey) { toast.error("Could not derive encryption key. Try re-logging."); setDmLoading(false); return; }
    sharedKeyRef.current = sharedKey;

    const cid = chatId(userId, friend.uid);
    const msgsRef = ref(db, `directChats/${cid}/messages`);

    const decrypt = async (v: any, key: string): Promise<DM> => {
      let text = ""; let failed = false;
      try { text = await decryptMessage(v.ciphertext, sharedKey); }
      catch { text = "🔒 [encrypted]"; failed = true; }
      return {
        id: key, from: v.from ?? "", text,
        ts: typeof v.ts === "number" ? v.ts : Date.now(),
        read: v.read ?? false,
        songMention: v.songMention ?? null,
        greetingImage: v.greetingImage ?? null,
        failed,
      };
    };

    onValue(msgsRef, async (snap) => {
      const decrypted: DM[] = [];
      const jobs: Promise<void>[] = [];
      snap.forEach((child) => {
        jobs.push(decrypt(child.val(), child.key!).then((dm) => { decrypted.push(dm); }));
      });
      await Promise.all(jobs);
      decrypted.sort((a, b) => a.ts - b.ts);
      setDms(decrypted);
      setDmLoading(false);
    });

    unsubDmRef.current = () => off(msgsRef);
  }, [userId]);

  const closeDm = useCallback(() => {
    unsubDmRef.current?.();
    unsubDmRef.current = null;
    sharedKeyRef.current = null;
    setActiveFriend(null);
    setDms([]);
  }, []);

  // Send DM — store encrypted + update meta for both users
  const sendDm = useCallback(async (
    text: string,
    songMention?: { id: string; name: string; artists: string; cover: string } | null,
  ) => {
    const friend = activeFriendRef.current;
    const sharedKey = sharedKeyRef.current;
    if (!friend || !sharedKey || !text.trim()) return;

    const ciphertext = await encryptMessage(text.trim(), sharedKey);
    const cid = chatId(userId, friend.uid);
    const ts = Date.now();

    await push(ref(db, `directChats/${cid}/messages`), {
      from: userId, ciphertext, ts: serverTimestamp(),
      read: false, songMention: songMention ?? null,
    });

    // Update meta: sender's preview + receiver's unread count
    const preview = songMention ? `🎵 ${songMention.name}` : text.trim().slice(0, 60);
    const updates: Record<string, any> = {};
    updates[`directChats/${cid}/meta/${userId}/lastMessage`]   = preview;
    updates[`directChats/${cid}/meta/${userId}/lastMessageTs`] = ts;
    updates[`directChats/${cid}/meta/${friend.uid}/lastMessage`]   = preview;
    updates[`directChats/${cid}/meta/${friend.uid}/lastMessageTs`] = ts;
    // Increment receiver unread
    const unreadSnap = await get(ref(db, `directChats/${cid}/meta/${friend.uid}/unread`));
    updates[`directChats/${cid}/meta/${friend.uid}/unread`] = (unreadSnap.val() ?? 0) + 1;
    await update(ref(db), updates);
  }, [userId]);

  // Mark messages as read — reset unread count, mark msgs read
  const markRead = useCallback(async (friendUid: string) => {
    const cid = chatId(userId, friendUid);
    await update(ref(db, `directChats/${cid}/meta/${userId}`), { unread: 0 });
    setUnreadCounts((prev) => ({ ...prev, [friendUid]: 0 }));
  }, [userId]);

  const acceptRequest = useCallback(async (req: FriendRequest) => {
    await acceptFriendRequest(userId, displayName, req.id, req.fromName);
    toast.success(`You and ${req.fromName} are now friends!`);
  }, [userId, displayName]);

  const rejectRequest = useCallback(async (req: FriendRequest) => {
    await rejectFriendRequest(userId, req.id);
    toast.info("Request declined.");
  }, [userId]);

  const searchUser = useCallback(async (uid: string) => {
    const trimmed = uid.trim();
    if (!trimmed) return;
    if (trimmed === userId) {
      toast.error("That's your own User ID!");
      return;
    }
    setSearching(true); setSearchResult(null);
    try {
      const snap = await get(ref(db, `users/${trimmed}`));
      if (snap.exists()) {
        const v = snap.val();
        setSearchResult({ uid: trimmed, name: v.display_name ?? v.displayName ?? "Listener" });
      } else {
        toast.error("User not found. Check the ID and try again.");
      }
    } catch (err: any) {
      const msg = (err?.message ?? "").toLowerCase();
      if (msg.includes("permission") || msg.includes("denied")) {
        toast.error("Permission denied — please go to Firebase Console → Realtime Database → Rules and deploy the updated rules.");
      } else {
        toast.error("Search failed: " + (err?.message || "Unknown error"));
      }
    }
    setSearching(false);
  }, [userId]);

  const sendRequest = useCallback(async (toUid: string) => {
    const res = await sendFriendRequest(userId, displayName, toUid);
    if (res.error) toast.error(res.error);
    else { toast.success("Friend request sent!"); setSearchResult(null); setSearchUid(""); }
  }, [userId, displayName]);

  // Send greeting image as DM to a specific friend
  const sendGreeting = useCallback(async (toFriend: Friend, imageDataUrl: string, caption: string) => {
    if (!toFriend.publicKey) { toast.error("Friend's key not found."); return; }
    const sharedKey = await getSharedKey(userId, toFriend.publicKey);
    if (!sharedKey) { toast.error("Could not derive encryption key."); return; }
    const text = caption || "🎨 Sent you a greeting from the board!";
    const ciphertext = await encryptMessage(text, sharedKey);
    const cid = chatId(userId, toFriend.uid);
    const ts = Date.now();
    await push(ref(db, `directChats/${cid}/messages`), {
      from: userId, ciphertext, ts: serverTimestamp(),
      read: false, greetingImage: imageDataUrl, songMention: null,
    });
    const updates: Record<string, any> = {};
    updates[`directChats/${cid}/meta/${userId}/lastMessage`]   = "🎨 Greeting";
    updates[`directChats/${cid}/meta/${userId}/lastMessageTs`] = ts;
    updates[`directChats/${cid}/meta/${toFriend.uid}/lastMessage`]   = "🎨 Greeting";
    updates[`directChats/${cid}/meta/${toFriend.uid}/lastMessageTs`] = ts;
    const unreadSnap = await get(ref(db, `directChats/${cid}/meta/${toFriend.uid}/unread`));
    updates[`directChats/${cid}/meta/${toFriend.uid}/unread`] = (unreadSnap.val() ?? 0) + 1;
    await update(ref(db), updates);
    toast.success(`Greeting sent to ${toFriend.displayName}!`);
  }, [userId]);

  useEffect(() => () => { unsubDmRef.current?.(); }, []);

  return {
    requests, friends, activeFriend, dms, dmLoading,
    searchUid, setSearchUid, searchResult, searching,
    unreadCounts, openDm, closeDm, sendDm, markRead, sendGreeting,
    acceptRequest, rejectRequest, searchUser, sendRequest,
  };
}
