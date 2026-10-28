import { VoiceTag } from "@/components/voice-tag";
import { getCaptions, getJokeVotes, getPosts, getProfiles, getVotes } from "@/lib/data";
import { computeStats, type Stats } from "@/lib/stats";
import { voiceColor, voiceLabel } from "@/lib/voice-style";

export const metadata = { title: "Dashboard | Three Takes Admin" };

const pct = (x: number) => `${Math.round(x * 100)}%`;

function Card({
  title,
  note,
  wide,
  children,
}: {
  title: string;
  note?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-[var(--surface)] p-5 ${wide ? "lg:col-span-2" : ""}`}>
      <h2 className="text-sm font-semibold">{title}</h2>
      {note && <p className="mt-0.5 text-xs text-[var(--muted)]">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Tile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[var(--surface)] p-4">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-xs text-[var(--muted)]">{sub}</p>}
    </div>
  );
}

/** Up/down votes per day, stacked: upvotes on top of downvotes. */
function VotesPerDay({ days }: { days: Stats["perDay"] }) {
  const max = Math.max(1, ...days.map((d) => d.up + d.down));
  const total = days.reduce((s, d) => s + d.up + d.down, 0);
  return (
    <div>
      <div className="mb-3 flex gap-4 text-xs text-[var(--muted)]">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-[var(--up)]" /> Upvotes
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-[var(--down)]" /> Downvotes
        </span>
        <span className="ml-auto tabular-nums">{total} in 14 days</span>
      </div>
      <div className="flex h-40 items-end gap-1.5 border-b border-white/15">
        {days.map((d) => (
          <div
            key={d.day}
            tabIndex={0}
            className="tip flex h-full flex-1 flex-col justify-end gap-[2px] rounded-t outline-none hover:bg-white/5"
            data-tip={`${d.label}: ${d.up} up · ${d.down} down`}
          >
            {d.up > 0 && (
              <div className="rounded-t-[4px] bg-[var(--up)]" style={{ height: `${(d.up / max) * 100}%` }} />
            )}
            {d.down > 0 && (
              <div
                className={`bg-[var(--down)] ${d.up > 0 ? "" : "rounded-t-[4px]"}`}
                style={{ height: `${(d.down / max) * 100}%` }}
              />
            )}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-[var(--muted)]">
        <span>{days[0]?.label}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

/** 24 cells, one per hour; darker = fewer votes, lighter = more. */
function VotesByHour({ hours }: { hours: number[] }) {
  const max = Math.max(1, ...hours);
  const peak = hours.indexOf(Math.max(...hours));
  const fmt = (h: number) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
  return (
    <div>
      <div className="grid grid-cols-24 gap-[2px]">
        {hours.map((count, h) => (
          <div
            key={h}
            tabIndex={0}
            className="tip h-10 rounded-[4px] outline-none"
            data-tip={`${fmt(h)}: ${count} ${count === 1 ? "vote" : "votes"}`}
            style={{
              background:
                count === 0
                  ? "rgba(255,255,255,0.05)"
                  : `color-mix(in oklab, var(--seq-high) ${Math.round((count / max) * 100)}%, var(--seq-low))`,
            }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-[var(--muted)]">
        <span>12am</span>
        <span>12pm</span>
        <span>11pm</span>
      </div>
      {hours.some((h) => h > 0) && (
        <p className="mt-3 text-sm">
          Busiest hour: <span className="font-semibold">{fmt(peak)}</span>{" "}
          <span className="text-[var(--muted)]">(New York time)</span>
        </p>
      )}
    </div>
  );
}

function VoiceBattle({ battle, decided }: { battle: Stats["battle"]; decided: number }) {
  const max = Math.max(1, ...battle.map((b) => b.wins));
  const ranked = [...battle].sort((a, b) => b.wins - a.wins || b.net - a.net);
  return (
    <ol className="flex flex-col gap-3">
      {ranked.map((b) => (
        <li key={b.voice}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <VoiceTag voice={b.voice} />
            <span className="tabular-nums">
              <span className="font-semibold">{b.wins}</span>
              <span className="text-[var(--muted)]">
                {" "}
                {b.wins === 1 ? "win" : "wins"} · net {b.net > 0 ? `+${b.net}` : b.net}
              </span>
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full"
              style={{ width: `${(b.wins / max) * 100}%`, background: voiceColor(b.voice) }}
            />
          </div>
        </li>
      ))}
      <p className="text-xs text-[var(--muted)]">
        A voice wins a photo when its caption has the single highest net score. {decided}{" "}
        {decided === 1 ? "photo has" : "photos have"} a winner.
      </p>
    </ol>
  );
}

function RankList({ items, empty }: { items: { name: string; count: number }[]; empty: string }) {
  if (!items.length) return <p className="text-sm text-[var(--muted)]">{empty}</p>;
  const max = Math.max(...items.map((i) => i.count));
  return (
    <ol className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.name} className="text-sm">
          <div className="flex justify-between gap-3">
            <span className="truncate">{item.name}</span>
            <span className="tabular-nums text-[var(--muted)]">{item.count}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-white/5">
            <div className="h-full rounded-full bg-[var(--seq-high)]" style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function CaptionQuote({ caption, empty }: { caption: Stats["topCaption"]; empty: string }) {
  if (!caption) return <p className="text-sm text-[var(--muted)]">{empty}</p>;
  return (
    <figure>
      <blockquote className="text-[15px] leading-snug">“{caption.content}”</blockquote>
      <figcaption className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
        <VoiceTag voice={caption.voice} />
        <span className="tabular-nums">
          ▲ {caption.upvotes} · ▼ {caption.downvotes}
        </span>
      </figcaption>
    </figure>
  );
}

export default async function Dashboard() {
  const [profiles, posts, captions, votes, jokeVotes] = await Promise.all([
    getProfiles(),
    getPosts(),
    getCaptions(),
    getVotes(),
    getJokeVotes(),
  ]);
  const error = [profiles, posts, captions, votes, jokeVotes].find((r) => r.error)?.error;
  const s = computeStats({
    profiles: profiles.data,
    posts: posts.data,
    captions: captions.data,
    votes: votes.data,
    jokeVotes: jokeVotes.data,
  });
  const lengthGap =
    s.lengthWinners !== null && s.lengthOthers !== null ? s.lengthWinners - s.lengthOthers : null;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">What&apos;s happening on Three Takes</h1>
      </header>

      {error && (
        <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
          Some data could not load: {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Members" value={s.members} sub={`${s.activeVoters} have voted · ${s.admins} admin`} />
        <Tile label="Photos posted" value={s.posts} sub={`${s.captions} AI captions`} />
        <Tile label="Votes cast" value={s.captionVotes + s.jokeVotes} sub={`${s.captionVotes} on captions · ${s.jokeVotes} on jokes`} />
        <Tile label="Upvote share" value={pct(s.upShare)} sub="of caption votes were ▲" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Votes per day" note="Captions and jokes, last 14 days. Hover a bar for numbers.">
          <VotesPerDay days={s.perDay} />
        </Card>
        <Card title="Which voice is funniest?" note="Photos won by each AI voice, plus its overall net score.">
          <VoiceBattle battle={s.battle} decided={s.decidedPosts} />
        </Card>
        <Card title="When do people vote?" note="Every vote, by hour of day. Lighter = more votes.">
          <VotesByHour hours={s.byHour} />
        </Card>
        <Card
          title="Does length matter?"
          note="On each photo, the caption with the most votes (highest net score) vs the other captions on that photo."
        >
          {lengthGap === null ? (
            <p className="text-sm text-[var(--muted)]">Not enough decided photos yet.</p>
          ) : (
            <div>
              <p className="text-2xl font-semibold tracking-tight">
                Most-voted captions are {Math.abs(lengthGap)} characters {lengthGap >= 0 ? "longer" : "shorter"}
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-white/5 p-3">
                  <dt className="text-xs text-[var(--muted)]">Most-voted caption, on average</dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums">{s.lengthWinners} chars</dd>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <dt className="text-xs text-[var(--muted)]">Other captions, on average</dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums">{s.lengthOthers} chars</dd>
                </div>
              </dl>
            </div>
          )}
        </Card>
        <Card title="🏆 Funniest caption ever" note="Highest net score (upvotes minus downvotes).">
          <CaptionQuote caption={s.topCaption} empty="No upvoted captions yet." />
        </Card>
        <Card title="🌶️ Most divisive caption" note="Got both upvotes and downvotes, the most evenly.">
          <CaptionQuote caption={s.controversial} empty="Nothing divisive yet: no caption has both up and down votes." />
        </Card>
        <Card title="Most active voters">
          <RankList items={s.topVoters} empty="No votes yet." />
        </Card>
        <Card title="Top photographers" note="Members by number of photos posted.">
          <RankList items={s.topPosters} empty="No photos yet." />
        </Card>
        <Card wide title="Where photos are taken" note="Locations the AI recognized in the photos.">
          <RankList items={s.locations} empty="No locations recognized yet." />
        </Card>
      </div>

      <p className="text-xs text-[var(--muted)]">
        Voice colors: {["midwest_nice", "nyc_local", "chronically_online"].map(voiceLabel).join(", ")}. Every chart also
        shows its numbers in text.
      </p>
    </div>
  );
}
