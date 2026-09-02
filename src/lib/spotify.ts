// spotify.ts — Spotify PKCE auth (no client secret — safe for browser)

const CLIENT_ID   = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string;
const REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI as string;
const SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
].join(" ");

// ── PKCE helpers ──────────────────────────────────────────────────────────────
function generateRandom(len: number) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(plain: string) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(plain));
}

function base64url(buf: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// ── User PKCE Login ───────────────────────────────────────────────────────────
export async function spotifyLogin() {
  const verifier  = generateRandom(64);
  const challenge = base64url(await sha256(verifier));
  localStorage.setItem("spotify_verifier", verifier);

  const params = new URLSearchParams({
    client_id:             CLIENT_ID,
    response_type:         "code",
    redirect_uri:          REDIRECT_URI,
    scope:                 SCOPES,
    code_challenge_method: "S256",
    code_challenge:        challenge,
  });
  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

// ── Exchange code for user token (PKCE — no secret needed) ───────────────────
export async function exchangeCode(code: string) {
  const verifier = localStorage.getItem("spotify_verifier") ?? "";
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     CLIENT_ID,
      grant_type:    "authorization_code",
      code,
      redirect_uri:  REDIRECT_URI,
      code_verifier: verifier,
    }),
  });
  const data = await res.json();
  if (data.access_token) {
    localStorage.setItem("spotify_token",   data.access_token);
    localStorage.setItem("spotify_refresh", data.refresh_token ?? "");
    localStorage.setItem("spotify_expires", String(Date.now() + data.expires_in * 1000));
  }
  return data;
}

// ── Refresh user token ────────────────────────────────────────────────────────
async function refreshUserToken(): Promise<string | null> {
  const refresh = localStorage.getItem("spotify_refresh");
  if (!refresh) return null;
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     CLIENT_ID,
      grant_type:    "refresh_token",
      refresh_token: refresh,
    }),
  });
  const data = await res.json();
  if (data.access_token) {
    localStorage.setItem("spotify_token",   data.access_token);
    localStorage.setItem("spotify_expires", String(Date.now() + data.expires_in * 1000));
    return data.access_token;
  }
  return null;
}

// ── Get user token ────────────────────────────────────────────────────────────
export async function getToken(): Promise<string | null> {
  const token   = localStorage.getItem("spotify_token");
  const expires = Number(localStorage.getItem("spotify_expires") ?? 0);
  if (!token) return null;
  if (Date.now() > expires - 60_000) return refreshUserToken();
  return token;
}

export function clearTokens() {
  ["spotify_token", "spotify_refresh", "spotify_expires", "spotify_verifier"]
    .forEach((k) => localStorage.removeItem(k));
}

// ── API fetch (user token only) ───────────────────────────────────────────────
async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = await getToken();
  if (!token) throw new Error("Not authenticated with Spotify");
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...opts.headers,
    },
  });
  if (res.status === 204) return null;
  return res.json();
}

// ── Player controls (requires Premium) ───────────────────────────────────────
export async function playTrack(uri: string, deviceId?: string) {
  const qs = deviceId ? `?device_id=${deviceId}` : "";
  await apiFetch(`/me/player/play${qs}`, { method: "PUT", body: JSON.stringify({ uris: [uri] }) });
}

export async function pausePlayback()  { await apiFetch("/me/player/pause", { method: "PUT" }); }
export async function resumePlayback() { await apiFetch("/me/player/play",  { method: "PUT" }); }
export async function seekTo(positionMs: number) {
  await apiFetch(`/me/player/seek?position_ms=${Math.floor(positionMs)}`, { method: "PUT" });
}
export async function getPlaybackState() { return apiFetch("/me/player"); }

// ── Types ─────────────────────────────────────────────────────────────────────
export type SpotifyTrack = {
  id: string;
  uri: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
  duration_ms: number;
  preview_url: string | null;
};
