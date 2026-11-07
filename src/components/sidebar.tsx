"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  BookOpen,
  FolderTree,
  GraduationCap,
  LayoutDashboard,
  Library,
  Menu,
  Plus,
  Search,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/library", label: "Mijn bibliotheek", icon: Library },
  { href: "/subjects", label: "Vakken", icon: FolderTree },
  { href: "/study", label: "Studeren", icon: GraduationCap },
  { href: "/create", label: "Maken", icon: Plus },
  { href: "/stats", label: "Statistieken", icon: BarChart3 },
  { href: "/settings", label: "Instellingen", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  // "/" focuses search (when not typing somewhere else)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const content = (
    <div className="flex h-full flex-col gap-4 p-4">
      <Link href="/" className="flex items-center gap-2 px-2 py-1">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white">
          <BookOpen size={17} />
        </span>
        <span className="font-semibold tracking-tight">Studieplatform</span>
      </Link>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
        }}
        className="relative"
      >
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          ref={searchRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Zoeken…"
          aria-label="Zoeken"
          className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-9 pr-8 text-sm placeholder:text-zinc-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 dark:border-zinc-800 dark:bg-zinc-950"
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-zinc-200 px-1 font-mono text-[10px] text-zinc-400 dark:border-zinc-700">
          /
        </span>
      </form>

      <Link
        href="/create"
        className="flex h-9 items-center justify-center gap-2 rounded-lg bg-accent text-sm font-medium text-white shadow-sm hover:bg-accent-hover"
      >
        <Plus size={16} /> Snel aanmaken
      </Link>

      <nav className="flex flex-col gap-0.5">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              isActive(href)
                ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-white"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100",
            )}
          >
            <Icon size={17} />
            {label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto flex items-center justify-between px-2 text-xs text-zinc-400">
        <span>Lokaal opgeslagen</span>
        <ThemeToggle />
      </div>
    </div>
  );

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur md:hidden dark:border-zinc-800 dark:bg-zinc-950/80">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-white">
            <BookOpen size={15} />
          </span>
          Studieplatform
        </Link>
        <button onClick={() => setOpen(true)} aria-label="Menu openen" className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800">
          <Menu size={20} />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <button onClick={() => setOpen(false)} aria-label="Menu sluiten" className="absolute right-3 top-4 rounded-lg p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <X size={18} />
            </button>
            {content}
          </aside>
        </div>
      )}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-zinc-200 bg-white md:block dark:border-zinc-800 dark:bg-zinc-900">
        {content}
      </aside>
    </>
  );
}
