// player.js — Music synchronization logic
// Host writes playback state to Firebase; guests read and sync their player.
// Works with any player (HTML5 audio, YouTube iframe, etc.)

import { broadcastState } from "./room-firebase.js";

// How many seconds of drift are allowed before force-seeking (guests)
const SYNC_THRESHOLD_SEC = 1.5;

/**
 * HOST: Call this whenever the host changes song, plays, pauses, or seeks.
 * Writes the new state to Firebase so all guests sync automatically.
 *
 * @param {string} roomId
 * @param {{ songId: string, isPlaying: boolean, positionMs: number }} state
 */
export async function hostUpdateState(roomId, state) {
  await broadcastState(roomId, state);
}

/**
 * GUEST: Call this inside your subscribeRoom onState callback.
 * Compares incoming Firebase state with the local player and syncs if needed.
 *
 * @param {HTMLAudioElement} audioEl  — the <audio> element
 * @param {object} firebaseState      — snapshot from Firebase room node
 * @param {{ songId: string|null }} localState — current local player state
 * @param {(songId: string) => void} onSongChange — called when song changes
 */
export function guestSyncPlayer(audioEl, firebaseState, localState, onSongChange) {
  if (!audioEl || !firebaseState) return;

  const { songId, isPlaying, positionMs, updatedAt } = firebaseState;

  // If song changed, notify the UI to load the new track
  if (songId && songId !== localState.songId) {
    onSongChange(songId);
    return; // position sync will happen after the new track loads
  }

  // Compensate for network latency: estimate how far ahead the host is
  const lagMs = updatedAt ? Date.now() - updatedAt : 0;
  const expectedPositionSec = (positionMs + (isPlaying ? lagMs : 0)) / 1000;
  const currentSec = audioEl.currentTime;

  // Seek if drift exceeds threshold
  if (Math.abs(currentSec - expectedPositionSec) > SYNC_THRESHOLD_SEC) {
    audioEl.currentTime = Math.max(0, expectedPositionSec);
  }

  // Sync play/pause state
  if (isPlaying && audioEl.paused) {
    audioEl.play().catch(() => {});
  } else if (!isPlaying && !audioEl.paused) {
    audioEl.pause();
  }
}

/**
 * HOST: Periodically broadcast position while playing.
 * Call this once when the host enters a room; returns a cleanup function.
 *
 * @param {string} roomId
 * @param {() => { songId: string, isPlaying: boolean, positionMs: number }} getState
 * @param {number} intervalMs — how often to broadcast (default 4000ms)
 * @returns {() => void} stop function
 */
export function startHostBroadcast(roomId, getState, intervalMs = 4000) {
  const id = setInterval(async () => {
    const state = getState();
    if (state.isPlaying) await broadcastState(roomId, state);
  }, intervalMs);
  return () => clearInterval(id);
}
