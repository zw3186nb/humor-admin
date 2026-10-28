import { signOut } from "@/app/actions";
import { AdminNav } from "@/components/admin-nav";
import { personName, requireAdmin } from "@/lib/admin";

/**
 * Every page in this folder sits behind this gate:
 * not signed in -> /login, signed in but not is_superadmin -> /denied.
 */
export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const { profile } = await requireAdmin();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:gap-10 lg:py-10">
      <aside className="flex shrink-0 flex-col gap-5 lg:sticky lg:top-10 lg:h-[calc(100vh-5rem)] lg:w-56 lg:overflow-y-auto">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-lg bg-white font-mono text-sm font-bold text-black">
            3
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">Three Takes</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Admin</p>
          </div>
        </div>
        <AdminNav />
        <div className="border-t border-white/10 pt-4 lg:mt-auto">
          <p className="truncate text-sm">{personName(profile)}</p>
          <p className="truncate text-xs text-[var(--muted)]">{profile.email}</p>
          <form action={signOut} className="mt-3">
            <button type="submit" className="cursor-pointer text-xs text-[var(--muted)] underline-offset-4 hover:text-white hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
