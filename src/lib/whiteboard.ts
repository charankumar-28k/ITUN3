import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  const [strokes, setStrokes]     = useState<Stroke[]>([]);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!roomId) { setStrokes([]); setUndoStack([]); return; }

    // Load existing strokes
    supabase
      .from("whiteboard_strokes")
      .select("*")
      .eq("room_id", roomId)
      .order("ts", { ascending: true })
      .then(({ data }) => {
        if (data) setStrokes(data.map(rowToStroke));
      });

    const channel = supabase.channel(`whiteboard:${roomId}`)
      .on("broadcast", { event: "stroke" }, ({ payload }) => {
        setStrokes((prev) => {
          if (prev.find((s) => s.id === payload.id)) return prev;
          return [...prev, payload as Stroke].sort((a, b) => a.ts - b.ts);
        });
      })
      .on("broadcast", { event: "undo" }, ({ payload }) => {
        setStrokes((prev) => prev.filter((s) => s.id !== payload.id));
      })
      .on("broadcast", { event: "clear" }, () => {
        setStrokes([]); setUndoStack([]);
      })
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId]);

  const pushStroke = useCallback((stroke: Omit<Stroke, "id" | "uid" | "ts">) => {
    if (!roomId || !channelRef.current) return;
    const full: Stroke = {
      ...stroke, id: crypto.randomUUID(), uid: userId, ts: Date.now(),
    };
    setStrokes((prev) => [...prev, full]);
    setUndoStack((prev) => [...prev, full.id]);
    channelRef.current.send({ type: "broadcast", event: "stroke", payload: full });
    supabase.from("whiteboard_strokes").insert(strokeToRow(full, roomId));
  }, [roomId, userId]);

  const undo = useCallback(() => {
    if (!roomId || undoStack.length === 0 || !channelRef.current) return;
    const lastId = undoStack[undoStack.length - 1];
    setStrokes((prev) => prev.filter((s) => s.id !== lastId));
    setUndoStack((prev) => prev.slice(0, -1));
    channelRef.current.send({ type: "broadcast", event: "undo", payload: { id: lastId } });
    supabase.from("whiteboard_strokes").delete().eq("id", lastId);
  }, [roomId, undoStack]);

  const clearBoard = useCallback(() => {
    if (!roomId || !channelRef.current) return;
    setStrokes([]); setUndoStack([]);
    channelRef.current.send({ type: "broadcast", event: "clear", payload: {} });
    supabase.from("whiteboard_strokes").delete().eq("room_id", roomId);
  }, [roomId]);

  return { strokes, pushStroke, undo, clearBoard, canUndo: undoStack.length > 0 };
}

function rowToStroke(row: any): Stroke {
  return {
    id:         row.id,
    uid:        row.uid,
    color:      row.color      ?? "#ffffff",
    fill:       row.fill       ?? "",
    opacity:    row.opacity    ?? 1,
    width:      row.width      ?? 3,
    tool:       row.tool       ?? "pen",
    points:     row.points     ?? [],
    text:       row.text       ?? "",
    fontSize:   row.font_size  ?? 20,
    fontStyle:  row.font_style ?? "normal",
    fontFamily: row.font_family ?? "sans-serif",
    ts:         row.ts         ?? Date.now(),
  };
}

function strokeToRow(s: Stroke, roomId: string) {
  return {
    id: s.id, room_id: roomId, uid: s.uid,
    color: s.color, fill: s.fill ?? "", opacity: s.opacity ?? 1,
    width: s.width, tool: s.tool, points: s.points,
    text: s.text ?? "", font_size: s.fontSize ?? 20,
    font_style: s.fontStyle ?? "normal", font_family: s.fontFamily ?? "sans-serif",
    ts: s.ts,
  };
}
