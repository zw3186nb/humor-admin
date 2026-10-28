"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions";
import { requireAdmin } from "@/lib/admin";
import { engineActorId, engineConfigured, engineDb } from "@/lib/engine/db";
import { getResource, type Field } from "@/lib/engine/resources";

function readField(field: Field, formData: FormData): { value?: unknown; error?: string } {
  const raw = formData.get(field.key);
  if (field.kind === "bool") return { value: raw === "on" || raw === "true" };
  const text = raw?.toString().trim() ?? "";
  if (!text) {
    if (field.required) return { error: `${field.label} is required.` };
    return { value: field.kind === "number" && field.key === "priority" ? 0 : null };
  }
  if (field.kind === "number" || field.kind === "select") {
    const n = Number(text);
    if (!Number.isFinite(n)) return { error: `${field.label} must be a number.` };
    return { value: n };
  }
  if (text.length > 5000) return { error: `${field.label} is too long.` };
  return { value: text };
}

/** CREATE (id = null) or UPDATE (id given) one row of a Humor engine table. */
export async function saveEngineRow(
  slug: string,
  id: string | null,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { profile } = await requireAdmin();
  const resource = getResource(slug);
  const op = id === null ? "create" : "update";
  if (!resource || !resource.ops.includes(op) || !resource.fields) return { ok: false, message: "Not allowed." };
  if (!engineConfigured()) return { ok: false, message: "The humor engine database is not configured." };

  const values: Record<string, unknown> = {};
  for (const field of resource.fields) {
    const { value, error } = readField(field, formData);
    if (error) return { ok: false, message: error };
    values[field.key] = value;
  }

  const actor = await engineActorId(profile.email);
  if (!actor) return { ok: false, message: "No matching profile in the humor engine database to record this change." };
  const db = engineDb();
  const now = new Date().toISOString();

  const { error } =
    op === "create"
      ? await db.from(resource.table).insert({ ...values, created_by_user_id: actor, modified_by_user_id: actor })
      : await db
          .from(resource.table)
          .update({ ...values, modified_by_user_id: actor, modified_datetime_utc: now })
          .eq("id", id!);
  if (error) return { ok: false, message: error.code === "23505" ? "That already exists." : error.message };

  revalidatePath(`/engine/${slug}`);
  revalidatePath("/engine");
  return { ok: true, message: op === "create" ? "Added." : "Saved." };
}

/** DELETE one row of a Humor engine table. */
export async function deleteEngineRow(slug: string, id: string): Promise<ActionResult> {
  await requireAdmin();
  const resource = getResource(slug);
  if (!resource || !resource.ops.includes("delete")) return { ok: false, message: "Not allowed." };
  if (!engineConfigured()) return { ok: false, message: "The humor engine database is not configured." };

  const { data, error } = await engineDb().from(resource.table).delete().eq("id", id).select("id");
  if (error) {
    return {
      ok: false,
      message: error.code === "23503" ? "Can't delete: other rows still use this one." : error.message,
    };
  }
  if (!data?.length) return { ok: false, message: "Nothing was deleted." };
  revalidatePath(`/engine/${slug}`);
  revalidatePath("/engine");
  return { ok: true, message: "Deleted." };
}
