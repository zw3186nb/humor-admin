"use client";

import { useState, useTransition } from "react";
import { setAdmin } from "@/app/actions";

/** Role cell on the Users page: shows the role and lets an admin change it. */
export function AdminToggle({
  userId,
  name,
  isAdmin,
  isSelf,
}: {
  userId: string;
  name: string;
  isAdmin: boolean;
  isSelf: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const badge = isAdmin ? (
    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-black">Admin</span>
  ) : (
    <span className="text-xs text-[var(--muted)]">Member</span>
  );

  if (isSelf) {
    return (
      <span className="flex items-center gap-2">
        {badge}
        <span className="text-[11px] text-[var(--muted)]">(you)</span>
      </span>
    );
  }

  function change() {
    setMessage(null);
    startTransition(async () => {
      const result = await setAdmin(userId, !isAdmin);
      setConfirming(false);
      if (result && !result.ok) setMessage(result.message);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {badge}
      {confirming ? (
        <span className="flex items-center gap-1.5 text-xs">
          <span className="text-[var(--muted)]">{isAdmin ? `Remove ${name} as admin?` : `Make ${name} an admin?`}</span>
          <button
            type="button"
            onClick={change}
            disabled={pending}
            className="cursor-pointer rounded-md bg-white px-2 py-0.5 font-semibold text-black disabled:opacity-60"
          >
            {pending ? "Saving…" : "Yes"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="cursor-pointer rounded-md px-2 py-0.5 text-[var(--muted)] hover:text-white"
          >
            Cancel
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="cursor-pointer rounded-md border border-white/15 px-2 py-0.5 text-xs text-[var(--muted)] hover:border-white/40 hover:text-white"
        >
          {isAdmin ? "Remove admin" : "Make admin"}
        </button>
      )}
      {message && (
        <span role="alert" className="w-full text-xs text-red-300">
          {message}
        </span>
      )}
    </div>
  );
}
