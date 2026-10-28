import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

/*
 * The "Humor engine" pages manage the course's teaching database (the
 * funnystudy-sp Supabase project), which holds the prompt chains, LLM models,
 * terms and so on. That project has its own users, so the admin app talks to
 * it with its secret key, from server code only (never sent to the browser).
 * Who may use it is decided here, by the same admin gate as every other page:
 * every page and action calls requireAdmin() before touching this client.
 */

let client: SupabaseClient | null = null;

// Keys never contain whitespace; strip any that sneaked in when pasting.
const url = () => (process.env.FUNNYSTUDY_SUPABASE_URL ?? "").trim();
const secret = () => (process.env.FUNNYSTUDY_SECRET_KEY ?? "").replace(/\s+/g, "");

export function engineConfigured() {
  return Boolean(url() && secret());
}

export function engineDb(): SupabaseClient {
  if (!engineConfigured()) throw new Error("The humor engine database is not configured.");
  client ??= createSupabaseClient(url(), secret(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/**
 * Error text that is safe to show on a page: the secret key (or anything
 * that looks like one) is never included, even if a library echoes it.
 */
export function safeError(message: string | null | undefined): string | null {
  if (!message) return null;
  let text = message;
  const raw = process.env.FUNNYSTUDY_SECRET_KEY ?? "";
  for (const part of [raw, secret(), ...raw.split(/\s+/)]) {
    if (part.length >= 6) text = text.split(part).join("[hidden]");
  }
  text = text.replace(/sb_secret_[^\s"']*/g, "[hidden]");
  if (/header/i.test(text) && text.includes("[hidden]")) {
    return "Could not connect to the humor engine database: check the FUNNYSTUDY_SECRET_KEY setting.";
  }
  return text;
}

/**
 * Rows in the teaching database record who created/modified them
 * (created_by_user_id -> profiles.id). Use the profile there with the same
 * e-mail as the signed-in admin, or else that database's first superadmin.
 */
export async function engineActorId(email: string | null | undefined): Promise<string | null> {
  const db = engineDb();
  if (email) {
    const { data } = await db.from("profiles").select("id").ilike("email", email).limit(1).maybeSingle();
    if (data?.id) return data.id as string;
  }
  const { data } = await db
    .from("profiles")
    .select("id")
    .eq("is_superadmin", true)
    .order("created_datetime_utc", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}
