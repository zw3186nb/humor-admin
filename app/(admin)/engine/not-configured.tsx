export function EngineNotConfigured() {
  return (
    <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-5 text-sm text-amber-100">
      <p className="font-semibold">The humor engine database isn&apos;t connected yet.</p>
      <p className="mt-1 text-amber-100/80">
        Set <code className="font-mono">FUNNYSTUDY_SUPABASE_URL</code> and <code className="font-mono">FUNNYSTUDY_SECRET_KEY</code> in the
        app&apos;s environment variables, then redeploy.
      </p>
    </div>
  );
}
