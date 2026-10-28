"use client";

import { useEffect, useRef, useState } from "react";
import { createMeme } from "@/app/actions";
import { shrink, uploadPhoto } from "@/lib/image-upload";
import { voiceLabel } from "@/lib/voice-style";
import { VOICE_KEYS, type VoiceKey } from "@/lib/voices";

const field =
  "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm placeholder:text-[var(--muted)] focus:border-white/40 focus:outline-none";

/** CREATE a brand-new meme: upload an image, then let the AI caption it or write the captions yourself. */
export function MemeCreator({ userId }: { userId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [captions, setCaptions] = useState<Partial<Record<VoiceKey, string>>>({});
  const [busy, setBusy] = useState<null | "ai" | "manual">(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  function reset() {
    setPhoto(null);
    setPreview(null);
    setNote("");
    setCaptions({});
  }

  async function choose(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    try {
      const blob = await shrink(file);
      setPhoto(blob);
      setPreview(URL.createObjectURL(blob));
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Could not read that image." });
    }
  }

  async function submit(mode: "ai" | "manual") {
    if (!photo || busy) return;
    if (mode === "manual" && !VOICE_KEYS.some((v) => captions[v]?.trim())) {
      setMessage({ ok: false, text: "Write at least one caption first, or use AI." });
      return;
    }
    setBusy(mode);
    setMessage(null);
    try {
      const path = await uploadPhoto(userId, photo);
      const result = await createMeme({ path, note, mode, captions });
      if (!result?.ok) throw new Error(result?.message ?? "Something went wrong.");
      setMessage({ ok: true, text: `${result.message} It's at the top of the list below.` });
      reset();
      setOpen(false);
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Something went wrong." });
    } finally {
      setBusy(null);
    }
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="cursor-pointer rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
        >
          + Create new meme
        </button>
        {message?.ok && <p role="status" className="text-sm text-emerald-300">{message.text}</p>}
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-white/15 bg-[var(--surface)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Create a new meme</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Upload an image, then let the AI write all three captions or write your own. It is posted to the feed as you.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            reset();
            setMessage(null);
          }}
          className="cursor-pointer text-xs text-[var(--muted)] hover:text-white"
        >
          Close
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[200px_minmax(0,1fr)]">
        <div>
          <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => choose(e.target.files?.[0])} />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              choose(e.dataTransfer.files?.[0]);
            }}
            className="flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/20 bg-black/30 text-center text-xs text-[var(--muted)] hover:border-white/40"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="New meme preview" className="h-full w-full object-cover" />
            ) : (
              <span className="px-4">Click or drop an image here</span>
            )}
          </button>
          {preview && (
            <button type="button" onClick={() => inputRef.current?.click()} className="mt-2 cursor-pointer text-xs text-[var(--muted)] hover:text-white">
              Choose a different image
            </button>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <label className="text-xs text-[var(--muted)]">
            Note (optional, shown with the photo)
            <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} className={`${field} mt-1`} placeholder="e.g. finals week at Butler" />
          </label>
          {VOICE_KEYS.map((voice) => (
            <label key={voice} className="text-xs text-[var(--muted)]">
              {voiceLabel(voice)} caption (for “Use my captions”)
              <textarea
                rows={2}
                maxLength={300}
                value={captions[voice] ?? ""}
                onChange={(e) => setCaptions((c) => ({ ...c, [voice]: e.target.value }))}
                className={`${field} mt-1 resize-y`}
              />
            </label>
          ))}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={!photo || busy !== null}
              onClick={() => submit("ai")}
              className="cursor-pointer rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "ai" ? "AI is writing… (about 10 s)" : "✨ Create with AI captions"}
            </button>
            <button
              type="button"
              disabled={!photo || busy !== null}
              onClick={() => submit("manual")}
              className="cursor-pointer rounded-lg border border-white/20 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 hover:border-white/50"
            >
              {busy === "manual" ? "Saving…" : "Use my captions"}
            </button>
          </div>
          {!photo && <p className="text-xs text-[var(--muted)]">Choose an image first.</p>}
          {message && (
            <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-emerald-300" : "text-red-300"}`}>
              {message.text}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
