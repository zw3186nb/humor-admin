"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { generateCaptions } from "@/lib/ai";
import { photoUrl } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { VOICE_KEYS, type VoiceKey } from "@/lib/voices";

export type ActionResult = { ok: boolean; message: string } | null;

const MAX_CAPTION = 300;

function isVoice(value: unknown): value is VoiceKey {
  return typeof value === "string" && (VOICE_KEYS as string[]).includes(value);
}

function cleanContent(value: FormDataEntryValue | null) {
  const text = value?.toString().trim() ?? "";
  if (!text) return { error: "The caption can't be empty." };
  if (text.length > MAX_CAPTION) return { error: `Keep it under ${MAX_CAPTION} characters.` };
  return { text };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** UPDATE: edit a caption's text. */
export async function updateCaption(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const content = cleanContent(formData.get("content"));
  if (!Number.isInteger(id)) return { ok: false, message: "Invalid caption." };
  if (content.error) return { ok: false, message: content.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("captions")
    .update({ content: content.text, model: "edited by admin" })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, message: error.message };
  if (!data?.length) return { ok: false, message: "Not saved: the database did not allow this edit." };

  revalidatePath("/captions");
  return { ok: true, message: "Saved." };
}

/** DELETE: remove a caption (its votes go with it). */
export async function deleteCaption(id: number): Promise<ActionResult> {
  await requireAdmin();
  if (!Number.isInteger(id)) return { ok: false, message: "Invalid caption." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("captions").delete().eq("id", id).select("id");
  if (error) return { ok: false, message: error.message };
  if (!data?.length) return { ok: false, message: "Not deleted: the database did not allow it." };

  revalidatePath("/captions");
  revalidatePath("/");
  return { ok: true, message: "Deleted." };
}

/** CREATE (by hand): write a caption for a voice the post is missing. */
export async function createCaption(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const postId = Number(formData.get("post_id"));
  const voice = formData.get("voice");
  const content = cleanContent(formData.get("content"));
  if (!Number.isInteger(postId) || !isVoice(voice)) return { ok: false, message: "Pick a post and a voice." };
  if (content.error) return { ok: false, message: content.error };

  const supabase = await createClient();
  const { error } = await supabase.from("captions").insert({
    post_id: postId,
    voice,
    content: content.text,
    prompt: "Written by an admin in the admin area.",
    model: "written by admin",
  });
  if (error) {
    return {
      ok: false,
      message: error.code === "23505" ? "This post already has a caption in that voice." : error.message,
    };
  }

  revalidatePath("/captions");
  return { ok: true, message: "Caption added." };
}

/** CREATE (with AI): ask the model to caption the photo, keep the requested voice. */
export async function generateCaption(postId: number, voice: string): Promise<ActionResult> {
  await requireAdmin();
  if (!Number.isInteger(postId) || !isVoice(voice)) return { ok: false, message: "Pick a post and a voice." };

  const supabase = await createClient();
  const { data: post } = await supabase
    .from("posts")
    .select("id, image_path, note")
    .eq("id", postId)
    .maybeSingle();
  if (!post) return { ok: false, message: "That post no longer exists." };

  // The photos bucket is public, so the server can fetch the image directly.
  const response = await fetch(photoUrl(post.image_path));
  if (!response.ok) return { ok: false, message: "Could not load the photo." };
  const image = {
    base64: Buffer.from(await response.arrayBuffer()).toString("base64"),
    mimeType: response.headers.get("content-type") ?? "image/jpeg",
  };

  const generation = await generateCaptions(image, post.note);
  if (!generation.ok) return { ok: false, message: generation.message };

  const { error } = await supabase.from("captions").insert({
    post_id: postId,
    voice,
    content: generation.captions[voice].slice(0, MAX_CAPTION),
    prompt: generation.prompt,
    model: generation.model,
  });
  if (error) {
    return {
      ok: false,
      message: error.code === "23505" ? "This post already has a caption in that voice." : error.message,
    };
  }

  revalidatePath("/captions");
  return { ok: true, message: "AI caption added." };
}

/** Users page: make someone an admin, or take admin rights away (never your own). */
export async function setAdmin(userId: string, value: boolean): Promise<ActionResult> {
  const { user } = await requireAdmin();
  if (typeof userId !== "string" || !userId) return { ok: false, message: "Invalid user." };
  if (userId === user.id) return { ok: false, message: "You can't change your own admin rights." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_superadmin", { target: userId, value: Boolean(value) });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/users");
  revalidatePath("/");
  return { ok: true, message: value ? "Now an admin." : "Admin rights removed." };
}

/* ───────────── Photos (memes): create, replace, edit, delete ───────────── */

const NOTE_MAX = 200;

function ownUpload(userId: string, path: unknown): path is string {
  return typeof path === "string" && new RegExp(`^${userId}/[A-Za-z0-9-]+\\.jpg$`).test(path);
}

async function photoAsBase64(path: string) {
  const supabase = await createClient();
  const { data: file } = await supabase.storage.from("photos").download(path);
  if (!file) return null;
  return { base64: Buffer.from(await file.arrayBuffer()).toString("base64"), mimeType: file.type || "image/jpeg" };
}

/** CREATE a new meme: an uploaded photo plus AI-written or hand-written captions. */
export async function createMeme(input: {
  path: string;
  note: string;
  mode: "ai" | "manual";
  captions: Partial<Record<VoiceKey, string>>;
}): Promise<ActionResult> {
  const { user } = await requireAdmin();
  if (!ownUpload(user.id, input.path)) return { ok: false, message: "That upload is not valid." };
  const note = input.note.trim().slice(0, NOTE_MAX) || null;
  const supabase = await createClient();
  const discard = () => supabase.storage.from("photos").remove([input.path]);

  let rows: { voice: VoiceKey; content: string; prompt: string; model: string }[] = [];
  let location: string | null = null;
  let scene: string | null = null;

  if (input.mode === "ai") {
    const image = await photoAsBase64(input.path);
    if (!image) return { ok: false, message: "Could not read the uploaded photo." };
    const generation = await generateCaptions(image, note);
    if (!generation.ok) {
      await discard();
      return { ok: false, message: generation.message };
    }
    location = generation.reading.location || null;
    scene = [generation.reading.scene, generation.reading.funniestDetail].filter(Boolean).join(" ").slice(0, 400) || null;
    rows = VOICE_KEYS.map((voice) => ({
      voice,
      content: generation.captions[voice].slice(0, MAX_CAPTION),
      prompt: generation.prompt,
      model: generation.model,
    }));
  } else {
    for (const voice of VOICE_KEYS) {
      const text = input.captions[voice]?.trim() ?? "";
      if (text.length > MAX_CAPTION) return { ok: false, message: `Keep each caption under ${MAX_CAPTION} characters.` };
      if (text) rows.push({ voice, content: text, prompt: "Written by an admin in the admin area.", model: "written by admin" });
    }
    if (!rows.length) {
      await discard();
      return { ok: false, message: "Write at least one caption, or let the AI write them." };
    }
  }

  const { data: post, error } = await supabase
    .from("posts")
    .insert({ image_path: input.path, note, ai_location: location, ai_scene: scene })
    .select("id")
    .single();
  if (error || !post) {
    await discard();
    return { ok: false, message: error?.message ?? "Could not save the photo." };
  }
  const { error: captionError } = await supabase.from("captions").insert(rows.map((r) => ({ ...r, post_id: post.id })));
  if (captionError) {
    await supabase.from("posts").delete().eq("id", post.id);
    await discard();
    return { ok: false, message: `Could not save the captions: ${captionError.message}` };
  }

  revalidatePath("/captions");
  revalidatePath("/");
  return { ok: true, message: `Meme #${post.id} created.` };
}

/** UPDATE a photo: swap in a newly uploaded image (captions and votes stay). */
export async function replacePhoto(postId: number, path: string): Promise<ActionResult> {
  const { user } = await requireAdmin();
  if (!Number.isInteger(postId) || !ownUpload(user.id, path)) return { ok: false, message: "That upload is not valid." };
  const supabase = await createClient();
  const { data: old } = await supabase.from("posts").select("image_path").eq("id", postId).maybeSingle();
  const { data, error } = await supabase.from("posts").update({ image_path: path }).eq("id", postId).select("id");
  if (error || !data?.length) {
    await supabase.storage.from("photos").remove([path]);
    return { ok: false, message: error?.message ?? "Not saved: the database did not allow this change." };
  }
  if (old?.image_path) await supabase.storage.from("photos").remove([old.image_path]);
  revalidatePath("/captions");
  return { ok: true, message: "Image replaced." };
}

/** UPDATE a photo's note. */
export async function updateNote(postId: number, note: string): Promise<ActionResult> {
  await requireAdmin();
  if (!Number.isInteger(postId)) return { ok: false, message: "Invalid photo." };
  const clean = note.trim();
  if (clean.length > NOTE_MAX) return { ok: false, message: `Keep the note under ${NOTE_MAX} characters.` };
  const supabase = await createClient();
  const { data, error } = await supabase.from("posts").update({ note: clean || null }).eq("id", postId).select("id");
  if (error || !data?.length) return { ok: false, message: error?.message ?? "Not saved: the database did not allow it." };
  revalidatePath("/captions");
  return { ok: true, message: "Saved." };
}

/** DELETE a photo with all of its captions and votes. */
export async function deletePost(postId: number): Promise<ActionResult> {
  await requireAdmin();
  if (!Number.isInteger(postId)) return { ok: false, message: "Invalid photo." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("posts").delete().eq("id", postId).select("image_path");
  if (error || !data?.length) return { ok: false, message: error?.message ?? "Not deleted: the database did not allow it." };
  await supabase.storage.from("photos").remove([data[0].image_path]);
  revalidatePath("/captions");
  revalidatePath("/");
  return { ok: true, message: "Deleted." };
}
