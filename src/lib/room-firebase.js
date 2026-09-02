// room.js — Room creation, joining, member tracking and real-time state sync
// Database schema:
//   /rooms/{roomId}          → { code, host, isPlaying, songId, positionMs, updatedAt }
//   /rooms/{roomId}/members  → { [uid]: { displayName, joinedAt } }
//   /rooms/{roomId}/chat     → { [msgId]: { user, text, timestamp } }

import {
  ref,
  set,
  get,
  push,
  update,
  remove,
  onValue,
  off,
  serverTimestamp,
  query,
  orderByChild,
  equalTo,
} from "firebase/database";
import { db } from "./firebase.js";

/** Generate a random 6-character alphanumeric room code */
export function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * Create a new room. The calling user becomes the host.
 * @param {{ uid: string, displayName: string }} user
 * @returns {{ roomId: string, code: string } | { error: string }}
 */
export async function createRoom(user) {
  try {
    const code = generateCode();
    const roomRef = push(ref(db, "rooms"));
    const roomId = roomRef.key;

    await set(roomRef, {
      code,
      host: user.uid,
      isPlaying: false,
      songId: null,
      positionMs: 0,
      updatedAt: serverTimestamp(),
    });

    // Add host as first member
    await set(ref(db, `rooms/${roomId}/members/${user.uid}`), {
      displayName: user.displayName,
      joinedAt: serverTimestamp(),
    });

    return { roomId, code };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Find a room by its 6-character code and join it.
 * @param {{ uid: string, displayName: string }} user
 * @param {string} code
 * @returns {{ roomId: string, code: string, host: string } | { error: string }}
 */
export async function joinRoom(user, code) {
  try {
    // Query rooms where code matches
    const roomsRef = query(ref(db, "rooms"), orderByChild("code"), equalTo(code.toUpperCase()));
    const snap = await get(roomsRef);

    if (!snap.exists()) return { error: "Room not found. Check the code and try again." };

    let roomId = null;
    let roomData = null;
    snap.forEach((child) => {
      roomId = child.key;
      roomData = child.val();
    });

    // Add user as member
    await set(ref(db, `rooms/${roomId}/members/${user.uid}`), {
      displayName: user.displayName,
      joinedAt: serverTimestamp(),
    });

    return { roomId, code: roomData.code, host: roomData.host };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Leave a room. If the user is the host, the room is deleted.
 * @param {string} roomId
 * @param {string} uid
 * @param {boolean} isHost
 */
export async function leaveRoom(roomId, uid, isHost) {
  if (isHost) {
    // Host leaving destroys the room for everyone
    await remove(ref(db, `rooms/${roomId}`));
  } else {
    await remove(ref(db, `rooms/${roomId}/members/${uid}`));
  }
}

/**
 * Host broadcasts playback state to all room members.
 * @param {string} roomId
 * @param {{ songId: string, isPlaying: boolean, positionMs: number }} state
 */
export async function broadcastState(roomId, state) {
  await update(ref(db, `rooms/${roomId}`), {
    songId: state.songId,
    isPlaying: state.isPlaying,
    positionMs: Math.floor(state.positionMs),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Subscribe to real-time room state changes.
 * Calls onState(data) whenever the host updates playback.
 * @param {string} roomId
 * @param {(state: object) => void} onState
 * @param {(members: object) => void} onMembers
 * @returns {() => void} unsubscribe function
 */
export function subscribeRoom(roomId, onState, onMembers) {
  const stateRef = ref(db, `rooms/${roomId}`);
  const membersRef = ref(db, `rooms/${roomId}/members`);

  // Listen for playback state changes
  onValue(stateRef, (snap) => {
    if (snap.exists()) onState(snap.val());
  });

  // Listen for member join/leave
  onValue(membersRef, (snap) => {
    const members = [];
    snap.forEach((child) => {
      members.push({ uid: child.key, ...child.val() });
    });
    onMembers(members);
  });

  // Return cleanup function
  return () => {
    off(stateRef);
    off(membersRef);
  };
}
