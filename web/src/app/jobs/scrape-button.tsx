"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { triggerScrape } from "./actions";

type Status = "idle" | "starting" | "waiting" | "running" | "done" | "error" | "timeout";

const TIMEOUT_MS = 90_000;

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

    // Le websocket Realtime a besoin qu'on lui donne explicitement le jeton
    // de session : sans ça, il peut se connecter "anonyme", et RLS bloque
    // alors silencieusement tous les événements (aucune erreur, juste rien).
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      supabase.realtime.setAuth(session.access_token);
    }

    const channel = supabase.channel("scrape-runs-live");

    const timeoutId = setTimeout(() => {
      setStatus("timeout");
      setMessage("Pas de nouvelle depuis 90s — vérifie l'onglet Actions sur GitHub.");
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
              setMessage(`${row.jobs_new} nouvelle(s) offre(s) sur ${row.jobs_found} retenue(s).`);
              supabase.removeChannel(channel);
              router.refresh();
            } else if (row.status === "error") {
              clearTimeout(timeoutId);
              setStatus("error");
              setMessage("Le scraping a échoué côté worker (vérifie les logs GitHub Actions).");
              supabase.removeChannel(channel);
            }
          }
        }
      )
      .subscribe(async (subscribeStatus) => {
        if (subscribeStatus !== "SUBSCRIBED") return;

        // On ne déclenche le scraping qu'UNE FOIS l'écoute confirmée active —
        // sinon on risquerait de rater l'événement si le worker va plus vite
        // que l'établissement de la connexion WebSocket.
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
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleClick}
        disabled={isBusy}
        className="rounded bg-foreground px-3 py-2 text-sm text-background disabled:opacity-50"
      >
        {isBusy ? "Scraping en cours…" : "Scraper"}
      </button>
      {message && (
        <p
          className={
            status === "error" || status === "timeout"
              ? "text-sm text-red-700 dark:text-red-300"
              : "text-sm text-green-700 dark:text-green-300"
          }
        >
          {message}
        </p>
      )}
    </div>
  );
}