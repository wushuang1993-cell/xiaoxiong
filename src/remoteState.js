import { supabase } from "./supabaseClient.js";

const STATE_KEY = "home";
const AVATAR_BUCKET = "avatars";

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

export async function uploadImageFile(file, folder = "uploads") {
  if (!supabase) throw new Error("Supabase 未配置，无法上传图片");
  if (!file) throw new Error("未选择图片");

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;

  const extension = file.name?.match(/\.([a-zA-Z0-9]+)$/)?.[1] || file.type?.split("/")[1] || "png";
  const safeFolder = String(folder).replace(/[^a-zA-Z0-9/_-]/g, "-");
  const owner = userData.user?.id || "anonymous";
  const path = `${safeFolder}/${owner}-${Date.now()}-${Math.random().toString(16).slice(2)}.${extension}`;
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type || "image/png",
    upsert: false,
  });

  if (error) throw error;

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("图片上传成功，但没有获取到公开地址");
  return data.publicUrl;
}
