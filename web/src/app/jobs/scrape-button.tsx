"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icons";
import { triggerScrape } from "./actions";

type Status = "idle" | "starting" | "waiting" | "running" | "done" | "error" | "timeout";

// A full run takes ~5 min (about 30 s of pip install, then every source; Xing alone waits
// 3 s between up to 35 requests). Measured 4m45s on GitHub Actions, so leave headroom.
const TIMEOUT_MS = 360_000;

export function ScrapeButton() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const activeRunId = useRef<string | null>(null);
  const router = useRouter();

  async function handleClick() {
    setStatus("starting");
    setMessage(null);
    activeRunId.current = null;

    const supabase = createClient();

    // The Realtime websocket needs the session token given to it explicitly:
    // without it, it can connect "anonymously", and RLS then silently
    // blocks all events (no error, just nothing).
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      supabase.realtime.setAuth(session.access_token);
    }

    const channel = supabase.channel("scrape-runs-live");

    const timeoutId = setTimeout(() => {
      setStatus("timeout");
      setMessage(`No update in ${TIMEOUT_MS / 60_000} min — check the Actions tab on GitHub.`);
      supabase.removeChannel(channel);
    }, TIMEOUT_MS);

    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scrape_runs" },
        (payload) => {
          if (payload.eventType === "INSERT" && activeRunId.current === null) {
            activeRunId.current = payload.new.id as string;
            setStatus("running");
          }

          if (payload.eventType === "UPDATE" && payload.new.id === activeRunId.current) {
            const row = payload.new as {
              status: "running" | "done" | "error";
              jobs_found: number;
              jobs_new: number;
            };

            if (row.status === "done") {
              clearTimeout(timeoutId);
              setStatus("done");
              setMessage(`${row.jobs_new} new job(s) out of ${row.jobs_found} kept.`);
              supabase.removeChannel(channel);
              router.refresh();
            } else if (row.status === "error") {
              clearTimeout(timeoutId);
              setStatus("error");
              setMessage("Scraping failed on the worker side (check the GitHub Actions logs).");
              supabase.removeChannel(channel);
            }
          }
        }
      )
      .subscribe(async (subscribeStatus) => {
        if (subscribeStatus !== "SUBSCRIBED") return;

        // Only trigger the scrape ONCE the listener is confirmed active —
        // otherwise we could miss the event if the worker runs faster than
        // the WebSocket connection is established.
        setStatus("waiting");
        const result = await triggerScrape();

        if (!result.ok) {
          clearTimeout(timeoutId);
          setStatus("error");
          setMessage(result.error);
          supabase.removeChannel(channel);
        }
      });
  }

  const isBusy = status === "starting" || status === "waiting" || status === "running";

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isBusy}
        className="btn btn-secondary"
      >
        <Icon name="refresh" className={isBusy ? "animate-spin" : ""} />
        {isBusy ? "Scraping…" : "Run scrape"}
      </button>
      {message && (
        <p
          role="status"
          className={`alert ${status === "error" || status === "timeout" ? "alert-bad" : "alert-good"}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
