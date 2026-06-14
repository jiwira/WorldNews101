import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getLang } from "@/lib/lang.server";
import { t } from "@/lib/ui";
import { LanguageToggle } from "@/components/LanguageToggle";
import { UpdateButton } from "@/components/UpdateButton";

export const metadata: Metadata = {
  title: "World & Finance 101",
  description: "The world's news, clustered and explained through an economic lens.",
};

const NAV = [
  { href: "/", key: "nav_today" },
  { href: "/week", key: "nav_week" },
  { href: "/archive", key: "nav_archive" },
  { href: "/ask", key: "nav_ask" },
  { href: "/sources", key: "nav_sources" },
  { href: "/how-it-works", key: "nav_how" },
] as const;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang}>
      <body className="min-h-screen bg-paper text-ink antialiased">
        {/* ── Utility strip ── */}
        <div className="bg-ink text-paper">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-1.5">
            <span className="kicker text-paper/70">{t(lang, "tagline_top")}</span>
            <div className="flex items-center gap-4">
              <UpdateButton lang={lang} />
              <span className="text-paper/30" aria-hidden>·</span>
              <LanguageToggle current={lang} />
            </div>
          </div>
        </div>

        {/* ── Masthead ── */}
        <div className="border-b-2 border-ink bg-paper">
          <div className="mx-auto max-w-5xl px-5 pt-7 pb-4 text-center">
            <Link href="/" className="inline-block">
              <span className="font-display text-4xl font-bold tracking-tight text-ink sm:text-6xl">
                World <span className="text-brand">&amp;</span> Finance{" "}
                <span className="text-gold">101</span>
              </span>
            </Link>
            <p className="kicker mt-2.5">{t(lang, "masthead_sub")}</p>
          </div>
        </div>

        {/* ── Section nav ── */}
        <nav className="sticky top-0 z-20 border-b border-hair bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-center gap-5 px-5 py-2.5 sm:gap-8">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="kicker text-ink-soft transition-colors hover:text-brand"
              >
                {t(lang, item.key)}
              </Link>
            ))}
          </div>
        </nav>

        {/* ── Main ── */}
        <main className="mx-auto max-w-3xl px-5 py-10 sm:py-14">{children}</main>

        {/* ── Footer ── */}
        <footer className="border-t-2 border-ink bg-surface">
          <div className="mx-auto max-w-5xl px-5 py-8">
            <div className="flex flex-col gap-3 text-xs text-ink-soft sm:flex-row sm:items-center sm:justify-between">
              <span className="max-w-xl">
                {t(lang, "footer_disclaimer_a")}{" "}
                <strong className="text-ink">{t(lang, "footer_ai")}</strong>. {t(lang, "footer_edu")} —{" "}
                <strong className="text-ink">{t(lang, "footer_notadvice")}</strong>.
              </span>
              <span className="kicker">Local AI · RTX 5070 Ti · No paid APIs</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
