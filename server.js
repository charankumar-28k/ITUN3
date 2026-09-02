import express from "express";
import cors from "cors";
import https from "https";
import http from "http";
import { URL } from "url";
import { createDecipheriv } from "crypto";

// ── JioSaavn DES-ECB URL decryption ───────────────────────────────────────
function decryptUrl(enc) {
  try {
    const key = Buffer.from("38346591");
    const buf = Buffer.from(enc, "base64");
    const d   = createDecipheriv("des-ecb", key, Buffer.alloc(0));
    d.setAutoPadding(false);
    const url = Buffer.concat([d.update(buf), d.final()])
      .toString("utf8")
      .replace(/[\x00-\x08]+$/, "");
    return url.replace(/_96\.(mp4|mp3)/, "_320.$1");
  } catch {
    return "";
  }
}

const app  = express();
const PORT = 3001;

app.use(cors({ origin: "*" }));
app.use(express.json());

// ── /api/stream — proxy audio to fix CORS issues ──────────────────────────
app.get("/api/stream", (req, res) => {
  const raw = req.query.url;
  if (!raw) return res.status(400).send("Missing url");
  try {
    const target = new URL(decodeURIComponent(raw));
    const lib    = target.protocol === "https:" ? https : http;
    const pr = lib.request({
      hostname: target.hostname, path: target.pathname + target.search, method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0", Accept: "audio/mpeg,audio/*,*/*",
        ...(req.headers.range ? { Range: req.headers.range } : {}),
      },
    }, (upstream) => {
      if (upstream.statusCode >= 300 && upstream.statusCode < 400 && upstream.headers.location) {
        res.redirect(upstream.headers.location); return;
      }
      res.writeHead(upstream.statusCode || 200, {
        "Access-Control-Allow-Origin": "*",
        "Content-Type":  upstream.headers["content-type"]  || "audio/mpeg",
        "Accept-Ranges": "bytes",
        ...(upstream.headers["content-length"] ? { "Content-Length": upstream.headers["content-length"] } : {}),
        ...(upstream.headers["content-range"]  ? { "Content-Range":  upstream.headers["content-range"]  } : {}),
      });
      upstream.pipe(res);
    });
    pr.on("error", e => { if (!res.headersSent) res.status(502).send(e.message); });
    pr.setTimeout(30000, () => pr.destroy());
    pr.end();
  } catch (e) {
    res.status(400).send("Bad URL: " + e.message);
  }
});

// ── JioSaavn public API (www.jiosaavn.com/api.php) ────────────────────────
const SAAVN_BASE   = "www.jiosaavn.com";
const SAAVN_COMMON = "__call=%s&_format=json&_marker=0&api_version=4&ctx=web6dot0";

function saavnRequest(callName, extraParams) {
  const qs = SAAVN_COMMON.replace("%s", encodeURIComponent(callName)) + "&" + extraParams;
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: SAAVN_BASE,
        path: "/api.php?" + qs,
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      },
      res => {
        let body = "";
        res.on("data", d => (body += d));
        res.on("end", () => {
          try { resolve(JSON.parse(body)); }
          catch { reject(new Error("Bad JSON from JioSaavn")); }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error("Timeout")); });
    req.end();
  });
}

const LANG_MAP = {
  hindi: "hindi", english: "english", tamil: "tamil", telugu: "telugu",
  kannada: "kannada", malayalam: "malayalam", punjabi: "punjabi",
  bengali: "bengali", marathi: "marathi", gujarati: "gujarati",
};

function decodeHtml(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function mapSong(s) {
  const decrypted = s.more_info?.encrypted_media_url ? decryptUrl(s.more_info.encrypted_media_url) : "";
  const url   = decrypted || s.more_info?.vlink || "";
  const cover = (s.image || "").replace("-150x150.", "-500x500.").replace("150x150.", "500x500.");
  const artist = Array.isArray(s.more_info?.artistMap?.primary_artists)
    ? s.more_info.artistMap.primary_artists.map(a => decodeHtml(a.name)).join(", ")
    : decodeHtml((s.subtitle || "Unknown").split(" - ")[0]);
  return {
    id:       s.id,
    name:     decodeHtml(s.title || "Unknown"),
    artist,
    album:    decodeHtml(s.more_info?.album || ""),
    cover,
    url,
    duration: Number(s.more_info?.duration) || 0,
  };
}

// ── /api/trending ─────────────────────────────────────────────────────────
app.get("/api/trending", async (req, res) => {
  const lang = req.query.lang || "hindi";
  const q    = LANG_MAP[lang] ? lang + " hits" : "top hindi hits";
  try {
    const data   = await saavnRequest("search.getResults", `q=${encodeURIComponent(q)}&n=40&p=1`);
    const songs  = data?.results || [];
    const tracks = songs.map(mapSong).filter(t => t.url);
    if (tracks.length) return res.json({ tracks });
    throw new Error("No results");
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ── /api/search ───────────────────────────────────────────────────────────
app.get("/api/search", async (req, res) => {
  const q    = req.query.q || "top hits";
  const lang = req.query.lang || "";
  const query = lang && LANG_MAP[lang] ? `${lang} ${q}` : q;
  try {
    const data   = await saavnRequest("search.getResults", `q=${encodeURIComponent(query)}&n=40&p=1`);
    const songs  = data?.results || [];
    const tracks = songs.map(mapSong).filter(t => t.url);
    res.json({ tracks });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.get("/api/health", (_, res) => res.json({ ok: true }));

const server = app.listen(PORT, () => {
  console.log(`✅ Audio proxy + JioSaavn API at http://localhost:${PORT}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.warn(`⚠️  Port ${PORT} already in use — backend may already be running.`);
    process.exit(0);
  } else {
    throw err;
  }
});
