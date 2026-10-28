"use client";

import { useActionState, useState, useTransition } from "react";
import { deleteEngineRow, saveEngineRow } from "@/app/engine-actions";
import type { Field } from "@/lib/engine/resources";

export type Options = Record<string, { value: string; label: string }[]>;
type Values = Record<string, string | number | boolean | null>;

const input =
  "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm placeholder:text-[var(--muted)] focus:border-white/40 focus:outline-none";

function Inputs({ fields, values, options }: { fields: Field[]; values: Values; options: Options }) {
  return (
    <>
      {fields.map((f) => {
        const v = values[f.key];
        const id = `f-${f.key}`;
        if (f.kind === "bool") {
          return (
            <label key={f.key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name={f.key} defaultChecked={Boolean(v)} className="h-4 w-4 accent-white" />
              {f.label}
            </label>
          );
        }
        return (
          <label key={f.key} htmlFor={id} className="flex flex-col gap-1 text-xs text-[var(--muted)]">
            {f.label}
            {f.required ? "" : " (optional)"}
            {f.kind === "textarea" ? (
              <textarea id={id} name={f.key} rows={3} defaultValue={v == null ? "" : String(v)} required={f.required} placeholder={f.placeholder} className={`${input} resize-y`} />
            ) : f.kind === "select" ? (
              <select id={id} name={f.key} defaultValue={v == null ? "" : String(v)} required={f.required} className={input}>
                <option value="">—</option>
                {(options[f.ref!] ?? []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={id}
                name={f.key}
                type={f.kind === "number" ? "number" : "text"}
                step="any"
                defaultValue={v == null ? "" : String(v)}
                required={f.required}
                placeholder={f.placeholder}
                className={input}
              />
            )}
          </label>
        );
      })}
    </>
  );
}

/** "+ Add" button that opens a create form. */
export function EngineCreate({ slug, title, fields, options }: { slug: string; title: string; fields: Field[]; options: Options }) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [state, action, pending] = useActionState(async (prev: Awaited<ReturnType<typeof saveEngineRow>>, formData: FormData) => {
    const result = await saveEngineRow(slug, null, prev, formData);
    if (result?.ok) setFormKey((k) => k + 1); // clear the form for the next one
    return result;
  }, null);

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setOpen(true)} className="cursor-pointer rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90">
          + Add {title}
        </button>
        {state?.ok && <span role="status" className="text-sm text-emerald-300">{state.message}</span>}
      </div>
    );
  }
  return (
    <form key={formKey} action={action} className="flex flex-col gap-3 rounded-2xl border border-white/15 bg-[var(--surface)] p-5">
      <h2 className="text-sm font-semibold">New {title}</h2>
      <Inputs fields={fields} values={{}} options={options} />
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="cursor-pointer rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-60">
          {pending ? "Saving…" : "Add"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="cursor-pointer text-sm text-[var(--muted)] hover:text-white">
          Close
        </button>
        {state && <span role={state.ok ? "status" : "alert"} className={`text-sm ${state.ok ? "text-emerald-300" : "text-red-300"}`}>{state.message}</span>}
      </div>
    </form>
  );
}

/** Edit / Delete controls for one row. */
export function EngineRowActions({
  slug,
  id,
  fields,
  values,
  options,
  canUpdate,
  canDelete,
}: {
  slug: string;
  id: string;
  fields: Field[];
  values: Values;
  options: Options;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const [mode, setMode] = useState<"idle" | "edit" | "delete">("idle");
  const [state, action, pending] = useActionState(async (prev: Awaited<ReturnType<typeof saveEngineRow>>, formData: FormData) => {
    const result = await saveEngineRow(slug, id, prev, formData);
    if (result?.ok) setMode("idle");
    return result;
  }, null);
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const link = "cursor-pointer text-xs text-[var(--muted)] hover:text-white";

  if (mode === "edit") {
    return (
      <form action={action} className="flex min-w-64 flex-col gap-2">
        <Inputs fields={fields} values={values} options={options} />
        <div className="flex items-center gap-2">
          <button disabled={pending} className="cursor-pointer rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-black disabled:opacity-60">
            {pending ? "Saving…" : "Save"}
          </button>
          <button type="button" className={link} onClick={() => setMode("idle")}>
            Cancel
          </button>
        </div>
        {state && !state.ok && <p role="alert" className="text-xs text-red-300">{state.message}</p>}
      </form>
    );
  }
  if (mode === "delete") {
    return (
      <div className="flex flex-col gap-1.5 text-xs">
        <span className="text-red-200">Delete this row?</span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={deleting}
            className="cursor-pointer rounded-md bg-red-500 px-2 py-0.5 font-semibold text-white"
            onClick={() =>
              startDelete(async () => {
                const r = await deleteEngineRow(slug, id);
                if (r && !r.ok) setDeleteError(r.message);
                else setMode("idle");
              })
            }
          >
            {deleting ? "Deleting…" : "Yes, delete"}
          </button>
          <button type="button" className={link} onClick={() => setMode("idle")}>
            Cancel
          </button>
        </div>
        {deleteError && <p role="alert" className="text-red-300">{deleteError}</p>}
      </div>
    );
  }
  return (
    <div className="flex gap-3 whitespace-nowrap">
      {canUpdate && (
        <button type="button" className={link} onClick={() => setMode("edit")}>
          Edit
        </button>
      )}
      {canDelete && (
        <button type="button" className={`${link} hover:text-red-300`} onClick={() => { setDeleteError(null); setMode("delete"); }}>
          Delete
        </button>
      )}
      {state?.ok && <span className="text-xs text-emerald-300">{state.message}</span>}
    </div>
  );
}
