"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = { href: string; label: string; hint?: string };

const GROUPS: { title: string; links: NavLink[] }[] = [
  {
    title: "Three Takes",
    links: [
      { href: "/", label: "Dashboard", hint: "Statistics" },
      { href: "/users", label: "Users", hint: "Read · change role" },
      { href: "/captions", label: "Memes & captions", hint: "Create · Read · Update · Delete" },
      { href: "/votes", label: "Votes", hint: "Read" },
    ],
  },
  {
    title: "Humor engine",
    links: [
      { href: "/engine", label: "Overview" },
      { href: "/engine/prompt-chains", label: "Prompt chains" },
      { href: "/engine/humor-flavors", label: "Humor flavors" },
      { href: "/engine/prompt-chain-steps", label: "Chain steps" },
      { href: "/engine/prompt-chain-mix", label: "Chain mix" },
      { href: "/engine/generation-requests", label: "Generation requests" },
      { href: "/engine/llm-responses", label: "LLM responses" },
      { href: "/engine/ai-media", label: "AI captions" },
      { href: "/engine/images", label: "Images" },
      { href: "/engine/terms", label: "Terms" },
      { href: "/engine/examples", label: "Generation examples" },
      { href: "/engine/llm-models", label: "LLM models" },
      { href: "/engine/llm-providers", label: "LLM providers" },
      { href: "/engine/signup-domains", label: "Sign-up domains" },
      { href: "/engine/whitelisted-emails", label: "Whitelisted e-mails" },
    ],
  },
];

export function AdminNav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" || href === "/engine" ? pathname === href : pathname.startsWith(href));

  return (
    <nav aria-label="Admin sections" className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-4 lg:overflow-visible">
      {GROUPS.map((group) => (
        <div key={group.title} className="flex gap-1 lg:flex-col">
          <p className="hidden px-3 pb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)] lg:block">{group.title}</p>
          {group.links.map(({ href, label, hint }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 rounded-lg px-3 transition ${hint ? "py-2" : "py-1"} ${
                  active ? "bg-white/10 text-white" : "text-[var(--muted)] hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className={`block font-medium ${hint ? "text-sm" : "text-[13px]"}`}>{label}</span>
                {hint && <span className="hidden text-[11px] text-[var(--muted)] lg:block">{hint}</span>}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
