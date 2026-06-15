"use client";
import { useEffect, useState } from "react";
import { Markdown } from "@/components/Markdown";
import { t } from "@/lib/ui";
import { normalizeLang, type Lang } from "@/lib/lang";

function cookieLang(): Lang {
  if (typeof document === "undefined") return "en";
  const m = document.cookie.match(/(?:^|;\s*)lang=([^;]+)/);
  return normalizeLang(m?.[1]);
}

export default function AskPage() {
  const [lang, setLang] = useState<Lang>("en");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => setLang(cookieLang()), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr(""); setAnswer("");
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, lang }),
      });
      const data = await res.json();
      if (!res.ok) setErr(data.error ?? t(lang, "ask_error"));
      else setAnswer(data.answer || t(lang, "ask_error"));
    } catch {
      setErr(t(lang, "ask_error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <span className="kicker text-brand">{t(lang, "ask_kicker")}</span>
        <h1 className="font-display text-3xl font-bold text-ink">{t(lang, "ask_title")}</h1>
        <p className="max-w-prose text-sm text-ink-soft">{t(lang, "ask_intro")}</p>
      </header>

      <form onSubmit={submit} className="space-y-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={500}
          placeholder={t(lang, "ask_placeholder")}
          className="w-full rounded-lg border border-hair bg-surface px-4 py-3 text-ink outline-none focus:border-brand"
        />
        <button
          type="submit"
          disabled={loading || !q.trim()}
          className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-paper transition-opacity disabled:opacity-50"
        >
          {loading ? t(lang, "ask_thinking") : t(lang, "ask_button")}
        </button>
      </form>

      {err && <p className="text-bear">{err}</p>}
      {answer && (
        <div className="rounded-xl border border-hair bg-surface p-6 shadow-sm border-l-4 border-l-gold">
          <Markdown>{answer}</Markdown>
        </div>
      )}

      <p className="text-[11px] text-ink-faint">
        AI assessment for education — not financial advice. Answers are generated live and not stored.
      </p>
    </div>
  );
}
