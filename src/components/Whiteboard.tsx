import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pen, Eraser, Trash2, Download, Minus, Plus,
  Square, Circle, Minus as LineIcon, Users, Undo2,
  Type, Gift, ArrowRight, Triangle, Star,
  Bold, Italic, AlignLeft, AlignCenter, AlignRight,
  Grid, ZoomIn, ZoomOut, Image as ImageIcon, Smile,
  Pipette, RotateCcw, Copy, Layers,
} from "lucide-react";
import { useWhiteboard, type Point, type Stroke, type StrokeTool } from "@/lib/whiteboard";
import { toast } from "sonner";

// ── Constants ──────────────────────────────────────────────────────────────────

const COLORS = [
  "#ffffff","#f87171","#fb923c","#facc15",
  "#4ade80","#38bdf8","#a78bfa","#f472b6",
  "#000000","#1e293b","#0ea5e9","#10b981",
];

const FONTS = ["sans-serif","serif","monospace","cursive","Georgia","Arial Black"];

const STICKERS = [
  "🎂","🎉","❤️","🌟","🙏","🌈","🔥","💯",
  "🎵","🎨","✨","🚀","😄","😎","🥳","💪",
  "🌸","🦋","🎸","🏆","💎","🌙","⭐","🎯",
];

const BG_COLORS = [
  "#0d0d1a","#1a0a2e","#0a1a0a","#2a0a0a",
  "#0a1a2a","#1a1a0a","#1a0a1a","#ffffff",
  "#f8fafc","#0f172a","#18181b","#1c1917",
];

const GREETING_TEMPLATES = [
  { label: "🎂 Birthday",  bg: "#1a0a2e", lines: ["🎂 Happy Birthday! 🎉","Wishing you all the best!"] },
  { label: "🎉 Congrats",  bg: "#0a1a0a", lines: ["🎉 Congratulations!","You did it! 🌟"] },
  { label: "❤️ Love",      bg: "#2a0a0a", lines: ["❤️ Thinking of you","Always here for you 💕"] },
  { label: "🌟 Good Luck", bg: "#0a1a2a", lines: ["🌟 Good Luck!","You've got this! 💪"] },
  { label: "🙏 Thank You", bg: "#1a1a0a", lines: ["🙏 Thank You!","Really appreciate you 😊"] },
  { label: "🌈 Hello",     bg: "#0a0a2a", lines: ["🌈 Hey there!","Just wanted to say hi! 👋"] },
  { label: "🎵 Music",     bg: "#0a1a1a", lines: ["🎵 Music is life","Keep the rhythm going 🎶"] },
  { label: "🚀 Launch",    bg: "#0a0a1a", lines: ["🚀 Let's go!","The sky is not the limit ✨"] },
];

// ── Draw helpers ───────────────────────────────────────────────────────────────

function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const len = 14;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - len * Math.cos(angle - 0.4), y2 - len * Math.sin(angle - 0.4));
  ctx.lineTo(x2 - len * Math.cos(angle + 0.4), y2 - len * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fill();
}

function drawTriangle(ctx: CanvasRenderingContext2D, p0: Point, p1: Point, fill: string) {
  const cx = (p0.x + p1.x) / 2;
  ctx.beginPath();
  ctx.moveTo(cx, p0.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.lineTo(p0.x, p1.y);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.stroke();
}

function drawStar(ctx: CanvasRenderingContext2D, p0: Point, p1: Point, fill: string) {
  const cx = (p0.x + p1.x) / 2, cy = (p0.y + p1.y) / 2;
  const r = Math.min(Math.abs(p1.x - p0.x), Math.abs(p1.y - p0.y)) / 2;
  const spikes = 5, inner = r * 0.4;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const rad = (i * Math.PI) / spikes - Math.PI / 2;
    const dist = i % 2 === 0 ? r : inner;
    i === 0 ? ctx.moveTo(cx + dist * Math.cos(rad), cy + dist * Math.sin(rad))
            : ctx.lineTo(cx + dist * Math.cos(rad), cy + dist * Math.sin(rad));
  }
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.stroke();
}

export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  if (!s.points.length) return;
  ctx.save();
  ctx.globalAlpha = s.opacity ?? 1;

  if (s.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
    ctx.lineWidth = s.width * 3;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    for (let i = 1; i < s.points.length; i++) {
      const p = s.points[i - 1], c = s.points[i];
      ctx.quadraticCurveTo(p.x, p.y, (p.x + c.x) / 2, (p.y + c.y) / 2);
    }
    ctx.stroke();
  } else if (s.tool === "pen") {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    for (let i = 1; i < s.points.length; i++) {
      const p = s.points[i - 1], c = s.points[i];
      ctx.quadraticCurveTo(p.x, p.y, (p.x + c.x) / 2, (p.y + c.y) / 2);
    }
    ctx.lineTo(s.points[s.points.length - 1].x, s.points[s.points.length - 1].y);
    ctx.stroke();
  } else if (s.tool === "text" && s.text && s.points[0]) {
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = s.color;
    const style = s.fontStyle ?? "normal";
    const family = s.fontFamily ?? "sans-serif";
    ctx.font = `${style} ${s.fontSize ?? 20}px ${family}`;
    ctx.fillText(s.text, s.points[0].x, s.points[0].y);
  } else if (s.points.length >= 2) {
    const p0 = s.points[0], p1 = s.points[s.points.length - 1];
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.lineCap = "round";
    ctx.fillStyle = s.fill || "transparent";
    if (s.tool === "rect") {
      ctx.beginPath();
      ctx.rect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);
      if (s.fill) ctx.fill();
      ctx.stroke();
    } else if (s.tool === "ellipse") {
      const rx = Math.abs(p1.x - p0.x) / 2, ry = Math.abs(p1.y - p0.y) / 2;
      ctx.beginPath();
      ctx.ellipse(p0.x + (p1.x - p0.x) / 2, p0.y + (p1.y - p0.y) / 2, rx, ry, 0, 0, Math.PI * 2);
      if (s.fill) ctx.fill();
      ctx.stroke();
    } else if (s.tool === "line") {
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    } else if (s.tool === "arrow") {
      ctx.fillStyle = s.color;
      drawArrow(ctx, p0.x, p0.y, p1.x, p1.y);
    } else if (s.tool === "triangle") {
      drawTriangle(ctx, p0, p1, s.fill || "");
    } else if (s.tool === "star") {
      drawStar(ctx, p0, p1, s.fill || "");
    }
  }
  ctx.restore();
}

// ── Types ──────────────────────────────────────────────────────────────────────

type Props = {
  roomId: string | null;
  userId: string;
  displayName: string;
  memberCount: number;
};

// ── Component ──────────────────────────────────────────────────────────────────

export function Whiteboard({ roomId, userId, displayName, memberCount }: Props) {
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const overlayRef    = useRef<HTMLCanvasElement>(null);
  const bgCanvasRef   = useRef<HTMLCanvasElement>(null);
  const mainCtxRef    = useRef<CanvasRenderingContext2D | null>(null);
  const overlayCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawing       = useRef(false);
  const pts           = useRef<Point[]>([]);
  const startPt       = useRef<Point>({ x: 0, y: 0 });
  const rafRef        = useRef<number>(0);

  // Tool state
  const [tool, setTool]           = useState<StrokeTool>("pen");
  const [color, setColor]         = useState("#ffffff");
  const [fillColor, setFillColor] = useState("");
  const [opacity, setOpacity]     = useState(1);
  const [width, setWidth]         = useState(3);
  const [fontSize, setFontSize]   = useState(24);
  const [fontStyle, setFontStyle] = useState("normal");
  const [fontFamily, setFontFamily] = useState("sans-serif");
  const [bgColor, setBgColor]     = useState("#0d0d1a");
  const [showGrid, setShowGrid]   = useState(false);
  const [zoom, setZoom]           = useState(1);

  // Text
  const [textInput, setTextInput] = useState("");
  const [textPos, setTextPos]     = useState<Point | null>(null);

  // Panels
  const [panel, setPanel] = useState<"none"|"greeting"|"sticker"|"bg"|"font">("none");

  const { strokes, pushStroke, undo, clearBoard, canUndo } = useWhiteboard(roomId, userId);

  // ── Redraw ────────────────────────────────────────────────────────────────
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!mainCtxRef.current) mainCtxRef.current = canvas.getContext("2d");
    const ctx = mainCtxRef.current;
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of strokes) drawStroke(ctx, s);
  }, [strokes]);

  useEffect(() => { redraw(); }, [redraw]);

  // ── Background canvas ─────────────────────────────────────────────────────
  useEffect(() => {
    const bg = bgCanvasRef.current;
    if (!bg) return;
    const ctx = bg.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, bg.width, bg.height);
    if (showGrid) {
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      for (let x = 0; x < bg.width; x += 30) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, bg.height); ctx.stroke();
      }
      for (let y = 0; y < bg.height; y += 30) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(bg.width, y); ctx.stroke();
      }
    }
  }, [bgColor, showGrid, strokes]);

  // ── Resize observer ───────────────────────────────────────────────────────
  useEffect(() => {
    const canvas  = canvasRef.current;
    const overlay = overlayRef.current;
    const bg      = bgCanvasRef.current;
    if (!canvas || !overlay || !bg) return;

    const applySize = (w: number, h: number) => {
      canvas.width = overlay.width = bg.width  = w;
      canvas.height = overlay.height = bg.height = h;
      mainCtxRef.current    = canvas.getContext("2d");
      overlayCtxRef.current = overlay.getContext("2d");
      redraw();
    };

    const ro = new ResizeObserver((entries) => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const e = entries[0];
        if (!e) return;
        applySize(Math.floor(e.contentRect.width), Math.floor(e.contentRect.height));
      });
    });

    ro.observe(canvas.parentElement!);
    rafRef.current = requestAnimationFrame(() => {
      const p = canvas.parentElement;
      if (p) applySize(p.offsetWidth, p.offsetHeight);
    });
    return () => { ro.disconnect(); cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Pointer helpers ───────────────────────────────────────────────────────
  const getPos = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = overlayRef.current!;
    const rect = canvas.getBoundingClientRect();
    const src = "touches" in e ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * (canvas.width / rect.width) / zoom,
      y: (src.clientY - rect.top)  * (canvas.height / rect.height) / zoom,
    };
  };

  const onDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!roomId) return;
    e.preventDefault();
    const pt = getPos(e);
    if (tool === "text") { setTextPos(pt); setTextInput(""); return; }
    drawing.current = true;
    startPt.current = pt;
    pts.current = [pt];
  };

  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current || tool === "text") return;
    e.preventDefault();
    const pt = getPos(e);
    const overlay = overlayRef.current;
    if (!overlay) return;
    if (!overlayCtxRef.current) overlayCtxRef.current = overlay.getContext("2d");
    const ctx = overlayCtxRef.current;
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.save();
    ctx.globalAlpha = opacity;

    if (tool === "pen" || tool === "eraser") {
      pts.current.push(pt);
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = tool === "eraser" ? "rgba(255,80,80,0.5)" : color;
      ctx.lineWidth   = tool === "eraser" ? width * 3 : width;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.setLineDash(tool === "eraser" ? [6, 3] : []);
      ctx.beginPath();
      ctx.moveTo(pts.current[0].x, pts.current[0].y);
      for (let i = 1; i < pts.current.length; i++) {
        const p = pts.current[i - 1];
        ctx.quadraticCurveTo(p.x, p.y, (p.x + pt.x) / 2, (p.y + pt.y) / 2);
      }
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
    } else {
      const p0 = startPt.current;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.setLineDash([6, 3]);
      if (fillColor) { ctx.fillStyle = fillColor; }
      if (tool === "rect") {
        ctx.beginPath(); ctx.rect(p0.x, p0.y, pt.x - p0.x, pt.y - p0.y);
        if (fillColor) ctx.fill(); ctx.stroke();
      } else if (tool === "ellipse") {
        const rx = Math.abs(pt.x - p0.x) / 2, ry = Math.abs(pt.y - p0.y) / 2;
        ctx.beginPath();
        ctx.ellipse(p0.x + (pt.x - p0.x) / 2, p0.y + (pt.y - p0.y) / 2, rx, ry, 0, 0, Math.PI * 2);
        if (fillColor) ctx.fill(); ctx.stroke();
      } else if (tool === "line") {
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(pt.x, pt.y); ctx.stroke();
      } else if (tool === "arrow") {
        ctx.fillStyle = color; ctx.setLineDash([]);
        drawArrow(ctx, p0.x, p0.y, pt.x, pt.y);
      } else if (tool === "triangle") {
        ctx.setLineDash([]); drawTriangle(ctx, p0, pt, fillColor);
      } else if (tool === "star") {
        ctx.setLineDash([]); drawStar(ctx, p0, pt, fillColor);
      }
    }
    ctx.restore();
  };

  const onUp = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    drawing.current = false;
    const overlay = overlayRef.current;
    if (overlay) {
      if (!overlayCtxRef.current) overlayCtxRef.current = overlay.getContext("2d");
      overlayCtxRef.current?.clearRect(0, 0, overlay.width, overlay.height);
    }
    const pt = getPos(e);
    if (tool === "pen" || tool === "eraser") {
      if (pts.current.length < 2) return;
      pushStroke({ tool, color, fill: fillColor, opacity, width, points: pts.current, fontSize, fontStyle, fontFamily });
    } else {
      pushStroke({ tool, color, fill: fillColor, opacity, width, points: [startPt.current, pt], fontSize, fontStyle, fontFamily });
    }
    pts.current = [];
  };

  const commitText = () => {
    if (!textInput.trim() || !textPos) { setTextPos(null); return; }
    pushStroke({ tool: "text", color, fill: fillColor, opacity, width, points: [textPos], text: textInput.trim(), fontSize, fontStyle, fontFamily });
    setTextPos(null); setTextInput("");
  };

  // ── Greeting ──────────────────────────────────────────────────────────────
  const applyGreeting = (tpl: typeof GREETING_TEMPLATES[0]) => {
    if (!roomId) { toast.error("Join a room first."); return; }
    clearBoard();
    setBgColor(tpl.bg);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const h = canvas.height;
    tpl.lines.forEach((line, i) => {
      pushStroke({ tool: "text", color: "#ffffff", width: 2, opacity: 1, points: [{ x: 40, y: 80 + i * 64 }], text: line, fontSize: 28, fontStyle: "bold", fontFamily: "sans-serif" });
    });
    pushStroke({ tool: "text", color: "rgba(255,255,255,0.4)", width: 1, opacity: 1, points: [{ x: 40, y: h - 30 }], text: `— ${displayName}`, fontSize: 16, fontStyle: "normal", fontFamily: "sans-serif" });
    setPanel("none");
    toast.success("Greeting applied!");
  };

  const addSticker = (emoji: string) => {
    if (!roomId) { toast.error("Join a room first."); return; }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const x = 60 + Math.random() * (canvas.width - 120);
    const y = 60 + Math.random() * (canvas.height - 120);
    pushStroke({ tool: "text", color: "#ffffff", width: 1, opacity: 1, points: [{ x, y }], text: emoji, fontSize: 48, fontStyle: "normal", fontFamily: "sans-serif" });
    setPanel("none");
  };

  // ── Image upload ──────────────────────────────────────────────────────────
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !roomId) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        if (!mainCtxRef.current) mainCtxRef.current = canvas.getContext("2d");
        const ctx = mainCtxRef.current;
        if (!ctx) return;
        const maxW = canvas.width * 0.6, maxH = canvas.height * 0.6;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        const w = img.width * scale, h = img.height * scale;
        const x = (canvas.width - w) / 2, y = (canvas.height - h) / 2;
        ctx.drawImage(img, x, y, w, h);
        toast.success("Image added to board!");
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ── Download ──────────────────────────────────────────────────────────────
  const download = () => {
    const canvas = canvasRef.current;
    const bg = bgCanvasRef.current;
    if (!canvas || !bg) return;
    const tmp = document.createElement("canvas");
    tmp.width = canvas.width; tmp.height = canvas.height;
    const ctx = tmp.getContext("2d")!;
    ctx.drawImage(bg, 0, 0);
    ctx.drawImage(canvas, 0, 0);
    const a = document.createElement("a");
    a.href = tmp.toDataURL("image/png");
    a.download = "moodsync-board.png";
    a.click();
  };

  // ── Tool button helper ────────────────────────────────────────────────────
  const TB = (t: StrokeTool, icon: React.ReactNode, label: string) => (
    <button key={t} onClick={() => setTool(t)} title={label}
      style={{
        padding: "6px", borderRadius: 10, border: "1px solid",
        borderColor: tool === t ? "rgba(56,189,248,0.6)" : "rgba(255,255,255,0.08)",
        background: tool === t ? "rgba(56,189,248,0.15)" : "rgba(255,255,255,0.04)",
        color: tool === t ? "#38bdf8" : "#94a3b8",
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.15s",
      }}>
      {icon}
    </button>
  );

  const PanelBtn = (id: typeof panel, icon: React.ReactNode, label: string) => (
    <button onClick={() => setPanel(p => p === id ? "none" : id)} title={label}
      style={{
        display: "flex", alignItems: "center", gap: 4, padding: "5px 10px",
        borderRadius: 10, border: "1px solid",
        borderColor: panel === id ? "rgba(56,189,248,0.5)" : "rgba(255,255,255,0.08)",
        background: panel === id ? "rgba(56,189,248,0.12)" : "rgba(255,255,255,0.04)",
        color: panel === id ? "#38bdf8" : "#94a3b8",
        cursor: "pointer", fontSize: 11, fontWeight: 600, transition: "all 0.15s",
      }}>
      {icon} {label}
    </button>
  );

  const iconSz = { width: 14, height: 14 };

  return (
    <div className="glass glow-border rounded-2xl p-4 flex flex-col gap-3">

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ height: 8, width: 8, borderRadius: "50%", background: "#4ade80", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.25em", color: "#64748b" }}>Shared Board</span>
          {roomId && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "rgba(56,189,248,0.1)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)" }}>
              <Users style={iconSz} /> {memberCount} live
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {PanelBtn("greeting", <Gift style={iconSz} />, "Greeting")}
          {PanelBtn("sticker",  <Smile style={iconSz} />, "Stickers")}
          {PanelBtn("bg",       <Layers style={iconSz} />, "Background")}
          <button onClick={undo} disabled={!canUndo} title="Undo"
            style={{ padding: 6, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: canUndo ? "#94a3b8" : "#334155", cursor: canUndo ? "pointer" : "not-allowed" }}>
            <Undo2 style={iconSz} />
          </button>
          <button onClick={download} title="Download"
            style={{ padding: 6, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#94a3b8", cursor: "pointer" }}>
            <Download style={iconSz} />
          </button>
          <button onClick={clearBoard} title="Clear"
            style={{ padding: 6, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#94a3b8", cursor: "pointer" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
            onMouseLeave={e => (e.currentTarget.style.color = "#94a3b8")}>
            <Trash2 style={iconSz} />
          </button>
        </div>
      </div>

      {/* ── Panels ── */}
      <AnimatePresence>
        {panel === "greeting" && (
          <motion.div key="greeting" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
            <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 10 }}>Choose a greeting template</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {GREETING_TEMPLATES.map(tpl => (
                  <button key={tpl.label} onClick={() => applyGreeting(tpl)}
                    style={{ padding: "8px 6px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#cbd5e1", fontSize: 11, cursor: "pointer", textAlign: "left" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(56,189,248,0.4)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.08)"; }}>
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {panel === "sticker" && (
          <motion.div key="sticker" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
            <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 10 }}>Tap to add sticker</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {STICKERS.map(s => (
                  <button key={s} onClick={() => addSticker(s)}
                    style={{ fontSize: 22, padding: 4, borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.04)", cursor: "pointer" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(56,189,248,0.1)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {panel === "bg" && (
          <motion.div key="bg" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
            <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 10 }}>Canvas background</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                {BG_COLORS.map(c => (
                  <button key={c} onClick={() => setBgColor(c)}
                    style={{ height: 28, width: 28, borderRadius: 8, background: c, border: bgColor === c ? "2px solid #38bdf8" : "2px solid rgba(255,255,255,0.15)", cursor: "pointer" }} />
                ))}
                <label style={{ height: 28, width: 28, borderRadius: 8, border: "2px dashed rgba(255,255,255,0.2)", cursor: "pointer", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }} title="Custom color">
                  <Pipette style={{ width: 12, height: 12, color: "#64748b" }} />
                  <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} style={{ opacity: 0, position: "absolute", width: 0, height: 0 }} />
                </label>
                <button onClick={() => setShowGrid(g => !g)}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 8, border: "1px solid", borderColor: showGrid ? "rgba(56,189,248,0.5)" : "rgba(255,255,255,0.1)", background: showGrid ? "rgba(56,189,248,0.1)" : "transparent", color: showGrid ? "#38bdf8" : "#64748b", fontSize: 11, cursor: "pointer" }}>
                  <Grid style={{ width: 12, height: 12 }} /> Grid
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toolbar Row 1: Tools ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {TB("pen",      <Pen style={iconSz} />,         "Pen")}
          {TB("eraser",   <Eraser style={iconSz} />,      "Eraser")}
          {TB("line",     <LineIcon style={iconSz} />,    "Line")}
          {TB("arrow",    <ArrowRight style={iconSz} />,  "Arrow")}
          {TB("rect",     <Square style={iconSz} />,      "Rectangle")}
          {TB("ellipse",  <Circle style={iconSz} />,      "Ellipse")}
          {TB("triangle", <Triangle style={iconSz} />,    "Triangle")}
          {TB("star",     <Star style={iconSz} />,        "Star")}
          {TB("text",     <Type style={iconSz} />,        "Text")}
        </div>

        <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.08)" }} />

        {/* Stroke color */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
          {COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)}
              style={{ height: 18, width: 18, borderRadius: "50%", background: c, border: color === c ? "2px solid #fff" : "2px solid transparent", cursor: "pointer", transform: color === c ? "scale(1.2)" : "scale(1)", transition: "all 0.15s" }} />
          ))}
          <label style={{ height: 18, width: 18, borderRadius: "50%", border: "2px dashed rgba(255,255,255,0.3)", cursor: "pointer", overflow: "hidden" }} title="Custom stroke color">
            <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ opacity: 0, width: "100%", height: "100%", cursor: "pointer" }} />
          </label>
        </div>

        <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.08)" }} />

        {/* Stroke width */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button onClick={() => setWidth(w => Math.max(1, w - 1))}
            style={{ padding: 4, borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#94a3b8", cursor: "pointer" }}>
            <Minus style={{ width: 10, height: 10 }} />
          </button>
          <span style={{ fontSize: 11, color: "#64748b", width: 18, textAlign: "center" }}>{width}</span>
          <button onClick={() => setWidth(w => Math.min(40, w + 1))}
            style={{ padding: 4, borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#94a3b8", cursor: "pointer" }}>
            <Plus style={{ width: 10, height: 10 }} />
          </button>
          <div style={{ width: Math.min(width * 2, 20), height: Math.min(width * 2, 20), borderRadius: "50%", background: color, flexShrink: 0 }} />
        </div>
      </div>

      {/* ── Toolbar Row 2: Fill + Opacity + Font + Zoom ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {/* Fill color */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 10, color: "#475569" }}>Fill</span>
          <label style={{ height: 18, width: 18, borderRadius: 4, background: fillColor || "transparent", border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer", overflow: "hidden" }}>
            <input type="color" value={fillColor || "#000000"} onChange={e => setFillColor(e.target.value)} style={{ opacity: 0, width: "100%", height: "100%", cursor: "pointer" }} />
          </label>
          {fillColor && (
            <button onClick={() => setFillColor("")}
              style={{ fontSize: 10, color: "#475569", background: "none", border: "none", cursor: "pointer" }}>✕</button>
          )}
        </div>

        <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.08)" }} />

        {/* Opacity */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 10, color: "#475569" }}>Opacity</span>
          <input type="range" min={0.1} max={1} step={0.05} value={opacity}
            onChange={e => setOpacity(+e.target.value)}
            style={{ width: 60, accentColor: "#38bdf8" }} />
          <span style={{ fontSize: 10, color: "#64748b", width: 28 }}>{Math.round(opacity * 100)}%</span>
        </div>

        <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.08)" }} />

        {/* Font controls (text tool) */}
        {tool === "text" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button onClick={() => setFontSize(f => Math.max(10, f - 4))}
                style={{ padding: 4, borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#94a3b8", cursor: "pointer" }}>
                <Minus style={{ width: 10, height: 10 }} />
              </button>
              <span style={{ fontSize: 11, color: "#64748b", width: 24, textAlign: "center" }}>{fontSize}</span>
              <button onClick={() => setFontSize(f => Math.min(96, f + 4))}
                style={{ padding: 4, borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#94a3b8", cursor: "pointer" }}>
                <Plus style={{ width: 10, height: 10 }} />
              </button>
            </div>
            <button onClick={() => setFontStyle(s => s.includes("bold") ? s.replace("bold","").trim() || "normal" : (s === "normal" ? "bold" : s + " bold"))}
              style={{ padding: "4px 8px", borderRadius: 8, border: "1px solid", borderColor: fontStyle.includes("bold") ? "rgba(56,189,248,0.5)" : "rgba(255,255,255,0.08)", background: fontStyle.includes("bold") ? "rgba(56,189,248,0.12)" : "rgba(255,255,255,0.04)", color: fontStyle.includes("bold") ? "#38bdf8" : "#94a3b8", cursor: "pointer" }}>
              <Bold style={{ width: 12, height: 12 }} />
            </button>
            <button onClick={() => setFontStyle(s => s.includes("italic") ? s.replace("italic","").trim() || "normal" : (s === "normal" ? "italic" : s + " italic"))}
              style={{ padding: "4px 8px", borderRadius: 8, border: "1px solid", borderColor: fontStyle.includes("italic") ? "rgba(56,189,248,0.5)" : "rgba(255,255,255,0.08)", background: fontStyle.includes("italic") ? "rgba(56,189,248,0.12)" : "rgba(255,255,255,0.04)", color: fontStyle.includes("italic") ? "#38bdf8" : "#94a3b8", cursor: "pointer" }}>
              <Italic style={{ width: 12, height: 12 }} />
            </button>
            <select value={fontFamily} onChange={e => setFontFamily(e.target.value)}
              style={{ padding: "3px 6px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(15,23,42,0.8)", color: "#94a3b8", fontSize: 11, cursor: "pointer" }}>
              {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.08)" }} />
          </>
        )}

        {/* Zoom */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
          <button onClick={() => setZoom(z => Math.max(0.5, +(z - 0.1).toFixed(1)))}
            style={{ padding: 4, borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#94a3b8", cursor: "pointer" }}>
            <ZoomOut style={{ width: 12, height: 12 }} />
          </button>
          <span style={{ fontSize: 10, color: "#64748b", width: 32, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(3, +(z + 0.1).toFixed(1)))}
            style={{ padding: 4, borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#94a3b8", cursor: "pointer" }}>
            <ZoomIn style={{ width: 12, height: 12 }} />
          </button>
          <button onClick={() => setZoom(1)}
            style={{ padding: 4, borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#94a3b8", cursor: "pointer" }} title="Reset zoom">
            <RotateCcw style={{ width: 12, height: 12 }} />
          </button>
          {/* Image upload */}
          <label style={{ padding: 4, borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#94a3b8", cursor: "pointer", display: "flex" }} title="Upload image">
            <ImageIcon style={{ width: 12, height: 12 }} />
            <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
          </label>
          {/* Copy board */}
          <button onClick={() => { const c = canvasRef.current; const b = bgCanvasRef.current; if (!c || !b) return; const t = document.createElement("canvas"); t.width = c.width; t.height = c.height; const x = t.getContext("2d")!; x.drawImage(b,0,0); x.drawImage(c,0,0); t.toBlob(blob => { if (blob) navigator.clipboard.write([new ClipboardItem({"image/png": blob})]); }); toast.success("Copied!"); }}
            style={{ padding: 4, borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#94a3b8", cursor: "pointer" }} title="Copy to clipboard">
            <Copy style={{ width: 12, height: 12 }} />
          </button>
        </div>
      </div>

      {/* ── Canvas ── */}
      <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", height: 420 }}>
        {!roomId && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, zIndex: 10, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
            <Pen style={{ width: 32, height: 32, color: "rgba(148,163,184,0.3)" }} />
            <p style={{ fontSize: 13, color: "rgba(148,163,184,0.5)", textAlign: "center", maxWidth: 220 }}>
              Join or create a room to draw together.
            </p>
          </div>
        )}

        {/* zoom wrapper */}
        <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
          <div style={{ width: "100%", height: "100%", transform: `scale(${zoom})`, transformOrigin: "top left" }}>
            <canvas ref={bgCanvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
            <canvas ref={canvasRef}   style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none" }} />
            <canvas ref={overlayRef}  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none", cursor: tool === "eraser" ? "cell" : tool === "text" ? "text" : "crosshair" }}
              onMouseDown={roomId ? onDown : undefined}
              onMouseMove={roomId ? onMove : undefined}
              onMouseUp={roomId ? onUp : undefined}
              onMouseLeave={roomId ? onUp : undefined}
              onTouchStart={roomId ? onDown : undefined}
              onTouchMove={roomId ? onMove : undefined}
              onTouchEnd={roomId ? onUp : undefined}
            />
          </div>
        </div>

        {/* Text input overlay */}
        {textPos && (
          <div style={{ position: "absolute", zIndex: 20, left: textPos.x * zoom, top: textPos.y * zoom - fontSize }}>
            <input autoFocus value={textInput}
              onChange={e => setTextInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") commitText(); if (e.key === "Escape") { setTextPos(null); setTextInput(""); } }}
              onBlur={commitText}
              placeholder="Type here…"
              style={{ background: "transparent", border: "none", borderBottom: "1px dashed rgba(255,255,255,0.5)", color, outline: "none", minWidth: 120, fontSize, fontWeight: fontStyle.includes("bold") ? "bold" : "normal", fontStyle: fontStyle.includes("italic") ? "italic" : "normal", fontFamily }}
            />
          </div>
        )}

        <div style={{ position: "absolute", bottom: 8, right: 12, fontSize: 10, color: "rgba(255,255,255,0.15)", pointerEvents: "none", userSelect: "none" }}>
          {displayName}
        </div>
      </div>
    </div>
  );
}

