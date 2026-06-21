# UI/UX — Design Decisions

This page explains the **styling system, layout system, responsive strategy,
accessibility, internationalization**, and the reasoning/trade-offs behind the notable
UX choices. Everything here is verified against the real files; the load-bearing file is
`src/app/globals.css`.

## 1. Styling system: Tailwind CSS v4 with `@theme` design tokens

The app uses **Tailwind CSS v4**, configured the v4 way — there is **no `tailwind.config.js`**.
Instead the design tokens live inside an `@theme { … }` block in `src/app/globals.css`, and
PostCSS wires Tailwind in via `postcss.config.mjs`.

> Jargon: a **design token** is a named value (a color, here) you reuse everywhere instead of
> hardcoding hex codes. In Tailwind v4, every `--color-X` you declare inside `@theme`
> automatically becomes utility classes like `bg-X`, `text-X`, `border-X`. So
> `--color-paper: #f4f1ea` gives you `bg-paper`, `text-paper`, etc.

### The palette (the brand identity)

Defined in `src/app/globals.css` lines 7–23. It is deliberately **not** the default
slate/blue SaaS look — it is a warm "editorial newspaper" identity:

| Token | Value | Used for |
|-------|-------|----------|
| `paper` | `#f4f1ea` | Page background (warm newsprint) |
| `surface` | `#fffdf7` | Cards / panels (warm white) |
| `ink` | `#1b1814` | Primary text (warm near-black) |
| `ink-soft` | `#6d6657` | Body / captions |
| `ink-faint` | `#9a9384` | Eyebrows, meta text |
| `hair` | `#e3dccc` | Hairline rules / borders |
| `brand` | `#15433a` | Deep forest green — wordmark, links |
| `brand-soft` | `#2c6354` | Hover / lighter green |
| `gold` | `#9a7320` | Highlight / underline accent |
| `bull` / `bear` / `flat` | green / red / grey | Economic sentiment (▲ ■ ▼) |
| `lean-left` / `lean-center` / `lean-right` | blue / tan / red | Media bias bar segments |

These map directly to semantics: green = the brand and "low impact / positive", red = "high
impact / negative / right lean", gold = the editorial accent.

### Typography: a serif/sans split

Set in `globals.css` `@layer base` (lines 25–39):

- **Body text** uses a **system sans-serif** stack (`ui-sans-serif, system-ui, …`).
- **All headings** (`h1`–`h4`) use an **editorial serif** stack: `"Iowan Old Style",
  "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif`, with tight
  `letter-spacing: -0.02em`.
- The same serif is exposed as a `.font-display` utility class for non-heading elements
  (e.g. the masthead `<span>` and big numbers in `ImpactMeter`).

> **No web fonts are loaded.** There is no `next/font` import and no `@font-face`. The serif
> relies on fonts already installed on the reader's machine (Iowan on macOS/iOS, Palatino on
> Windows, Georgia as the safe fallback). Trade-off: zero font-loading latency and no layout
> shift, but the exact heading typeface differs per OS. If you ever need a guaranteed serif,
> wire one through `next/font` in `layout.tsx`.

### Editorial primitives (reusable CSS classes)

`globals.css` defines a few hand-written classes that recur all over the UI:

- **`.kicker`** — the small, tracked, uppercase label ("eyebrow") used for section labels,
  nav links, dates, and meta. This is the single most-used custom class.
- **`.font-display`** — the serif family as a utility (see above).
- **`.rule-gold`** — a gold 2px underline gradient for link/wordmark flourishes.
- **`.prose-wn`** — the styling wrapper for **AI-generated markdown**. Because the beginner
  layer uses `**bold**` sub-headings ("What happened", "Why it matters to you", "What to do
  or watch"), `.prose-wn` is tuned for scannable long-form reading: 1.75 line-height,
  custom gold bullet dots (`ul > li::before`), serif sub-headings, branded link color, and
  styled `code`/`blockquote`. It wraps every `<ReactMarkdown>` render via the `Markdown`
  component.

### To change the look, touch these files

- Colors / brand palette → `src/app/globals.css` `@theme` block. Add `--color-foo` and you
  immediately get `bg-foo` etc. everywhere.
- Heading font / body font → `@layer base` in `globals.css` (and `.font-display`).
- Markdown reading style → the `.prose-wn` rules in `globals.css`.
- Global page chrome (masthead, nav, footer) → `src/app/layout.tsx`.

## 2. Layout system

- **No CSS framework grid system or component library** (no MUI, no shadcn). Layout is plain
  **Tailwind flex/grid utilities** applied inline in JSX.
- **Centered measure.** The chrome (`layout.tsx`) centers content with `mx-auto max-w-5xl`
  for the strip/masthead/nav/footer, but the actual page `<main>` is narrower —
  `mx-auto max-w-3xl px-5 py-10` — to keep reading line-length comfortable for long-form
  text. This is a deliberate editorial choice.
- **Vertical rhythm** is done with Tailwind spacing utilities, most commonly `space-y-*` on
  the page root (e.g. `space-y-16` on the home page between the briefing and the feed).
- **Section dividers** are the newspaper motif: `border-b-2 border-ink` under section
  headings, `border-b border-hair` between story cards, and a `h-px flex-1 bg-hair` "rule"
  next to kickers.

## 3. Responsive strategy

- **Mobile-first.** Base classes target small screens; `sm:` (≥640px) prefixes add desktop
  refinements. There is essentially **one breakpoint in active use (`sm:`)** plus a couple of
  `md:` cases.
- Concrete examples:
  - Masthead wordmark scales `text-4xl` → `sm:text-6xl` (`layout.tsx`).
  - Home headline scales `text-3xl` → `sm:text-[2.75rem]` (`page.tsx`).
  - Sources grid stacks then splits: `grid gap-3 sm:grid-cols-2` (`story/[id]/page.tsx`).
  - Footer goes column → row at `sm:` (`layout.tsx`).
  - The `UpdateButton` status note is hidden until `md:` (`hidden … md:inline`).
- The sticky nav (`sticky top-0 z-20 … backdrop-blur`) keeps section navigation reachable as
  the reader scrolls long stories.

## 4. Accessibility

What is done well:

- Decorative glyphs are hidden from screen readers: the sentiment arrows (▲ ■ ▼), the nav
  separator dots, the bias-bar legend dots, and the spinner all carry `aria-hidden`.
- The language toggle marks the active language with `aria-current`.
- Semantic HTML is used: `<time dateTime={…}>` for dates, real `<article>`/`<header>`/
  `<section>`/`<nav>`/`<footer>` landmarks, and heading levels (`h1` per page, `h2` per
  section).
- `<html lang={…}>` is set from the reader's chosen language in `layout.tsx`, so assistive
  tech announces content in the right language.
- External source links use `target="_blank" rel="noopener noreferrer"`.
- The `SentimentBadge` exposes a `title` tooltip pairing the plain label with the finance
  term and a gloss (e.g. "Positive (bullish) — good for growth / your costs").

Gaps to be aware of:

- **Color contrast risk.** `ink-faint` (`#9a9384`) on `paper` (`#f4f1ea`), used for
  `.kicker` and meta text, is low-contrast and likely fails WCAG AA for small text. If you do
  an a11y pass, darken these.
- **No skip-to-content link** and **no visible focus-ring customization** — focus relies on
  browser defaults.
- The bias bar and impact meter convey meaning partly through color; the numeric/text
  legends mitigate this but the bars alone are not distinguishable for color-blind users.

## 5. Internationalization (EN / ID / ZH)

This is a genuinely notable decision, so it gets its own section.

- **Three languages:** English, Indonesian, Chinese. Defined in `src/lib/lang.ts`
  (`type Lang = "en" | "id" | "zh"`, the `LANGS` array, and `normalizeLang`).
- **Two separate translation channels:**
  1. **UI chrome strings** (nav labels, buttons, section headings, disclaimers) live in a
     hand-maintained dictionary in `src/lib/ui.ts`. You call `t(lang, "key")` to get the
     right string; missing keys fall back to English.
  2. **Content** (story analysis, briefings) is translated in the **database/engine**, not in
     the frontend — the data-source layer returns the already-translated text for the chosen
     language. `ui.ts` only covers the interface.
- **How the language is chosen:** the `LanguageToggle` (client) writes a `lang` cookie and
  calls `router.refresh()`. On the next render, the server reads it via `getLang()` in
  `src/lib/lang.server.ts` (`cookies().get("lang")`), which feeds both `t()` and
  `getDataSource(lang)`. No URL-based locale routing, no `next-intl`.
- **Trade-off:** cookie-based locale is simple and keeps URLs clean, but it means language is
  not shareable via a link and not great for SEO of translated content. For a personal local
  project that is an acceptable simplification.
- **Known gap:** the `/ask` page and its API are English-only and not routed through `t()`.

### To add a language or a UI string

- New UI string → add a key to the `S` object in `src/lib/ui.ts` with all three locales
  (the `satisfies Record<string, Str>` constraint forces you to supply `en`, `id`, `zh`).
- New language → extend `Lang`, `LANGS`, and `normalizeLang` in `src/lib/lang.ts`, fill in
  every value in `ui.ts`, and ensure the engine produces content translations for it.

## 6. Why it was built this way (summary of rationale)

- **Editorial identity over generic SaaS:** the warm paper/ink/forest-green/gold palette and
  serif headings make a *news* product feel like a newspaper, building trust for an
  AI-generated product where trust is the whole game.
- **Server Components + force-dynamic:** content changes daily, so reading the DB per request
  on the server (no client fetch, no API for reads) is the simplest correct model.
- **Tiny client surface:** only `LanguageToggle`, `UpdateButton`, `LayerToggle`, and the
  `/ask` form ship JS. Everything else is static HTML — fast and cheap, fitting the
  "local AI, no paid APIs" ethos in the footer.
- **System fonts + no UI library:** keeps the bundle minimal and the project dependency-light.
