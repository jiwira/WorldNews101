import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "World & Finance 101",
  description: "The world's news, clustered and explained through an economic lens.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {/* ── Header ── */}
        <header className="border-b border-slate-200 bg-white shadow-sm">
          <nav className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
            <Link href="/" className="flex items-baseline gap-2">
              <span
                className="text-xl font-bold tracking-tight text-slate-900"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                World&nbsp;&amp;&nbsp;Finance&nbsp;101
              </span>
              <span className="hidden text-xs font-medium uppercase tracking-widest text-slate-400 sm:inline">
                AI-powered economic briefing
              </span>
            </Link>
            <div className="flex items-center gap-5 text-sm font-medium text-slate-600">
              <Link href="/sources" className="hover:text-slate-900">Sources</Link>
              <Link href="/ask" className="hover:text-slate-900">Ask</Link>
              <Link href="/archive" className="hover:text-slate-900">Archive</Link>
              <Link href="/how-it-works" className="hover:text-slate-900">How it works</Link>
            </div>
          </nav>
        </header>

        {/* ── Main content ── */}
        <main className="mx-auto max-w-4xl px-5 py-10">{children}</main>

        {/* ── Footer ── */}
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-4xl px-5 py-8 text-xs text-slate-500">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Bias ratings and the &quot;neutral&quot; view are{" "}
                <strong className="text-slate-700">AI assessments, not fact</strong>.
                Analysis for education —{" "}
                <strong className="text-slate-700">not financial advice</strong>.
              </span>
              <span className="text-slate-400">
                Powered by local AI · RTX 5070 Ti · No paid APIs
              </span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
