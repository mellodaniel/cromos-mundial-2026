import { supabase } from "./supabase";

export type V2Role = "super_admin" | "group_admin" | "collector" | "viewer";

export type V2Profile = {
  id: string;
  auth_user_id: string;
  group_id: string | null;
  username: string;
  display_name: string;
  auth_email: string;
  role: V2Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type V2PublicSignupPayload = {
  username: string;
  display_name: string;
  password: string;
};

const AUTH_DOMAIN = "cromos.local";

function usernameToAuthEmail(username: string) {
  return `${username.trim().toLowerCase()}@${AUTH_DOMAIN}`;
}

export async function v2SignIn(username: string, password: string) {
  const authEmail = usernameToAuthEmail(username);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: authEmail,
    password,
  });

  if (error) {
    console.error("Erro v2SignIn:", error);
    throw new Error("Utilizador ou senha inválidos.");
  }

  return data;
}

export async function v2PublicSignup(payload: V2PublicSignupPayload) {
  const { data, error } = await supabase.functions.invoke("v2-public-signup", {
    body: payload,
  });

  if (error) {
    console.error("Erro v2PublicSignup:", error);
    throw error;
  }

  if (!data?.ok) {
    throw new Error(data?.error ?? "Não foi possível criar a conta.");
  }

  return data.user as V2Profile;
}

export async function v2SignOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Erro v2SignOut:", error);
    throw error;
  }
}

export async function getV2Session() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error("Erro getV2Session:", error);
    throw error;
  }

  return data.session;
}

export async function getV2CurrentProfile() {
  const session = await getV2Session();

  if (!session?.user?.id) {
    return null;
  }

  const { data, error } = await supabase
    .from("v2_profiles")
    .select("*")
    .eq("auth_user_id", session.user.id)
    .maybeSingle();

  if (error) {
    console.error("Erro getV2CurrentProfile:", error);
    throw error;
  }

  if (!data) {
    return null;
  }

  const profile = data as V2Profile;

  if (!profile.is_active) {
    await v2SignOut();
    throw new Error("Este utilizador está inativo.");
  }

  return profile;
}

export function canManageUsers(profile: V2Profile | null) {
  return profile?.role === "super_admin" || profile?.role === "group_admin";
}

export function canManageAllGroups(profile: V2Profile | null) {
  return profile?.role === "super_admin";
}

export function canEditOwnAlbum(profile: V2Profile | null) {
  return (
    profile?.role === "super_admin" ||
    profile?.role === "group_admin" ||
    profile?.role === "collector"
  );
}

export function canViewAdmin(profile: V2Profile | null) {
  return profile?.role === "super_admin" || profile?.role === "group_admin";
}