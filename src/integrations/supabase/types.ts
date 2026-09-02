export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" }
  public: {
    Tables: {
      profiles: {
        Row:    { id: string; display_name: string; avatar_url: string | null; created_at: string; updated_at: string }
        Insert: { id: string; display_name?: string; avatar_url?: string | null }
        Update: { display_name?: string; avatar_url?: string | null; updated_at?: string }
        Relationships: []
      }
      rooms: {
        Row:    { id: string; code: string; host_id: string; created_at: string }
        Insert: { code: string; host_id: string }
        Update: { code?: string }
        Relationships: []
      }
      room_members: {
        Row:    { room_id: string; user_id: string; joined_at: string }
        Insert: { room_id: string; user_id: string }
        Update: { joined_at?: string }
        Relationships: [
          { foreignKeyName: "room_members_room_id_fkey"; columns: ["room_id"]; referencedRelation: "rooms"; referencedColumns: ["id"] }
        ]
      }
      room_state: {
        Row:    { room_id: string; track_id: string | null; playing: boolean; position_ms: number; updated_at: string; updated_by: string | null }
        Insert: { room_id: string; track_id?: string | null; playing?: boolean; position_ms?: number; updated_by?: string | null }
        Update: { track_id?: string | null; playing?: boolean; position_ms?: number; updated_at?: string; updated_by?: string | null }
        Relationships: [
          { foreignKeyName: "room_state_room_id_fkey"; columns: ["room_id"]; referencedRelation: "rooms"; referencedColumns: ["id"] }
        ]
      }
      room_messages: {
        Row:    { id: string; room_id: string; user_id: string; text: string; created_at: string }
        Insert: { id?: string; room_id: string; user_id: string; text: string }
        Update: never
        Relationships: [
          { foreignKeyName: "room_messages_room_id_fkey"; columns: ["room_id"]; referencedRelation: "rooms"; referencedColumns: ["id"] }
        ]
      }
      whiteboard_strokes: {
        Row:    { id: string; room_id: string; uid: string; color: string; fill: string; opacity: number; width: number; tool: string; points: Json; text: string; font_size: number; font_style: string; font_family: string; ts: number }
        Insert: { id?: string; room_id: string; uid: string; color?: string; fill?: string; opacity?: number; width?: number; tool?: string; points?: Json; text?: string; font_size?: number; font_style?: string; font_family?: string; ts?: number }
        Update: never
        Relationships: [
          { foreignKeyName: "whiteboard_strokes_room_id_fkey"; columns: ["room_id"]; referencedRelation: "rooms"; referencedColumns: ["id"] }
        ]
      }
      friend_requests: {
        Row:    { from_uid: string; to_uid: string; from_name: string; status: string; created_at: string }
        Insert: { from_uid: string; to_uid: string; from_name?: string; status?: string }
        Update: { status?: string }
        Relationships: []
      }
      friends: {
        Row:    { user_a: string; user_b: string; name_a: string; name_b: string; created_at: string }
        Insert: { user_a: string; user_b: string; name_a?: string; name_b?: string }
        Update: never
        Relationships: []
      }
      direct_messages: {
        Row:    { id: string; chat_id: string; from_uid: string; to_uid: string; text: string; read: boolean; song_mention: Json | null; created_at: string }
        Insert: { id?: string; chat_id: string; from_uid: string; to_uid: string; text: string; read?: boolean; song_mention?: Json | null }
        Update: { read?: boolean }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Update"]
