import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STATE_KEY = "home";

function send(res, status, payload) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.status(status).json(payload);
}

function createServerClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    send(res, 200, { ok: true });
    return;
  }

  try {
    const supabase = createServerClient();

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("app_states")
        .select("payload, updated_at")
        .eq("key", STATE_KEY)
        .maybeSingle();

      if (error) throw error;
      send(res, 200, { payload: data?.payload || null, updatedAt: data?.updated_at || null });
      return;
    }

    if (req.method === "POST") {
      const payload = req.body?.payload;
      if (!payload || typeof payload !== "object") {
        send(res, 400, { error: "Missing payload" });
        return;
      }

      const { error } = await supabase.from("app_states").upsert(
        {
          key: STATE_KEY,
          payload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );

      if (error) throw error;
      send(res, 200, { ok: true });
      return;
    }

    send(res, 405, { error: "Method not allowed" });
  } catch (error) {
    send(res, 500, { error: error.message || "Server error" });
  }
}
