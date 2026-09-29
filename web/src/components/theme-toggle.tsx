"use client";

// No React state on purpose: the theme lives in the data-theme attribute on
// <html>, and the icon is picked by CSS (dark: variants). That way the server
// HTML and the browser always agree, whatever theme the visitor has.
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Storage can be blocked (private window): the toggle still works for this visit.
    }
  }

  // Both icons share these attributes: outline icons, drawn with the text colour.
  const iconProps = {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    // The icon tilts a little when you hover the button (group-hover).
    className: "h-4 w-4 transition-transform duration-300 group-hover:rotate-12",
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle light / dark mode"
      title="Toggle light / dark mode"
      className="group inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-zinc-200 text-zinc-600 transition-colors duration-200 hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 active:scale-95 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      {/* Shows the mode you would switch TO: moon in light mode, sun in dark mode. */}
      <svg {...iconProps} className={`${iconProps.className} dark:hidden`}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
      <svg {...iconProps} className={`${iconProps.className} hidden dark:block`}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    </button>
  );
}
