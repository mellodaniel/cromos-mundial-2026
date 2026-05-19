import { supabase } from "./supabase";

export type V2TradeStatus =
  | "pending"
  | "reserved"
  | "accepted"
  | "completed"
  | "cancelled";

export type CreateV2TradeRequestPayload = {
  group_id: string;
  from_profile_id: string;
  to_profile_id: string;
  wanted_sticker_id: string;
  offered_sticker_id?: string | null;
  message?: string | null;
};

export type V2TradeRequest = {
  id: string;
  group_id: string | null;
  from_profile_id: string;
  to_profile_id: string;
  wanted_sticker_id: string;
  offered_sticker_id: string | null;
  status: V2TradeStatus;
  message: string | null;
  created_at: string;
  updated_at: string;
};

export async function createV2TradeRequest(payload: CreateV2TradeRequestPayload) {
  const { data, error } = await supabase
    .from("v2_trade_requests")
    .insert({
      group_id: payload.group_id,
      from_profile_id: payload.from_profile_id,
      to_profile_id: payload.to_profile_id,
      wanted_sticker_id: payload.wanted_sticker_id,
      offered_sticker_id: payload.offered_sticker_id ?? null,
      message: payload.message ?? null,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) {
    console.error("Erro createV2TradeRequest:", error);
    throw error;
  }

  return data as V2TradeRequest;
}

export async function fetchV2TradeRequestsForProfile(profileId: string) {
  const { data, error } = await supabase
    .from("v2_trade_requests")
    .select("*")
    .or(`from_profile_id.eq.${profileId},to_profile_id.eq.${profileId}`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro fetchV2TradeRequestsForProfile:", error);
    throw error;
  }

  return (data ?? []) as V2TradeRequest[];
}

export async function updateV2TradeRequestStatus(
  tradeRequestId: string,
  status: V2TradeStatus
) {
  const { error } = await supabase
    .from("v2_trade_requests")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tradeRequestId);

  if (error) {
    console.error("Erro updateV2TradeRequestStatus:", error);
    throw error;
  }
}