# WorldNews-101 — Plan 3: Website + Domain — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the public WorldNews-101 website (Next.js) — Home, Story, Ask, Archive, How-it-works — backed by a swappable data layer (seed data now, live Postgres later), and serve it at `worldnews.jiwira.com` via Cloudflare Tunnel.

**Architecture:** Next.js (App Router) + TypeScript + Tailwind, matching jiwira-portfolio. All page data flows through a single `DataSource` interface. A `SeedDataSource` provides realistic demo content now; a `DbDataSource` (Drizzle/Postgres) replaces it in a later plan with **zero page changes** (decision: data-layer indirection). Built/served on the RTX box at port 3001; Cloudflare Tunnel exposes only this site.

**Tech Stack:** Bun 1.3, Next.js + React + TypeScript, Tailwind CSS, `react-markdown` + `sanitize-html` (XSS-safe rendering, per 05-SECURITY), cloudflared.

**Scope note:** This plan reorders SPEC §11 (website before the data pipeline) to get a live URL early. The site is fully functional on seed data; the Ask page queues questions but returns a demo answer until the crew (Plan 2) and on-demand poller are wired. Flagged in each affected task.

---

## File Structure

```
WorldNews-101/web/
├── package.json, tsconfig.json, next.config.mjs, tailwind.config.ts, postcss.config.js
├── src/
│   ├── app/
│   │   ├── layout.tsx                # root layout, header/footer, disclaimer
│   │   ├── globals.css               # Tailwind + theme tokens
│   │   ├── page.tsx                  # Home (today's briefing)
│   │   ├── story/[id]/page.tsx       # Story detail
│   │   ├── ask/page.tsx              # Ask (client form)
│   │   ├── archive/page.tsx          # Past briefings
│   │   ├── how-it-works/page.tsx     # Showcase page
│   │   └── api/ask/route.ts          # POST a question (mock queue now)
│   ├── components/
│   │   ├── SentimentBadge.tsx
│   │   ├── BiasSpread.tsx            # signature visual
│   │   ├── LayerToggle.tsx           # beginner <-> pro
│   │   ├── StoryCard.tsx
│   │   └── Markdown.tsx              # sanitized react-markdown wrapper
│   └── lib/
│       ├── types.ts                  # Story, Briefing, Question (mirror docs/02)
│       ├── datasource.ts             # DataSource interface + getDataSource()
│       └── seed.ts                   # SeedDataSource demo content
└── (cloudflared config lives outside the repo — see Task 9)
```

**Convention:** all commands run from `WorldNews-101/web/` unless noted. Dev server on port 3001 (`bun run dev -- -p 3001`). Port 3000 is taken by another app.

---

## Task 1: Scaffold the Next.js app

**Files:** creates the `web/` app via the generator.

- [ ] **Step 1: Scaffold with bun** (run from `WorldNews-101/`)

```bash
cd /home/jiwira/Projects/WorldNews-101
bun create next-app web --ts --tailwind --app --src-dir --eslint --import-alias "@/*" --no-turbopack
```
Accept defaults for any remaining prompts.

- [ ] **Step 2: Verify the dev server runs on 3001**

```bash
cd web && bun run dev -- -p 3001 &
sleep 6 && curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3001/
kill %1
```
Expected: `HTTP 200`.

- [ ] **Step 3: Add runtime deps**

```bash
bun add react-markdown sanitize-html
bun add -d @types/sanitize-html
```

- [ ] **Step 4: Commit** (run from repo root)

```bash
cd /home/jiwira/Projects/WorldNews-101
git add web/ && git commit -m "13062026-Scaffold WorldNews website (Next.js)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Domain types + data-source indirection + seed data

**Files:** Create `web/src/lib/types.ts`, `web/src/lib/datasource.ts`, `web/src/lib/seed.ts`.

- [ ] **Step 1: Create `web/src/lib/types.ts`** (mirrors `docs/02-DATABASE.md`)

```typescript
export type Sentiment = "bullish" | "neutral" | "bearish";
export type Lean = "left" | "center" | "right";

export interface LeanSpread { left: number; center: number; right: number; }

export interface SourceRef {
  source: string;
  url: string;
  lean: Lean;
}

export interface Story {
  id: string;
  topic: string;
  sourceCount: number;
  leanSpread: LeanSpread;
  sources: SourceRef[];
  neutralMd: string;
  beginnerMd: string;
  proMd: string;
  sentiment: Sentiment;
}

export interface Briefing {
  id: string;
  date: string;        // ISO yyyy-mm-dd
  headline: string;
  overallSentiment: Sentiment;
  beginnerMd: string;
  proMd: string;
  storyIds: string[];
}

export type QuestionStatus = "pending" | "processing" | "done" | "error";

export interface Question {
  id: string;
  question: string;
  status: QuestionStatus;
  beginnerMd?: string;
  proMd?: string;
  storyId?: string;
}
```

- [ ] **Step 2: Create `web/src/lib/datasource.ts`** (the swap point)

```typescript
import type { Briefing, Story } from "./types";
import { SeedDataSource } from "./seed";

export interface DataSource {
  latestBriefing(): Promise<Briefing | null>;
  briefingByDate(date: string): Promise<Briefing | null>;
  recentBriefings(limit: number): Promise<Briefing[]>;
  storyById(id: string): Promise<Story | null>;
  storiesByIds(ids: string[]): Promise<Story[]>;
}

// Plan 4 swaps this for a DbDataSource (Drizzle/Postgres) — pages never change.
let _ds: DataSource | null = null;
export function getDataSource(): DataSource {
  if (!_ds) _ds = new SeedDataSource();
  return _ds;
}
```

- [ ] **Step 3: Create `web/src/lib/seed.ts`** — realistic demo content (2 stories, 1 briefing)

```typescript
import type { DataSource } from "./datasource";
import type { Briefing, Story } from "./types";

const STORIES: Story[] = [
  {
    id: "silver-reserves",
    topic: "China expands silver reserves",
    sourceCount: 14,
    leanSpread: { left: 5, center: 6, right: 3 },
    sources: [
      { source: "Reuters", url: "https://example.com/r", lean: "center" },
      { source: "Global Times", url: "https://example.com/g", lean: "left" },
      { source: "WSJ", url: "https://example.com/w", lean: "right" },
    ],
    neutralMd:
      "Multiple outlets report China increasing silver holdings. Framing varies: " +
      "some emphasize industrial demand, others a hedge against the dollar.",
    beginnerMd:
      "**What this means for you:** When a big country buys lots of a metal, it can " +
      "push the price up worldwide — affecting electronics and solar costs over time.",
    proMd:
      "**Game theory:** Diversifying reserves away from USD reduces exposure to " +
      "sanctions leverage. **Markets:** watch silver futures, miners, and CNY flows.",
    sentiment: "bullish",
  },
  {
    id: "rate-decision",
    topic: "Central bank holds rates",
    sourceCount: 9,
    leanSpread: { left: 3, center: 5, right: 1 },
    sources: [
      { source: "AP", url: "https://example.com/ap", lean: "center" },
      { source: "BBC", url: "https://example.com/bbc", lean: "center" },
    ],
    neutralMd: "Coverage agrees on the hold; differs on whether it signals caution or strength.",
    beginnerMd:
      "**What this means for you:** Borrowing costs stay the same for now — loans and " +
      "savings rates likely won't move much this month.",
    proMd:
      "**Analysis:** A hold with hawkish language keeps the curve flat; watch the dot plot " +
      "and 2Y yields for the real signal.",
    sentiment: "neutral",
  },
];

const BRIEFING: Briefing = {
  id: "demo-2026-06-13",
  date: "2026-06-13",
  headline: "Metals in focus as reserves shift; central bank stands pat",
  overallSentiment: "neutral",
  beginnerMd:
    "Today: a big country is stockpiling silver (could nudge prices up), and the central " +
    "bank left interest rates unchanged (your loans/savings stay steady).",
  proMd:
    "Reserve diversification and a hawkish hold dominate. Net macro read: cautious, " +
    "commodity-tilted. Detail in the stories below.",
  storyIds: ["silver-reserves", "rate-decision"],
};

export class SeedDataSource implements DataSource {
  async latestBriefing() { return BRIEFING; }
  async briefingByDate(date: string) { return date === BRIEFING.date ? BRIEFING : null; }
  async recentBriefings(limit: number) { return [BRIEFING].slice(0, limit); }
  async storyById(id: string) { return STORIES.find((s) => s.id === id) ?? null; }
  async storiesByIds(ids: string[]) { return STORIES.filter((s) => ids.includes(s.id)); }
}
```

- [ ] **Step 4: Typecheck**

```bash
bunx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /home/jiwira/Projects/WorldNews-101 && git add web/ && git commit -m "13062026-Add website types, data-source interface, seed data

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Layout, theme, header/footer with disclaimer

**Files:** Modify `web/src/app/layout.tsx`, `web/src/app/globals.css`. Create `web/src/components/Markdown.tsx`.

- [ ] **Step 1: Create `web/src/components/Markdown.tsx`** (XSS-safe, per 05-SECURITY §5)

```tsx
import ReactMarkdown from "react-markdown";

// raw HTML is NOT enabled in react-markdown by default → model output can't inject <script>.
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-wn">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
```

- [ ] **Step 2: Replace `web/src/app/layout.tsx`**

```tsx
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
        <header className="border-b border-slate-200 bg-white">
          <nav className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
            <Link href="/" className="font-semibold tracking-tight">World&nbsp;&amp;&nbsp;Finance&nbsp;101</Link>
            <div className="flex gap-5 text-sm text-slate-600">
              <Link href="/ask">Ask</Link>
              <Link href="/archive">Archive</Link>
              <Link href="/how-it-works">How it works</Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-3xl px-5 py-8">{children}</main>
        <footer className="mx-auto max-w-3xl px-5 py-10 text-xs text-slate-500">
          Bias ratings and the “neutral” view are <strong>AI assessments, not fact</strong>.
          Analysis for education — <strong>not financial advice</strong>.
        </footer>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Append theme helpers to `web/src/app/globals.css`** (keep the Tailwind directives at top)

```css
.prose-wn { line-height: 1.7; }
.prose-wn h2 { font-weight: 600; margin: 1rem 0 .4rem; }
.prose-wn p { margin: .5rem 0; }
.prose-wn strong { color: #0b1f3a; }
```

- [ ] **Step 4: Verify build**

```bash
bun run build
```
Expected: build succeeds (pages may be near-empty still).

- [ ] **Step 5: Commit**

```bash
cd /home/jiwira/Projects/WorldNews-101 && git add web/ && git commit -m "13062026-Add layout, theme, and disclaimer footer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Core components (SentimentBadge, BiasSpread, LayerToggle, StoryCard)

**Files:** Create the four components under `web/src/components/`.

- [ ] **Step 1: `web/src/components/SentimentBadge.tsx`**

```tsx
import type { Sentiment } from "@/lib/types";

const MAP: Record<Sentiment, { label: string; cls: string; dot: string }> = {
  bullish: { label: "Bullish", cls: "bg-green-50 text-green-700", dot: "🟢" },
  neutral: { label: "Neutral", cls: "bg-slate-100 text-slate-700", dot: "⚪" },
  bearish: { label: "Bearish", cls: "bg-red-50 text-red-700", dot: "🔴" },
};

export function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  const s = MAP[sentiment];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}>
      <span aria-hidden>{s.dot}</span> {s.label}
    </span>
  );
}
```

- [ ] **Step 2: `web/src/components/BiasSpread.tsx`** (the signature visual)

```tsx
import type { LeanSpread } from "@/lib/types";

export function BiasSpread({ spread, sourceCount }: { spread: LeanSpread; sourceCount: number }) {
  const total = Math.max(spread.left + spread.center + spread.right, 1);
  const seg = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="my-3">
      <div className="mb-1 text-xs text-slate-500">
        {sourceCount} outlets · {spread.left} left · {spread.center} center · {spread.right} right
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full">
        <div style={{ width: seg(spread.left) }} className="bg-blue-500" title={`${spread.left} left`} />
        <div style={{ width: seg(spread.center) }} className="bg-slate-400" title={`${spread.center} center`} />
        <div style={{ width: seg(spread.right) }} className="bg-rose-500" title={`${spread.right} right`} />
      </div>
      <div className="mt-1 text-[11px] text-slate-400">AI assessment of framing — not an objective rating.</div>
    </div>
  );
}
```

- [ ] **Step 3: `web/src/components/LayerToggle.tsx`** (client component)

```tsx
"use client";
import { useState } from "react";
import { Markdown } from "./Markdown";

export function LayerToggle({ beginnerMd, proMd }: { beginnerMd: string; proMd: string }) {
  const [pro, setPro] = useState(false);
  return (
    <div>
      <Markdown>{pro ? proMd : beginnerMd}</Markdown>
      <button
        onClick={() => setPro((v) => !v)}
        className="mt-2 text-sm font-medium text-blue-600 hover:underline"
      >
        {pro ? "← Simpler" : "Go deeper →"}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: `web/src/components/StoryCard.tsx`**

```tsx
import Link from "next/link";
import type { Story } from "@/lib/types";
import { SentimentBadge } from "./SentimentBadge";
import { BiasSpread } from "./BiasSpread";

export function StoryCard({ story }: { story: Story }) {
  return (
    <Link href={`/story/${story.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium">{story.topic}</h3>
        <SentimentBadge sentiment={story.sentiment} />
      </div>
      <BiasSpread spread={story.leanSpread} sourceCount={story.sourceCount} />
    </Link>
  );
}
```

- [ ] **Step 5: Typecheck + commit**

```bash
bunx tsc --noEmit
cd /home/jiwira/Projects/WorldNews-101 && git add web/ && git commit -m "13062026-Add core UI components

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Home page

**Files:** Replace `web/src/app/page.tsx`.

- [ ] **Step 1: Replace `web/src/app/page.tsx`**

```tsx
import { getDataSource } from "@/lib/datasource";
import { SentimentBadge } from "@/components/SentimentBadge";
import { LayerToggle } from "@/components/LayerToggle";
import { StoryCard } from "@/components/StoryCard";

export default async function Home() {
  const ds = getDataSource();
  const briefing = await ds.latestBriefing();
  if (!briefing) return <p className="text-slate-500">No briefing yet today — check back soon.</p>;
  const stories = await ds.storiesByIds(briefing.storyIds);

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-2 flex items-center gap-3 text-sm text-slate-500">
          <span>{briefing.date}</span>
          <SentimentBadge sentiment={briefing.overallSentiment} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{briefing.headline}</h1>
        <div className="mt-3">
          <LayerToggle beginnerMd={briefing.beginnerMd} proMd={briefing.proMd} />
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Today’s stories</h2>
        {stories.map((s) => <StoryCard key={s.id} story={s} />)}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verify in the browser (dev server)**

```bash
cd web && bun run dev -- -p 3001 &
sleep 6 && curl -s http://localhost:3001/ | grep -o "World &amp; Finance\|Bullish\|Neutral\|stories" | head
kill %1
```
Expected: matches found (headline + sentiment + stories render).

- [ ] **Step 3: Commit**

```bash
cd /home/jiwira/Projects/WorldNews-101 && git add web/ && git commit -m "13062026-Add home page

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Story detail page

**Files:** Create `web/src/app/story/[id]/page.tsx`.

- [ ] **Step 1: Create `web/src/app/story/[id]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { getDataSource } from "@/lib/datasource";
import { SentimentBadge } from "@/components/SentimentBadge";
import { BiasSpread } from "@/components/BiasSpread";
import { LayerToggle } from "@/components/LayerToggle";
import { Markdown } from "@/components/Markdown";

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const story = await getDataSource().storyById(id);
  if (!story) notFound();

  return (
    <article className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{story.topic}</h1>
        <SentimentBadge sentiment={story.sentiment} />
      </div>
      <BiasSpread spread={story.leanSpread} sourceCount={story.sourceCount} />
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">AI neutral read</h2>
        <Markdown>{story.neutralMd}</Markdown>
      </section>
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Economic impact</h2>
        <LayerToggle beginnerMd={story.beginnerMd} proMd={story.proMd} />
      </section>
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Sources</h2>
        <ul className="mt-1 space-y-1 text-sm">
          {story.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                {s.source}
              </a>{" "}
              <span className="text-slate-400">· {s.lean}</span>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
```

- [ ] **Step 2: Verify + commit**

```bash
cd web && bun run build && cd /home/jiwira/Projects/WorldNews-101 && git add web/ && git commit -m "13062026-Add story detail page

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Ask page + API route (mock queue)

**Files:** Create `web/src/app/ask/page.tsx`, `web/src/app/api/ask/route.ts`.

> Real wiring (insert into `questions`, poll for the answer) lands when the DB + crew exist. For now the route validates input and returns a demo answer so the UX is complete and testable.

- [ ] **Step 1: Create `web/src/app/api/ask/route.ts`** (input validation per 05-SECURITY §4)

```typescript
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question) return NextResponse.json({ error: "Question required" }, { status: 400 });
  if (question.length > 500) return NextResponse.json({ error: "Too long (max 500 chars)" }, { status: 400 });

  // TODO(Plan 2/on-demand): insert into `questions` (status='pending'); poller + crew answer.
  return NextResponse.json({
    status: "done",
    beginnerMd: `**Demo answer** for: _${question}_\n\nThe live analysis engine isn't wired yet — ` +
      `this is placeholder content. Once the agents are connected, five AI roles will analyze ` +
      `real news and answer here.`,
    proMd: "Pro layer will contain game-theory + market-impact analysis from the crew.",
  });
}
```

- [ ] **Step 2: Create `web/src/app/ask/page.tsx`** (client component)

```tsx
"use client";
import { useState } from "react";
import { Markdown } from "@/components/Markdown";

export default function AskPage() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<{ beginnerMd: string; proMd: string } | null>(null);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr(""); setAnswer(null);
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setErr(data.error ?? "Something went wrong"); return; }
    setAnswer(data);
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Ask about any world event — economically</h1>
      <form onSubmit={submit} className="space-y-3">
        <input
          value={q} onChange={(e) => setQ(e.target.value)} maxLength={500}
          placeholder="e.g. Iran war — what is the economic impact?"
          className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
        />
        <button disabled={loading || !q.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
          {loading ? "🤖 Agents are analyzing…" : "Analyze"}
        </button>
      </form>
      {err && <p className="text-red-600">{err}</p>}
      {answer && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <Markdown>{answer.beginnerMd}</Markdown>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify + commit**

```bash
cd web && bun run build && cd /home/jiwira/Projects/WorldNews-101 && git add web/ && git commit -m "13062026-Add Ask page and mock API route

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Archive + How-it-works pages

**Files:** Create `web/src/app/archive/page.tsx`, `web/src/app/how-it-works/page.tsx`.

- [ ] **Step 1: Create `web/src/app/archive/page.tsx`**

```tsx
import Link from "next/link";
import { getDataSource } from "@/lib/datasource";
import { SentimentBadge } from "@/components/SentimentBadge";

export default async function ArchivePage() {
  const briefings = await getDataSource().recentBriefings(30);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Past briefings</h1>
      <ul className="space-y-2">
        {briefings.map((b) => (
          <li key={b.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
            <Link href={`/archive/${b.date}`} className="hover:underline">{b.date} — {b.headline}</Link>
            <SentimentBadge sentiment={b.overallSentiment} />
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Create `web/src/app/how-it-works/page.tsx`** (the showcase)

```tsx
export default function HowItWorks() {
  return (
    <div className="prose-wn space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">How it works</h1>
      <p>
        World &amp; Finance 101 gathers global news, clusters articles that cover the same
        story, rates how each outlet leans, and produces a neutral economic analysis —
        all with <strong>local AI</strong> on an RTX 5070 Ti. No paid APIs.
      </p>
      <h2 className="text-lg font-semibold">The agents</h2>
      <ul className="list-disc pl-5">
        <li><strong>Curator</strong> — gathers &amp; clusters the day’s news.</li>
        <li><strong>Bias &amp; Framing Analyst</strong> — rates each source’s lean.</li>
        <li><strong>Game-Theory Analyst</strong> — why the actors do what they do.</li>
        <li><strong>Markets Analyst</strong> — the economic impact.</li>
        <li><strong>Editor</strong> — writes the neutral, layered briefing.</li>
      </ul>
      <p className="text-sm text-slate-500">
        Built with n8n + CrewAI + Ollama. Technical case study:{" "}
        <a href="https://jiwira.com" className="text-blue-600 hover:underline">jiwira.com</a>.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Build, verify all routes, commit**

```bash
cd web && bun run build
cd /home/jiwira/Projects/WorldNews-101 && git add web/ && git commit -m "13062026-Add archive and how-it-works pages

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Serve at worldnews.jiwira.com via Cloudflare Tunnel

> jiwira.com is already on Cloudflare (verified). `cloudflared` is installed. **Step 2 needs YOU** (a one-time browser login) — everything else is automated.

**Files:** cloudflared config lives at `~/.cloudflared/` (outside the repo, contains credentials — never committed).

- [ ] **Step 1: Run the site in production mode on 3001**

```bash
cd /home/jiwira/Projects/WorldNews-101/web && bun run build && (bun run start -- -p 3001 &)
sleep 6 && curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3001/
```
Expected: `HTTP 200`.

- [ ] **Step 2: Authenticate cloudflared (USER ACTION — opens a browser)**

```bash
cloudflared tunnel login
```
Pick `jiwira.com` in the browser. This writes `~/.cloudflared/cert.pem`.

- [ ] **Step 3: Create the tunnel and DNS route**

```bash
cloudflared tunnel create worldnews
cloudflared tunnel route dns worldnews worldnews.jiwira.com
```
Expected: a tunnel UUID is created and a CNAME for `worldnews.jiwira.com` is added in Cloudflare.

- [ ] **Step 4: Create `~/.cloudflared/config.yml`**

```yaml
tunnel: worldnews
credentials-file: /home/jiwira/.cloudflared/<TUNNEL-UUID>.json
ingress:
  - hostname: worldnews.jiwira.com
    service: http://localhost:3001
  - service: http_status:404
```
Replace `<TUNNEL-UUID>` with the id printed in Step 3.

- [ ] **Step 5: Run the tunnel and verify the public URL**

```bash
cloudflared tunnel run worldnews &
sleep 8 && curl -s -o /dev/null -w "HTTP %{http_code}\n" https://worldnews.jiwira.com/
```
Expected: `HTTP 200` from the public domain.

- [ ] **Step 6: Install as a service so it survives reboot**

```bash
sudo cloudflared service install   # USER ACTION (needs sudo password)
```
(If sudo is unavailable, run `cloudflared tunnel run worldnews` under a user systemd unit or a tmux session instead.)

- [ ] **Step 7: Update docs + regenerate exports + commit**

Update `docs/07-DEPLOYMENT.md` with the real tunnel name and the 3001 port, then:
```bash
cd /home/jiwira/Projects/WorldNews-101 && python3 docs/build-exports.py
git add docs/ && git commit -m "13062026-Document live Cloudflare Tunnel deployment

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage (SPEC §9 pages + §6 deployment):** Home (T5), Story (T6), Ask (T7), Archive
(T8), How-it-works (T8) all present. Bias-spread component (T4) = the signature visual from
04-UI-UX §3. Layered output (beginner/pro toggle) in T4/T5/T6 per D-005. Disclaimer/"AI
assessment" labeling (T3, T4) per D-007 / 05-SECURITY §9. XSS-safe markdown (T3) per
05-SECURITY §5. Input validation/length cap (T7) per 05-SECURITY §4. Cloudflare-Tunnel-only
exposure (T9) per 01-ARCHITECTURE §4 / 07-DEPLOYMENT. ✅

**Deferred (flagged, not gaps):** real data (DbDataSource) and live Q&A (insert+poll) need
Plans 1 & 2 — the DataSource interface (T2) and the api/ask TODO (T7) are the exact swap
points, so no page changes will be needed.

**Placeholder scan:** the two `TODO(Plan 2…)` markers are intentional, documented swap
points, not missing plan content. All component/page code is complete and runnable.

**Type consistency:** `Story`, `Briefing`, `Question`, `LeanSpread`, `Sentiment`, `Lean`
defined once in `types.ts`; the `DataSource` method names (`latestBriefing`, `storyById`,
`storiesByIds`, `recentBriefings`, `briefingByDate`) are used identically in pages and seed.
