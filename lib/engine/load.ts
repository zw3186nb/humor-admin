import { engineDb } from "@/lib/engine/db";
import { REFS, type RefName, type Resource } from "@/lib/engine/resources";

export type Lookup = Record<string, Map<string, string>>;

/** Small lookup tables (providers, models, flavors...) as id -> label maps. */
export async function loadRefs(names: RefName[]): Promise<Lookup> {
  const unique = [...new Set(names)];
  const db = engineDb();
  const entries = await Promise.all(
    unique.map(async (name) => {
      const { table, label } = REFS[name];
      const { data } = await db.from(table).select(`id, ${label}`).order(label, { ascending: true }).limit(1000);
      const map = new Map<string, string>();
      for (const row of (data ?? []) as unknown as Record<string, unknown>[]) map.set(String(row.id), String(row[label] ?? row.id));
      return [name, map] as const;
    }),
  );
  return Object.fromEntries(entries);
}

export async function loadRows(
  resource: Resource,
  opts: { page: number; q: string; filters: Record<string, string> },
): Promise<{ rows: Record<string, unknown>[]; total: number; error: string | null }> {
  let query = engineDb().from(resource.table).select(resource.select, { count: "exact" });
  if (opts.q && resource.search) query = query.ilike(resource.search, `%${opts.q.replace(/[%_]/g, "\\$&")}%`);
  for (const f of resource.filters ?? []) {
    const value = opts.filters[f.param];
    if (value) query = query.eq(f.column, value);
  }
  for (const o of resource.order) query = query.order(o.column, { ascending: o.ascending ?? true });
  const from = (opts.page - 1) * resource.pageSize;
  const { data, count, error } = await query.range(from, from + resource.pageSize - 1);
  return { rows: (data ?? []) as unknown as Record<string, unknown>[], total: count ?? 0, error: error?.message ?? null };
}

/** Reads "a.b.c" out of a row with embedded relations (which may be arrays). */
export function pick(row: unknown, path: string): unknown {
  let value: unknown = row;
  for (const part of path.split(".")) {
    if (Array.isArray(value)) value = value[0];
    if (value == null || typeof value !== "object") return null;
    value = (value as Record<string, unknown>)[part];
  }
  return Array.isArray(value) ? value[0] : value;
}
