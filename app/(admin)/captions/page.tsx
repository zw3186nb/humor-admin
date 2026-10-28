import Link from "next/link";
import { CaptionCreator } from "@/components/caption-creator";
import { CaptionEditor } from "@/components/caption-editor";
import { MemeCreator } from "@/components/meme-creator";
import { PhotoTools } from "@/components/photo-tools";
import { VoiceTag } from "@/components/voice-tag";
import { requireAdmin } from "@/lib/admin";
import { formatTime, getCaptions, getPosts, photoUrl } from "@/lib/data";
import { voiceLabel } from "@/lib/voice-style";
import { VOICE_KEYS } from "@/lib/voices";

export const metadata = { title: "Memes & captions | Three Takes Admin" };

const PAGE_SIZE = 12;

/** CREATE / READ / UPDATE / DELETE photos (memes) and their AI-generated captions. */
export default async function CaptionsPage({ searchParams }: PageProps<"/captions">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const postFilter = Number(params.post);
  const page = Math.max(1, Number(params.page) || 1);

  const [{ user }, posts, captions] = await Promise.all([requireAdmin(), getPosts(), getCaptions()]);
  const byPost = new Map<number, typeof captions.data>();
  for (const c of captions.data) byPost.set(c.post_id, [...(byPost.get(c.post_id) ?? []), c]);

  const matches = posts.data.filter((post) => {
    if (Number.isInteger(postFilter) && postFilter > 0) return post.id === postFilter;
    if (!q) return true;
    const haystack = [post.note, post.ai_location, post.author_name, ...(byPost.get(post.id) ?? []).map((c) => c.content)]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q.toLowerCase());
  });
  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const shown = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const missing = posts.data.reduce((n, p) => n + VOICE_KEYS.filter((v) => !(byPost.get(p.id) ?? []).some((c) => c.voice === v)).length, 0);
  const pageHref = (n: number) => `/captions?${new URLSearchParams({ ...(q ? { q } : {}), page: String(n) })}`;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Photos & AI-generated captions · create · read · update · delete</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Memes &amp; captions</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {captions.data.length} captions on {posts.data.length} photos
            {missing > 0 && <> · {missing} missing {missing === 1 ? "voice" : "voices"} you can create</>}.
          </p>
        </div>
        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search captions, notes, places"
            className="w-64 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm placeholder:text-[var(--muted)] focus:border-white/40 focus:outline-none"
          />
          <button className="cursor-pointer rounded-lg border border-white/15 px-3 py-2 text-sm hover:border-white/40">Search</button>
        </form>
      </header>

      <MemeCreator userId={user.id} />

      {(posts.error || captions.error) && (
        <p role="alert" className="text-sm text-red-300">Could not load: {posts.error ?? captions.error}</p>
      )}
      {(q || postFilter > 0) && (
        <p className="text-sm text-[var(--muted)]">
          {matches.length} {matches.length === 1 ? "photo" : "photos"} {postFilter > 0 ? `(photo #${postFilter})` : `match “${q}”`} ·{" "}
          <Link href="/captions" className="text-white hover:underline">Show all</Link>
        </p>
      )}

      <ul className="flex flex-col gap-4">
        {shown.map((post) => {
          const list = byPost.get(post.id) ?? [];
          return (
            <li key={post.id} className="grid gap-4 rounded-2xl border border-white/10 bg-[var(--surface)] p-4 sm:grid-cols-[180px_minmax(0,1fr)]">
              <div>
                {/* Served straight from Supabase Storage. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl(post.image_path)} alt={post.note ?? `Photo #${post.id}`} loading="lazy" className="aspect-square w-full rounded-xl bg-black object-cover" />
                <p className="mt-2 text-xs text-[var(--muted)]">
                  <span className="text-white">#{post.id}</span> · {post.author_name} · {formatTime(post.created_at)}
                </p>
                {post.ai_location && <p className="mt-0.5 text-xs text-[var(--muted)]">📍 {post.ai_location}</p>}
                {post.note && <p className="mt-0.5 text-xs italic text-[var(--muted)]">“{post.note}”</p>}
                <PhotoTools key={`${post.id}-${post.note}`} postId={post.id} userId={user.id} note={post.note} />
              </div>
              <ol className="flex flex-col divide-y divide-white/5">
                {VOICE_KEYS.map((voice) => {
                  const caption = list.find((c) => c.voice === voice);
                  return (
                    <li key={voice} className="py-3 first:pt-0 last:pb-0">
                      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                        <VoiceTag voice={voice} />
                        {caption && (
                          <span className="text-[11px] tabular-nums text-[var(--muted)]">
                            ▲ {caption.upvotes} · ▼ {caption.downvotes} · {caption.model}
                          </span>
                        )}
                      </div>
                      {caption ? (
                        <CaptionEditor key={`${caption.id}-${caption.content}`} id={caption.id} content={caption.content} />
                      ) : (
                        <CaptionCreator postId={post.id} voice={voice} voiceLabel={voiceLabel(voice)} />
                      )}
                    </li>
                  );
                })}
              </ol>
            </li>
          );
        })}
        {shown.length === 0 && <li className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-[var(--muted)]">No photos here.</li>}
      </ul>

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-center gap-3 text-sm">
          {page > 1 && <Link href={pageHref(page - 1)} className="rounded-full border border-white/15 px-3 py-1.5 hover:border-white/40">← Newer</Link>}
          <span className="text-[var(--muted)]">Page {page} of {pages}</span>
          {page < pages && <Link href={pageHref(page + 1)} className="rounded-full border border-white/15 px-3 py-1.5 hover:border-white/40">Older →</Link>}
        </nav>
      )}
    </div>
  );
}
