# WorldNews-101 Full Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the bare scaffold into a polished, legit-looking news-aggregator site with real source links, AI analysis display, Indonesia-relevant seed data, and a live Postgres datasource with seed fallback.

**Architecture:** Extend types → enrich seed → add DbDataSource with fallback → rebuild UI (globals, layout, StoryCard, story page, home page) → add /sources page. All DB calls wrapped in try/catch. DataSource factory auto-selects DB vs seed.

**Tech Stack:** Next.js 16 App Router, TypeScript 5, Tailwind v4, bun, pg (Postgres driver), react-markdown.

---

### Task 1: Extend types.ts

**Files:**
- Modify: `src/lib/types.ts`

- [ ] Add `impactScore`, `impactSummary`, `affectedRegions`, `regionRelevance` to `Story`
- [ ] Add `rankedStories(limit: number): Promise<Story[]>` to `DataSource` interface (in datasource.ts)
- [ ] Verify `bunx tsc --noEmit` passes

### Task 2: Enrich seed.ts

**Files:**
- Modify: `src/lib/seed.ts`

- [ ] Replace the 2 stub stories with 7 rich Indonesia-relevant stories
- [ ] Each story has 4-8 real-outlet sources with plausible URLs and lean tags
- [ ] Add `impactScore`, `impactSummary`, `affectedRegions`, `regionRelevance` fields
- [ ] Implement `rankedStories` on SeedDataSource

### Task 3: Add pg dep and DbDataSource

**Files:**
- Create: `src/lib/db-datasource.ts`
- Modify: `src/lib/datasource.ts`

- [ ] `bun add pg @types/pg`
- [ ] Implement DbDataSource with try/catch, maps DB rows to Story/Briefing
- [ ] Update datasource.ts factory to auto-select DB vs seed

### Task 4: Polish globals.css

**Files:**
- Modify: `src/app/globals.css`

- [ ] Add Georgia/serif display font for headlines
- [ ] Keep `.prose-wn` class; expand styling

### Task 5: Polish layout.tsx

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] Add /sources nav link, wider max-w, richer header/footer

### Task 6: Rebuild StoryCard

**Files:**
- Modify: `src/components/StoryCard.tsx`

- [ ] Show impactSummary, region tags, N sources count, impact score badge

### Task 7: Rebuild Home page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] Use `rankedStories` for the feed
- [ ] Richer briefing hero section

### Task 8: Rebuild Story page

**Files:**
- Modify: `src/app/story/[id]/page.tsx`

- [ ] Impact chain, affected regions, prominent Sources grid

### Task 9: Add /sources page

**Files:**
- Create: `src/app/sources/page.tsx`

- [ ] Outlet tier listing, methodology explanation

### Task 10: Verify build

- [ ] `bunx tsc --noEmit` → clean
- [ ] `bun run build` → all routes compile
