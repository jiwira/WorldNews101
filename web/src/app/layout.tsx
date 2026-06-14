import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "World & Finance 101",
  description: "The world's news, clustered and explained through an economic lens.",
};

const NAV = [
  { href: "/", label: "Today" },
  { href: "/week", label: "This Week" },
  { href: "/archive", label: "Archive" },
  { href: "/ask", label: "Ask" },
  { href: "/sources", label: "Sources" },
  { href: "/how-it-works", label: "How it works" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper text-ink antialiased">
        {/* ── Utility strip ── */}
        <div className="bg-ink text-paper">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-1.5">
            <span className="kicker text-paper/70">AI-powered economic briefing</span>
            <span className="kicker hidden text-paper/70 sm:inline">
              Indonesia edition · Local AI
            </span>
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
            <p className="kicker mt-2.5">
              The world&apos;s news — clustered &amp; explained through an economic lens
            </p>
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
                {item.label}
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
                Bias ratings and the &quot;neutral&quot; view are{" "}
                <strong className="text-ink">AI assessments, not fact</strong>. Analysis is
                for education — <strong className="text-ink">not financial advice</strong>.
              </span>
              <span className="kicker">Local AI · RTX 5070 Ti · No paid APIs</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
