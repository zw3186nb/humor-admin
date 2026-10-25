import type { CaptionRow, JokeVoteRow, PostRow, ProfileRow, VoteRow } from "@/lib/data";
import { VOICE_KEYS, type VoiceKey } from "@/lib/voices";

const TZ = "America/New_York";
const net = (c: CaptionRow) => c.upvotes - c.downvotes;

function dayKey(iso: string) {
  // YYYY-MM-DD in New York time
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
}

export type DayCount = { day: string; label: string; up: number; down: number };
export type VoiceBattle = { voice: VoiceKey; wins: number; net: number; captions: number };

export type Stats = {
  members: number;
  admins: number;
  posts: number;
  captions: number;
  captionVotes: number;
  jokeVotes: number;
  upShare: number; // 0..1 of all caption votes that were upvotes
  activeVoters: number; // members who cast at least one vote
  perDay: DayCount[]; // last 14 days, oldest first
  byHour: number[]; // 24 buckets, New York time, all votes
  battle: VoiceBattle[];
  decidedPosts: number; // posts with a single clear winner
  topCaption: CaptionRow | null;
  controversial: CaptionRow | null;
  lengthWinners: number | null; // average characters of winning captions
  lengthOthers: number | null;
  locations: { name: string; count: number }[];
  topVoters: { name: string; count: number }[];
  topPosters: { name: string; count: number }[];
  models: { name: string; count: number }[];
};

function countBy<T>(items: T[], key: (item: T) => string | null | undefined) {
  const map = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (k) map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);

export function computeStats(input: {
  profiles: ProfileRow[];
  posts: PostRow[];
  captions: CaptionRow[];
  votes: VoteRow[];
  jokeVotes: JokeVoteRow[];
  now?: Date;
}): Stats {
  const { profiles, posts, captions, votes, jokeVotes } = input;
  const now = input.now ?? new Date();
  // Rank lists count per account; two accounts with the same name get their email added
  // so they are not merged into one row.
  const baseName = (p: ProfileRow) => [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Unnamed";
  const nameCount = countBy(profiles, baseName);
  const shared = new Set(nameCount.filter((n) => n.count > 1).map((n) => n.name));
  const nameOf = new Map(
    profiles.map((p) => [p.id, shared.has(baseName(p)) && p.email ? `${baseName(p)} (${p.email})` : baseName(p)]),
  );

  // Votes per day, last 14 days (caption + joke votes together).
  const allVotes = [...votes, ...jokeVotes];
  const perDay: DayCount[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    perDay.push({
      day: dayKey(d.toISOString()),
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: TZ }),
      up: 0,
      down: 0,
    });
  }
  const dayIndex = new Map(perDay.map((d, i) => [d.day, i]));
  for (const v of allVotes) {
    const i = dayIndex.get(dayKey(v.created_at));
    if (i !== undefined) perDay[i][v.vote > 0 ? "up" : "down"]++;
  }

  // Votes by hour of day.
  const byHour = Array.from({ length: 24 }, () => 0);
  for (const v of allVotes) {
    const hour = Number(
      new Date(v.created_at).toLocaleString("en-US", { hour: "numeric", hourCycle: "h23", timeZone: TZ }),
    );
    byHour[hour % 24]++;
  }

  // Voice battle: on each post, which voice has the strictly highest net score?
  const byPost = new Map<number, CaptionRow[]>();
  for (const c of captions) byPost.set(c.post_id, [...(byPost.get(c.post_id) ?? []), c]);
  const wins = new Map<string, number>();
  const winners: CaptionRow[] = [];
  const others: CaptionRow[] = [];
  for (const group of byPost.values()) {
    const best = Math.max(...group.map(net));
    const leaders = group.filter((c) => net(c) === best);
    if (best > 0 && leaders.length === 1) {
      wins.set(leaders[0].voice, (wins.get(leaders[0].voice) ?? 0) + 1);
      winners.push(leaders[0]);
      others.push(...group.filter((c) => c !== leaders[0]));
    }
  }
  const battle = VOICE_KEYS.map((voice) => {
    const mine = captions.filter((c) => c.voice === voice);
    return { voice, wins: wins.get(voice) ?? 0, net: mine.reduce((s, c) => s + net(c), 0), captions: mine.length };
  });

  const ups = votes.filter((v) => v.vote > 0).length;
  const sorted = [...captions].sort((a, b) => net(b) - net(a) || b.upvotes - a.upvotes);
  // Controversial: both sides showed up. Score = the smaller side, then total votes.
  const controversial =
    [...captions]
      .filter((c) => c.upvotes > 0 && c.downvotes > 0)
      .sort(
        (a, b) =>
          Math.min(b.upvotes, b.downvotes) - Math.min(a.upvotes, a.downvotes) ||
          b.upvotes + b.downvotes - (a.upvotes + a.downvotes),
      )[0] ?? null;

  return {
    members: profiles.length,
    admins: profiles.filter((p) => p.is_superadmin).length,
    posts: posts.length,
    captions: captions.length,
    captionVotes: votes.length,
    jokeVotes: jokeVotes.length,
    upShare: votes.length ? ups / votes.length : 0,
    activeVoters: new Set(allVotes.map((v) => v.user_id)).size,
    perDay,
    byHour,
    battle,
    decidedPosts: winners.length,
    topCaption: sorted[0] && net(sorted[0]) > 0 ? sorted[0] : null,
    controversial,
    lengthWinners: avg(winners.map((c) => c.content.length)),
    lengthOthers: avg(others.map((c) => c.content.length)),
    locations: countBy(posts, (p) => p.ai_location).slice(0, 6),
    topVoters: countBy(allVotes, (v) => nameOf.get(v.user_id)).slice(0, 5),
    topPosters: countBy(posts, (p) => nameOf.get(p.user_id) ?? p.author_name).slice(0, 5),
    models: countBy(captions, (c) => c.model),
  };
}
