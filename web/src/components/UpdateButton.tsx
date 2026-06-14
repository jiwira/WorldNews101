"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/lib/ui";
import type { Lang } from "@/lib/lang";

type State = "idle" | "running" | "note";

export function UpdateButton({ lang }: { lang: Lang }) {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [note, setNote] = useState("");

  // On mount, reflect any run already in progress (e.g. triggered elsewhere).
  useEffect(() => {
    fetch("/api/refresh")
      .then((r) => r.json())
      .then((d) => { if (d.running) setState("running"); })
      .catch(() => {});
  }, []);

  // While running, poll status and refresh the page as new stories land.
  useEffect(() => {
    if (state !== "running") return;
    const id = setInterval(async () => {
      try {
        const d = await (await fetch("/api/refresh")).json();
        router.refresh();
        if (!d.running) { setState("idle"); clearInterval(id); }
      } catch { /* keep polling */ }
    }, 20000);
    return () => clearInterval(id);
  }, [state, router]);

  async function trigger() {
    if (state === "running") return;
    setState("note");
    setNote("");
    try {
      const d = await (await fetch("/api/refresh", { method: "POST" })).json();
      if (d.status === "started" || d.status === "running") {
        setNote(t(lang, d.status === "running" ? "update_inprogress" : "update_started"));
        setState("running");
        setTimeout(() => router.refresh(), 5000);
      } else {
        setNote(t(lang, "update_offline"));
        setState("idle");
      }
    } catch {
      setNote(t(lang, "update_offline"));
      setState("idle");
    }
  }

  return (
    <div className="flex items-center gap-2">
      {note && <span className="kicker hidden text-paper/60 md:inline">{note}</span>}
      <button
        onClick={trigger}
        disabled={state === "running"}
        className="kicker inline-flex items-center gap-1.5 text-paper/70 transition-colors hover:text-gold disabled:opacity-60"
      >
        <span aria-hidden className={state === "running" ? "inline-block animate-spin" : ""}>↻</span>
        {state === "running" ? t(lang, "update_running") : t(lang, "update_news")}
      </button>
    </div>
  );
}
