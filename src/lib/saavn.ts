const API = "http://localhost:3001/api";

export type Track = {
  id: string; name: string; artist: string;
  album: string; cover: string; url: string; duration: number;
};
export type SaavnTrack = Track & { artists: string };

export const LANGUAGES = [
  { label: "All",       value: "" },
  { label: "Hindi",     value: "hindi" },
  { label: "English",   value: "english" },
  { label: "Tamil",     value: "tamil" },
  { label: "Telugu",    value: "telugu" },
  { label: "Kannada",   value: "kannada" },
  { label: "Malayalam", value: "malayalam" },
  { label: "Punjabi",   value: "punjabi" },
  { label: "Bengali",   value: "bengali" },
  { label: "Marathi",   value: "marathi" },
  { label: "Gujarati",  value: "gujarati" },
] as const;

export type Language = typeof LANGUAGES[number]["value"];

export async function fetchTrending(lang: Language = ""): Promise<Track[]> {
  const res  = await fetch(`${API}/trending?lang=${lang}`, { signal: AbortSignal.timeout(12000) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data.tracks ?? [];
}

export async function searchTracks(q: string, lang: Language = ""): Promise<Track[]> {
  const res  = await fetch(`${API}/search?q=${encodeURIComponent(q)}&lang=${lang}`, { signal: AbortSignal.timeout(12000) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data.tracks ?? [];
}

const MOOD_SEARCH: Record<string, string> = {
  happy: "happy", sad: "sad", angry: "rock",
  neutral: "chill", surprised: "dance", tired: "relax",
};

export function getMoodQuery(mood: string | null): string {
  return mood ? MOOD_SEARCH[mood] ?? "" : "";
}

export async function saavnSearch(): Promise<SaavnTrack[]> { return []; }
export async function saavnSongById(): Promise<SaavnTrack | null> { return null; }
