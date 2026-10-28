import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { formatTime } from "@/lib/data";
import { engineConfigured, engineDb } from "@/lib/engine/db";
import { loadRefs } from "@/lib/engine/load";
import { RESOURCES, opsLabel } from "@/lib/engine/resources";
import { EngineNotConfigured } from "./not-configured";

export const metadata = { title: "Humor engine | Three Takes Admin" };

const GROUPS = ["Prompt chains", "Content", "LLMs", "Sign-up access"] as const;

/** Overview of the humor engine: row counts for every table, and the latest model calls. */
export default async function EngineOverview() {
  await requireAdmin();
  if (!engineConfigured()) return <EngineNotConfigured />;
  const db = engineDb();

  const [counts, latest, refs] = await Promise.all([
    Promise.all(
      RESOURCES.map(async (r) => {
        const { count } = await db.from(r.table).select("id", { count: "exact", head: true });
        return [r.slug, count ?? 0] as const;
      }),
    ).then((pairs) => new Map(pairs)),
    db
      .from("llm_model_responses")
      .select("id, created_datetime_utc, llm_model_id, humor_flavor_id, processing_time_seconds, llm_prompt_chain_id")
      .order("created_datetime_utc", { ascending: false })
      .limit(8),
    loadRefs(["models", "flavors"]),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Humor engine</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">What the caption engine is made of</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          The course&apos;s caption-generation database: prompt chains and their steps, the models they run on, the
          raw model responses, and who may sign up. Click a table to read or manage it.
        </p>
      </header>

      {GROUPS.map((group) => (
        <section key={group}>
          <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">{group}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {RESOURCES.filter((r) => r.group === group).map((r) => (
              <Link key={r.slug} href={`/engine/${r.slug}`} className="rounded-2xl border border-white/10 bg-[var(--surface)] p-4 transition hover:border-white/30">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium">{r.title}</p>
                  <p className="text-2xl font-semibold tabular-nums">{(counts.get(r.slug) ?? 0).toLocaleString("en-US")}</p>
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">{r.blurb}</p>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--muted)]">{opsLabel(r)}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <section className="rounded-2xl border border-white/10 bg-[var(--surface)] p-5">
        <h2 className="text-sm font-semibold">Latest model calls</h2>
        <p className="mt-0.5 text-xs text-[var(--muted)]">The most recent LLM responses: which model, which flavor, and how long it took.</p>
        <ol className="mt-4 divide-y divide-white/5 text-sm">
          {(latest.data ?? []).map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {refs.models.get(String(r.llm_model_id)) ?? `Model #${r.llm_model_id}`}
                <span className="text-[var(--muted)]"> · {refs.flavors.get(String(r.humor_flavor_id)) ?? `flavor #${r.humor_flavor_id}`}</span>
              </span>
              <span className="flex items-center gap-3 text-xs text-[var(--muted)]">
                <span className="tabular-nums">{r.processing_time_seconds}s</span>
                <span>{formatTime(r.created_datetime_utc)}</span>
                {r.llm_prompt_chain_id && (
                  <Link href={`/engine/llm-responses?chain=${r.llm_prompt_chain_id}`} className="hover:text-white">
                    Chain {r.llm_prompt_chain_id} →
                  </Link>
                )}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
