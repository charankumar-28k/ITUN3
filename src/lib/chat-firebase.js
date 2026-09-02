// chat.js — Real-time chat using Firebase Realtime Database
// Messages stored at: /rooms/{roomId}/chat/{msgId}
// Each message: { user, text, timestamp }

import { ref, push, onValue, off, serverTimestamp } from "firebase/database";
import { db } from "./firebase.js";

/**
 * Send a chat message to a room.
 * @param {string} roomId
 * @param {{ uid: string, displayName: string }} user
 * @param {string} text
 */
export async function sendMessage(roomId, user, text) {
  if (!text.trim()) return;
  await push(ref(db, `rooms/${roomId}/chat`), {
    user: user.displayName,
    uid: user.uid,
    text: text.trim(),
    timestamp: serverTimestamp(),
  });
}

/**
 * Subscribe to real-time chat messages for a room.
 * Calls onMessages(messages[]) whenever a new message arrives.
 * Messages are sorted by timestamp ascending.
 * @param {string} roomId
 * @param {(messages: Array<{ id, user, uid, text, timestamp }>) => void} onMessages
 * @returns {() => void} unsubscribe function
 */
export function subscribeChat(roomId, onMessages) {
  const chatRef = ref(db, `rooms/${roomId}/chat`);

  onValue(chatRef, (snap) => {
    const messages = [];
    snap.forEach((child) => {
      messages.push({ id: child.key, ...child.val() });
    });
    // Sort by timestamp ascending (oldest first)
    messages.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
    onMessages(messages);
  });

  // Return cleanup function to stop listening
  return () => off(chatRef);
}
