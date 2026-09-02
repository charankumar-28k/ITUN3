export type Track = {
  id: string;
  title: string;
  artist: string;
  url: string;
  cover: string;
  mood: Emotion;
};

export type Emotion = "happy" | "neutral" | "sad" | "angry" | "surprised" | "tired";

export const EMOTION_META: Record<Emotion, { emoji: string; label: string; color: string; accent: string }> = {
  happy:     { emoji: "😄", label: "Happy",     color: "oklch(0.85 0.18 90)",  accent: "from-amber-300 to-pink-400" },
  neutral:   { emoji: "😐", label: "Neutral",   color: "oklch(0.78 0.05 230)", accent: "from-sky-300 to-indigo-400" },
  sad:       { emoji: "😢", label: "Sad",       color: "oklch(0.7 0.15 250)",  accent: "from-blue-400 to-violet-500" },
  angry:     { emoji: "😠", label: "Angry",     color: "oklch(0.65 0.25 25)",  accent: "from-rose-500 to-orange-500" },
  surprised: { emoji: "😲", label: "Surprised", color: "oklch(0.8 0.2 320)",   accent: "from-fuchsia-400 to-cyan-300" },
  tired:     { emoji: "😴", label: "Tired",     color: "oklch(0.6 0.08 270)",  accent: "from-slate-400 to-indigo-400" },
};

// Using archive.org hosted free MP3s — no CORS issues, direct play
export const TRACKS: Track[] = [
  {
    id: "h1", mood: "happy",
    title: "Happy Rock", artist: "Bensound",
    url: "https://www.bensound.com/bensound-music/bensound-happyrock.mp3",
    cover: "https://picsum.photos/seed/happy1/400/400",
  },
  {
    id: "h2", mood: "happy",
    title: "Ukulele", artist: "Bensound",
    url: "https://www.bensound.com/bensound-music/bensound-ukulele.mp3",
    cover: "https://picsum.photos/seed/happy2/400/400",
  },
  {
    id: "n1", mood: "neutral",
    title: "Acoustic Breeze", artist: "Bensound",
    url: "https://www.bensound.com/bensound-music/bensound-acousticbreeze.mp3",
    cover: "https://picsum.photos/seed/neutral1/400/400",
  },
  {
    id: "n2", mood: "neutral",
    title: "Creative Minds", artist: "Bensound",
    url: "https://www.bensound.com/bensound-music/bensound-creativeminds.mp3",
    cover: "https://picsum.photos/seed/neutral2/400/400",
  },
  {
    id: "s1", mood: "sad",
    title: "Sad Day", artist: "Bensound",
    url: "https://www.bensound.com/bensound-music/bensound-sadday.mp3",
    cover: "https://picsum.photos/seed/sad1/400/400",
  },
  {
    id: "s2", mood: "sad",
    title: "Memories", artist: "Bensound",
    url: "https://www.bensound.com/bensound-music/bensound-memories.mp3",
    cover: "https://picsum.photos/seed/sad2/400/400",
  },
  {
    id: "a1", mood: "angry",
    title: "Epic", artist: "Bensound",
    url: "https://www.bensound.com/bensound-music/bensound-epic.mp3",
    cover: "https://picsum.photos/seed/angry1/400/400",
  },
  {
    id: "a2", mood: "angry",
    title: "Action Strikes", artist: "Bensound",
    url: "https://www.bensound.com/bensound-music/bensound-actionstrikes.mp3",
    cover: "https://picsum.photos/seed/angry2/400/400",
  },
  {
    id: "u1", mood: "surprised",
    title: "Energy", artist: "Bensound",
    url: "https://www.bensound.com/bensound-music/bensound-energy.mp3",
    cover: "https://picsum.photos/seed/wow1/400/400",
  },
  {
    id: "u2", mood: "surprised",
    title: "Dance", artist: "Bensound",
    url: "https://www.bensound.com/bensound-music/bensound-dance.mp3",
    cover: "https://picsum.photos/seed/wow2/400/400",
  },
  {
    id: "t1", mood: "tired",
    title: "Relaxing", artist: "Bensound",
    url: "https://www.bensound.com/bensound-music/bensound-relaxing.mp3",
    cover: "https://picsum.photos/seed/tired1/400/400",
  },
  {
    id: "t2", mood: "tired",
    title: "Dreams", artist: "Bensound",
    url: "https://www.bensound.com/bensound-music/bensound-dreams.mp3",
    cover: "https://picsum.photos/seed/tired2/400/400",
  },
];

export const playlistFor = (mood: Emotion) => TRACKS.filter((t) => t.mood === mood);
