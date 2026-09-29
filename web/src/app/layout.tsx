import type { Metadata } from "next";
import { Geist_Mono, Instrument_Sans, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";

// Body text, headings and numbers: the three faces from the design board.
const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

const schibstedGrotesk = Schibsted_Grotesk({
  variable: "--font-schibsted-grotesk",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Job Search HQ",
  description: "Personal job search dashboard",
};

// Runs before the first paint so the page never flashes the wrong theme:
// saved choice first, otherwise the OS setting.
const THEME_SCRIPT = `(function(){var t;try{t=localStorage.getItem("theme")}catch(e){}if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t})()`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Only used to label the account in the sidebar; null on the login page.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    // suppressHydrationWarning: the script above adds data-theme to <html> before
    // React loads, and React would otherwise warn that the server HTML differs.
    <html
      lang="en"
      className={`${instrumentSans.variable} ${schibstedGrotesk.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <AppShell email={user?.email ?? null}>{children}</AppShell>
      </body>
    </html>
  );
}
