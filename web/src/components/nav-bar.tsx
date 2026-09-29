"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/auth-actions";
import { ThemeToggle } from "./theme-toggle";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/jobs", label: "Jobs" },
  { href: "/applications", label: "Applications" },
  { href: "/profile", label: "Profile" },
  { href: "/settings", label: "Settings" },
];

// Shared look of every item in the bar (same 32px height as the theme toggle).
const ITEM =
  "inline-flex h-8 cursor-pointer items-center rounded-md px-3 text-zinc-600 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 active:scale-95 dark:text-zinc-400";
const ITEM_HOVER =
  "hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";
// Log out gets a red hover so it does not look like just another page link.
const LOGOUT_HOVER =
  "hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950 dark:hover:text-red-300";

export function NavBar() {
  const pathname = usePathname();

  // Nobody is signed in on the login page, so there is nothing to navigate to.
  if (pathname === "/login") return null;

  return (
    <nav className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-1 px-6 py-2 text-sm">
        <span className="mr-2 font-semibold">Job Search HQ</span>
        {/* ml-auto pushes this whole group (links + controls) to the right. */}
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {/* The page you are on is not offered as a link. Exact match, so on
              /jobs/123 the "Jobs" link stays visible as a way back to the list. */}
          {LINKS.filter((link) => link.href !== pathname).map((link) => (
            <Link key={link.href} href={link.href} className={`${ITEM} ${ITEM_HOVER}`}>
              {link.label}
            </Link>
          ))}
          {/* Thin divider between the page links and the controls */}
          <span aria-hidden="true" className="mx-2 h-5 w-px bg-zinc-200 dark:bg-zinc-800" />
          <ThemeToggle />
          <form action={signOut}>
            <button type="submit" className={`${ITEM} ${LOGOUT_HOVER}`}>
              Log out
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}
