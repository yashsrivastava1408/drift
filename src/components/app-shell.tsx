"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, ListOrdered, Upload, Tags, LogOut, LineChart } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { DataProvider, useData } from "./data-provider";
import { IdleLock } from "./idle-lock";

const LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ListOrdered },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/categories", label: "Categories", icon: Tags },
];

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { error, loading } = useData();

  async function signOut() {
    await getSupabase().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="min-h-dvh md:flex">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface p-4 md:flex">
        <div className="mb-8 flex items-center gap-2.5 px-2 pt-2">
          <span className="grid size-9 place-items-center rounded-xl bg-accent text-accent-ink">
            <LineChart size={18} aria-hidden />
          </span>
          <span className="font-semibold">Expenses</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
          {LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={active(href) ? "page" : undefined}
              className={`flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${
                active(href) ? "bg-accent/10 text-accent" : "text-muted hover:bg-bg hover:text-ink"
              }`}
            >
              <Icon size={18} aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        <button onClick={signOut} className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted hover:bg-bg hover:text-ink">
          <LogOut size={18} aria-hidden />
          Sign out
        </button>
      </aside>

      <main className="min-w-0 flex-1 px-4 pb-28 pt-6 md:px-10 md:pb-12 md:pt-10">
        <div className="mx-auto max-w-5xl">
          {error && (
            <div role="alert" className="card mb-6 border-bad/40 p-4 text-sm text-bad">
              {error}
            </div>
          )}
          {loading ? <div className="py-24 text-center text-sm text-muted">Loading...</div> : children}
        </div>
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={active(href) ? "page" : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium ${
              active(href) ? "text-accent" : "text-muted"
            }`}
          >
            <Icon size={20} aria-hidden />
            {label}
          </Link>
        ))}
        <button onClick={signOut} className="flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted">
          <LogOut size={20} aria-hidden />
          Sign out
        </button>
      </nav>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <DataProvider>
      <IdleLock />
      <Shell>{children}</Shell>
    </DataProvider>
  );
}
