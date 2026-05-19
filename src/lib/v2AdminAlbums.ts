import { supabase } from "./supabase";
import type { V2Profile } from "./v2Auth";

export type V2AdminAlbumRow = {
  profile_id: string;
  sticker_id: string;
  quantity: number;
  updated_at: string | null;
};

export async function fetchV2AdminCollectors() {
  const { data, error } = await supabase
    .from("v2_profiles")
    .select("*")
    .eq("is_active", true)
    .order("display_name", { ascending: true });

  if (error) {
    console.error("Erro fetchV2AdminCollectors:", error);
    throw error;
  }

  return (data ?? []) as V2Profile[];
}

export async function fetchV2AdminAlbum(profileId: string) {
  const { data, error } = await supabase
    .from("v2_album_stickers")
    .select("profile_id, sticker_id, quantity, updated_at")
    .eq("profile_id", profileId);

  if (error) {
    console.error("Erro fetchV2AdminAlbum:", error);
    throw error;
  }

  return (data ?? []) as V2AdminAlbumRow[];
}