"use client";

import { Icon } from "./icons";

// No React state on purpose: the theme lives in the data-theme attribute on
// <html>, and the icon is picked by CSS (theme-icon-* classes). That way the server
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

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle light / dark mode"
      title="Toggle light / dark mode"
      className="btn btn-ghost btn-sm btn-icon"
    >
      {/* Shows the mode you would switch TO: moon in light mode, sun in dark mode. */}
      <Icon name="moon" className="theme-icon-light" />
      <Icon name="sun" className="theme-icon-dark" />
    </button>
  );
}
