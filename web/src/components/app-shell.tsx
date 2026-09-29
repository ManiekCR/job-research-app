"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { signOut } from "@/app/auth-actions";
import { Icon, type IconName } from "./icons";
import { ThemeToggle } from "./theme-toggle";

const LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/jobs", label: "Jobs", icon: "jobs" },
  { href: "/applications", label: "Applications", icon: "applications" },
  { href: "/profile", label: "Profile", icon: "profile" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

// The phone tab bar has room for four; Settings hangs off the avatar in the top bar.
const TAB_LINKS = LINKS.filter((link) => link.href !== "/settings");

// "/jobs/123" still highlights "Jobs"; "/" only matches exactly.
function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="font-heading flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-[11px] font-bold tracking-normal text-on-accent">
        HQ
      </div>
      <span className="font-heading text-[15px] font-semibold">Job Search HQ</span>
    </div>
  );
}

export function AppShell({ email, children }: { email: string | null; children: ReactNode }) {
  const pathname = usePathname();

  // Nobody is signed in on the login page, so there is no navigation to show.
  if (pathname === "/login") return <>{children}</>;

  const initial = (email?.[0] ?? "?").toUpperCase();
  const current = LINKS.find((link) => isActive(pathname, link.href));

  return (
    <div className="flex min-h-screen">
      {/* Desktop: fixed sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-7 border-r border-line bg-surface px-3 pb-4 pt-5 md:flex">
        <div className="px-2.5">
          <Brand />
        </div>
        <nav aria-label="Main" className="flex flex-col gap-0.5">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="nav-item"
              aria-current={link === current ? "page" : undefined}
            >
              <Icon name={link.icon} />
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-2.5 border-t border-line px-1 pt-3">
          <div className="font-heading flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-surface-3 text-[11px] font-semibold tracking-normal text-text-2">
            {initial}
          </div>
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold" title={email ?? undefined}>
            {email ?? "Signed in"}
          </span>
          <ThemeToggle />
          <form action={signOut}>
            <button type="submit" aria-label="Log out" title="Log out" className="btn btn-ghost btn-sm btn-icon">
              <Icon name="logout" />
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phone: top bar */}
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2.5 border-b border-line bg-surface pl-4 pr-1.5 md:hidden">
          <Brand />
          <div className="ml-auto flex items-center">
            <ThemeToggle />
            <Link href="/settings" aria-label="Settings and account" className="btn btn-ghost btn-icon">
              <span className="font-heading flex h-8 w-8 items-center justify-center rounded-full bg-surface-3 text-xs font-semibold tracking-normal text-text-2">
                {initial}
              </span>
            </Link>
          </div>
        </header>

        <div className="min-w-0 flex-1 pb-24 md:pb-0">{children}</div>

        {/* Phone: bottom tab bar */}
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-surface px-2 pb-[max(env(safe-area-inset-bottom),12px)] pt-1.5 md:hidden"
        >
          {TAB_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="tab-item"
              aria-current={link === current ? "page" : undefined}
            >
              <Icon name={link.icon} size={22} />
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
