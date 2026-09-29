"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/auth-actions";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/jobs", label: "Jobs" },
  { href: "/applications", label: "Applications" },
  { href: "/profile", label: "Profile" },
  { href: "/settings", label: "Settings" },
];

export function NavBar() {
  const pathname = usePathname();

  // Nobody is signed in on the login page, so there is nothing to navigate to.
  if (pathname === "/login") return null;

  return (
    <nav className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-6 py-3 text-sm">
        <span className="mr-2 font-semibold">Job Search HQ</span>
        {/* ml-auto pushes this whole group (links + Log out) to the right. */}
        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1">
          {/* The page you are on is not offered as a link. Exact match, so on
              /jobs/123 the "Jobs" link stays visible as a way back to the list. */}
          {LINKS.filter((link) => link.href !== pathname).map((link) => (
            <Link key={link.href} href={link.href} className="hover:underline">
              {link.label}
            </Link>
          ))}
          <form action={signOut}>
            <button type="submit" className="underline">
              Log out
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}
