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

export function engineConfigured() {
  return Boolean(process.env.FUNNYSTUDY_SUPABASE_URL && process.env.FUNNYSTUDY_SECRET_KEY);
}

export function engineDb(): SupabaseClient {
  if (!engineConfigured()) throw new Error("The humor engine database is not configured.");
  client ??= createSupabaseClient(process.env.FUNNYSTUDY_SUPABASE_URL!, process.env.FUNNYSTUDY_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
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
