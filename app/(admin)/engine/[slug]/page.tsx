import Link from "next/link";
import { notFound } from "next/navigation";
import { EngineCreate, EngineRowActions, type Options } from "@/components/engine-form";
import { requireAdmin } from "@/lib/admin";
import { formatTime } from "@/lib/data";
import { engineConfigured } from "@/lib/engine/db";
import { loadRefs, loadRows, pick, type Lookup } from "@/lib/engine/load";
import { getResource, opsLabel, type Column, type RefName } from "@/lib/engine/resources";
import { EngineNotConfigured } from "../not-configured";

export async function generateMetadata({ params }: PageProps<"/engine/[slug]">) {
  const resource = getResource((await params).slug);
  return { title: `${resource?.title ?? "Humor engine"} | Three Takes Admin` };
}

function Cell({ column, row, refs }: { column: Column; row: Record<string, unknown>; refs: Lookup }) {
  const value = pick(row, column.key);
  if (value === null || value === undefined || value === "") return <span className="text-[var(--muted)]">—</span>;

  let content: React.ReactNode;
  if (column.ref) content = refs[column.ref]?.get(String(value)) ?? `#${value}`;
  else if (column.kind === "image") {
    // Images live on other hosts (the engine's CDN); shown as plain <img>.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={String(value)} alt="" loading="lazy" className="h-14 w-14 rounded-lg bg-black object-cover" />;
  } else if (column.kind === "bool") content = value ? "Yes" : "No";
  else if (column.kind === "datetime") content = <span className="whitespace-nowrap">{formatTime(String(value))}</span>;
  else if (column.kind === "long") {
    const text = String(value);
    if (text.length <= 140) content = <span className="whitespace-pre-wrap">{text}</span>;
    else
      content = (
        <details className="group">
          <summary className="cursor-pointer list-none">
            <span className="whitespace-pre-wrap">{text.slice(0, 140)}…</span>{" "}
            <span className="text-xs text-[var(--muted)] underline group-open:hidden">more</span>
          </summary>
          <p className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap text-[var(--muted)]">{text.slice(140)}</p>
        </details>
      );
  } else if (column.kind === "mono") content = <span className="font-mono text-xs">{String(value)}</span>;
  else content = String(value);

  if (column.href) {
    return (
      <Link href={column.href.replace("{value}", encodeURIComponent(String(value)))} className="underline-offset-4 hover:underline">
        {content}
      </Link>
    );
  }
  return <>{content}</>;
}

/** One generic page for every Humor engine table, driven by lib/engine/resources.ts. */
export default async function EngineTablePage({ params, searchParams }: PageProps<"/engine/[slug]">) {
  await requireAdmin();
  const resource = getResource((await params).slug);
  if (!resource) notFound();
  if (!engineConfigured()) return <EngineNotConfigured />;

  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");
  const q = str(sp.q);
  const page = Math.max(1, Number(str(sp.page)) || 1);
  const filters = Object.fromEntries((resource.filters ?? []).map((f) => [f.param, str(sp[f.param])]));
  const activeFilters = (resource.filters ?? []).filter((f) => filters[f.param]);

  const refNames = [
    ...resource.columns.flatMap((c) => (c.ref ? [c.ref] : [])),
    ...(resource.fields ?? []).flatMap((f) => (f.ref ? [f.ref] : [])),
  ] as RefName[];
  const [refs, { rows, total, error }] = await Promise.all([loadRefs(refNames), loadRows(resource, { page, q, filters })]);
  const options: Options = Object.fromEntries(
    Object.entries(refs).map(([name, map]) => [name, [...map].map(([value, label]) => ({ value, label }))]),
  );

  const canCreate = resource.ops.includes("create");
  const canUpdate = resource.ops.includes("update");
  const canDelete = resource.ops.includes("delete");
  const hasActions = canUpdate || canDelete || (resource.rowLinks?.length ?? 0) > 0;
  const pages = Math.max(1, Math.ceil(total / resource.pageSize));
  const href = (n: number) =>
    `/engine/${resource.slug}?${new URLSearchParams({ ...(q ? { q } : {}), ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), page: String(n) })}`;
  const singular = resource.title.replace(/s$/, "");

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <Link href="/engine" className="hover:text-white">Humor engine</Link> · {opsLabel(resource)}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{resource.title}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{resource.blurb}</p>
          <p className="mt-1 text-xs tabular-nums text-[var(--muted)]">{total.toLocaleString("en-US")} rows</p>
        </div>
        {resource.search && (
          <form className="flex gap-2">
            {Object.entries(filters).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
            <input
              name="q"
              defaultValue={q}
              placeholder="Search"
              className="w-56 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm placeholder:text-[var(--muted)] focus:border-white/40 focus:outline-none"
            />
            <button className="cursor-pointer rounded-lg border border-white/15 px-3 py-2 text-sm hover:border-white/40">Search</button>
          </form>
        )}
      </header>

      {canCreate && resource.fields && <EngineCreate slug={resource.slug} title={singular} fields={resource.fields} options={options} />}

      {(activeFilters.length > 0 || q) && (
        <p className="text-sm text-[var(--muted)]">
          {activeFilters.map((f) => `${f.label} ${filters[f.param]}`).join(" · ")}
          {q && `${activeFilters.length ? " · " : ""}matching “${q}”`} ·{" "}
          <Link href={`/engine/${resource.slug}`} className="text-white hover:underline">Show all</Link>
        </p>
      )}
      {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">Could not load: {error}</p>}

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[var(--surface)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 text-xs text-[var(--muted)]">
            <tr>
              {resource.columns.map((c) => (
                <th key={c.key} className={`px-4 py-3 font-medium ${c.kind === "number" ? "text-right" : ""}`}>{c.label}</th>
              ))}
              {hasActions && <th className="px-4 py-3 font-medium"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const id = String(row.id);
              const values = Object.fromEntries((resource.fields ?? []).map((f) => [f.key, (row[f.key] ?? null) as string | number | boolean | null]));
              return (
                <tr key={id} className="border-b border-white/5 align-top last:border-0 hover:bg-white/[0.03]">
                  {resource.columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3 ${c.kind === "long" ? "min-w-64 max-w-md" : ""} ${c.kind === "number" ? "text-right tabular-nums" : ""}`}>
                      <Cell column={c} row={row} refs={refs} />
                    </td>
                  ))}
                  {hasActions && (
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1.5">
                        {(canUpdate || canDelete) && (
                          <EngineRowActions slug={resource.slug} id={id} fields={resource.fields ?? []} values={values} options={options} canUpdate={canUpdate} canDelete={canDelete} />
                        )}
                        {resource.rowLinks?.map((l) => (
                          <Link key={l.label} href={l.href.replace("{id}", encodeURIComponent(id))} className="whitespace-nowrap text-xs text-[var(--muted)] hover:text-white">
                            {l.label} →
                          </Link>
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={resource.columns.length + 1} className="px-4 py-10 text-center text-[var(--muted)]">Nothing here yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-center gap-3 text-sm">
          {page > 1 && <Link href={href(page - 1)} className="rounded-full border border-white/15 px-3 py-1.5 hover:border-white/40">← Previous</Link>}
          <span className="tabular-nums text-[var(--muted)]">Page {page} of {pages.toLocaleString("en-US")}</span>
          {page < pages && <Link href={href(page + 1)} className="rounded-full border border-white/15 px-3 py-1.5 hover:border-white/40">Next →</Link>}
        </nav>
      )}
    </div>
  );
}
