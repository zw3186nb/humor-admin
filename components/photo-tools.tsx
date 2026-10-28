"use client";

import { useRef, useState, useTransition } from "react";
import { deletePost, replacePhoto, updateNote } from "@/app/actions";
import { shrink, uploadPhoto } from "@/lib/image-upload";

/** Under each photo: replace the image, edit the note, or delete the whole meme. */
export function PhotoTools({ postId, userId, note }: { postId: number; userId: string; note: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"idle" | "note" | "delete">("idle");
  const [draft, setDraft] = useState(note ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);

  async function replace(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    setUploading(true);
    try {
      const path = await uploadPhoto(userId, await shrink(file));
      const result = await replacePhoto(postId, path);
      if (!result?.ok) throw new Error(result?.message ?? "Could not replace the image.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not replace the image.");
    } finally {
      setUploading(false);
    }
  }

  const run = (fn: () => Promise<{ ok: boolean; message: string } | null>, after?: () => void) =>
    startTransition(async () => {
      const result = await fn();
      if (result && !result.ok) setMessage(result.message);
      else after?.();
    });

  const link = "cursor-pointer text-xs text-[var(--muted)] hover:text-white disabled:opacity-50";

  return (
    <div className="mt-2 flex flex-col gap-2">
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => replace(e.target.files?.[0])} />
      {mode === "idle" && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <button type="button" className={link} disabled={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? "Uploading…" : "Replace image"}
          </button>
          <button type="button" className={link} onClick={() => setMode("note")}>
            Edit note
          </button>
          <button type="button" className={`${link} hover:text-red-300`} onClick={() => setMode("delete")}>
            Delete photo
          </button>
        </div>
      )}
      {mode === "note" && (
        <div className="flex flex-col gap-1.5">
          <input
            value={draft}
            maxLength={200}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Note"
            className="w-full rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs focus:border-white/40 focus:outline-none"
          />
          <div className="flex gap-2">
            <button type="button" disabled={pending} className="cursor-pointer rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-black" onClick={() => run(() => updateNote(postId, draft), () => setMode("idle"))}>
              {pending ? "Saving…" : "Save"}
            </button>
            <button type="button" className={link} onClick={() => setMode("idle")}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {mode === "delete" && (
        <div className="flex flex-col gap-1.5 text-xs">
          <span className="text-red-200">Delete this photo with all its captions and votes?</span>
          <div className="flex gap-2">
            <button type="button" disabled={pending} className="cursor-pointer rounded-md bg-red-500 px-2 py-0.5 font-semibold text-white" onClick={() => run(() => deletePost(postId))}>
              {pending ? "Deleting…" : "Yes, delete"}
            </button>
            <button type="button" className={link} onClick={() => setMode("idle")}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {message && <p role="alert" className="text-xs text-red-300">{message}</p>}
    </div>
  );
}
