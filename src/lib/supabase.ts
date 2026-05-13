import { createClient } from "@supabase/supabase-js";

export type AlbumOwner = "diego" | "arthur";

export type CloudStickerRow = {
  id?: number;
  family_id: string;
  album_owner: AlbumOwner;
  sticker_id: string;
  quantity: number;
  updated_at?: string;
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase não está configurado. Verifica o ficheiro .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const FAMILY_ID = "mello";

export async function fetchCloudCollection() {
  const { data, error } = await supabase
    .from("album_stickers")
    .select("album_owner, sticker_id, quantity")
    .eq("family_id", FAMILY_ID);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function incrementStickerQuantity(
  albumOwner: AlbumOwner,
  stickerId: string,
  amount: number
) {
  const { error } = await supabase.rpc("increment_sticker_quantity", {
    p_family_id: FAMILY_ID,
    p_album_owner: albumOwner,
    p_sticker_id: stickerId,
    p_amount: amount,
  });

  if (error) {
    throw error;
  }
}

export async function upsertStickerQuantity(
  albumOwner: AlbumOwner,
  stickerId: string,
  quantity: number
) {
  const { error } = await supabase.from("album_stickers").upsert(
    {
      family_id: FAMILY_ID,
      album_owner: albumOwner,
      sticker_id: stickerId,
      quantity,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "family_id,album_owner,sticker_id",
    }
  );

  if (error) {
    throw error;
  }
}

export async function importLocalCollectionToCloud(
  collection: Record<string, { diego?: number; arthur?: number }>
) {
  const rows: CloudStickerRow[] = [];

  Object.entries(collection).forEach(([stickerId, quantities]) => {
    const diegoQty = quantities.diego ?? 0;
    const arthurQty = quantities.arthur ?? 0;

    if (diegoQty > 0) {
      rows.push({
        family_id: FAMILY_ID,
        album_owner: "diego",
        sticker_id: stickerId,
        quantity: diegoQty,
      });
    }

    if (arthurQty > 0) {
      rows.push({
        family_id: FAMILY_ID,
        album_owner: "arthur",
        sticker_id: stickerId,
        quantity: arthurQty,
      });
    }
  });

  if (rows.length === 0) {
    return { inserted: 0 };
  }

  const { error } = await supabase.from("album_stickers").upsert(rows, {
    onConflict: "family_id,album_owner,sticker_id",
  });

  if (error) {
    throw error;
  }

  return { inserted: rows.length };
}