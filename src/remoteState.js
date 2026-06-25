import { supabase } from "./supabaseClient.js";

const STATE_KEY = "home";

export const remoteStateConfigured = Boolean(supabase);

export async function loadRemoteState() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("app_states")
    .select("payload")
    .eq("key", STATE_KEY)
    .maybeSingle();

  if (error) throw error;
  return data?.payload || null;
}

export async function saveRemoteState(payload) {
  if (!supabase) return;
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;

  const { error } = await supabase.from("app_states").upsert(
    {
      key: STATE_KEY,
      payload,
      updated_by: userData.user?.id || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) throw error;
}
