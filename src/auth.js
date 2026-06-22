import { supabase } from "./supabaseClient.js";

export const authConfigured = Boolean(supabase);

function authSnapshot(session = null, extra = {}) {
  return {
    configured: authConfigured,
    session,
    user: session?.user || null,
    email: session?.user?.email || "",
    message: "",
    ...extra,
  };
}

export async function getAuthSnapshot() {
  if (!supabase) return authSnapshot(null);
  const { data, error } = await supabase.auth.getSession();
  if (error) return authSnapshot(null, { message: error.message });
  return authSnapshot(data.session);
}

export async function watchAuth(onChange) {
  if (!supabase) {
    onChange(authSnapshot(null));
    return () => {};
  }

  onChange(await getAuthSnapshot());
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    onChange(authSnapshot(session));
  });

  return () => data.subscription.unsubscribe();
}

export async function sendLoginLink(email) {
  if (!supabase) throw new Error("Supabase 还没有配置");
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) throw error;
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
