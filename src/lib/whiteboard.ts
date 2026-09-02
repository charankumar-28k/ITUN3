import { useCallback, useEffect, useRef, useState } from "react";
import { ref, push, set, onValue, off, serverTimestamp, remove } from "firebase/database";
import { db } from "@/lib/firebase";

export type Point = { x: number; y: number };
export type StrokeTool = "pen" | "eraser" | "rect" | "ellipse" | "line" | "text" | "arrow" | "triangle" | "star";

export type Stroke = {
  id: string;
  uid: string;
  color: string;
  fill?: string;
  opacity?: number;
  width: number;
  tool: StrokeTool;
  points: Point[];
  text?: string;
  fontSize?: number;
  fontStyle?: string;
  fontFamily?: string;
  ts: number;
};

export function useWhiteboard(roomId: string | null, userId: string) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const lastClearTs = useRef<number>(0);

  useEffect(() => {
    if (!roomId) { setStrokes([]); setUndoStack([]); return; }

    const strokesRef = ref(db, `rooms/${roomId}/board/strokes`);
    const clearRef   = ref(db, `rooms/${roomId}/board/clear`);

    onValue(clearRef, (snap) => {
      if (!snap.exists()) return;
      const ts = snap.val()?.ts ?? 0;
      if (typeof ts === "number" && ts > lastClearTs.current) {
        lastClearTs.current = ts;
        setStrokes([]);
        setUndoStack([]);
      }
    });

    onValue(strokesRef, (snap) => {
      const list: Stroke[] = [];
      snap.forEach((child) => {
        const v = child.val();
        list.push({
          id:         child.key!,
          uid:        v.uid        ?? "",
          color:      v.color      ?? "#ffffff",
          fill:       v.fill       ?? "",
          opacity:    v.opacity    ?? 1,
          width:      v.width      ?? 3,
          tool:       v.tool       ?? "pen",
          points:     v.points     ?? [],
          text:       v.text       ?? "",
          fontSize:   v.fontSize   ?? 20,
          fontStyle:  v.fontStyle  ?? "normal",
          fontFamily: v.fontFamily ?? "sans-serif",
          ts:         typeof v.ts === "number" ? v.ts : Date.now(),
        });
      });
      list.sort((a, b) => a.ts - b.ts);
      setStrokes(list);
    });

    return () => { off(strokesRef); off(clearRef); };
  }, [roomId]);

  const pushStroke = useCallback((stroke: Omit<Stroke, "id" | "uid" | "ts">) => {
    if (!roomId) return;
    const newRef = push(ref(db, `rooms/${roomId}/board/strokes`), {
      uid:        userId,
      color:      stroke.color,
      fill:       stroke.fill       ?? "",
      opacity:    stroke.opacity    ?? 1,
      width:      stroke.width,
      tool:       stroke.tool,
      points:     stroke.points,
      text:       stroke.text       ?? "",
      fontSize:   stroke.fontSize   ?? 20,
      fontStyle:  stroke.fontStyle  ?? "normal",
      fontFamily: stroke.fontFamily ?? "sans-serif",
      ts:         serverTimestamp(),
    });
    setUndoStack((prev) => [...prev, newRef.key!]);
  }, [roomId, userId]);

  const undo = useCallback(() => {
    if (!roomId || undoStack.length === 0) return;
    const lastId = undoStack[undoStack.length - 1];
    remove(ref(db, `rooms/${roomId}/board/strokes/${lastId}`));
    setUndoStack((prev) => prev.slice(0, -1));
  }, [roomId, undoStack]);

  const clearBoard = useCallback(() => {
    if (!roomId) return;
    remove(ref(db, `rooms/${roomId}/board/strokes`));
    set(ref(db, `rooms/${roomId}/board/clear`), { ts: Date.now(), by: userId });
    setUndoStack([]);
  }, [roomId, userId]);

  return { strokes, pushStroke, undo, clearBoard, canUndo: undoStack.length > 0 };
}
