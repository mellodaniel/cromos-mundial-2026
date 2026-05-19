import { supabase } from "./supabase";
import type { V2Profile, V2Role } from "./v2Auth";

export type V2UserRow = V2Profile & {
  group_name?: string | null;
  group_slug?: string | null;
};

export type CreateV2UserPayload = {
  username: string;
  display_name: string;
  password: string;
  role: V2Role;
  group_slug?: string;
};

export async function fetchV2Users() {
  const { data, error } = await supabase
    .from("v2_profiles")
    .select(
      `
      *,
      v2_groups (
        name,
        slug
      )
    `
    )
    .order("display_name", { ascending: true });

  if (error) {
    console.error("Erro fetchV2Users:", error);
    throw error;
  }

  return (data ?? []).map((item: any) => ({
    ...item,
    group_name: item.v2_groups?.name ?? null,
    group_slug: item.v2_groups?.slug ?? null,
  })) as V2UserRow[];
}

export async function updateV2UserRole(profileId: string, role: V2Role) {
  const { error } = await supabase
    .from("v2_profiles")
    .update({
      role,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId);

  if (error) {
    console.error("Erro updateV2UserRole:", error);
    throw error;
  }
}

export async function updateV2UserActiveStatus(profileId: string, isActive: boolean) {
  const { error } = await supabase
    .from("v2_profiles")
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId);

  if (error) {
    console.error("Erro updateV2UserActiveStatus:", error);
    throw error;
  }
}

export async function createV2User(payload: CreateV2UserPayload) {
  const { data, error } = await supabase.functions.invoke("v2-admin-users", {
    body: payload,
  });

  if (error) {
    console.error("Erro createV2User:", error);
    throw error;
  }

  if (!data?.ok) {
    throw new Error(data?.error ?? "Não foi possível criar o utilizador.");
  }

  return data.user as V2Profile;
}