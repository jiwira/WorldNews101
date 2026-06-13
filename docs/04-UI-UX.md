# 04 — UI / UX

> The product must be usable by a complete finance novice, while still respecting a
> professional. The whole design serves the **layered-output** principle.

## 1. Design principles

- **Beginner-first, pro-on-demand.** Default to plain language; the depth is one tap away.
- **Show the spread, don't preach.** The bias visualization is the hook — let readers
  *see* that a story is covered differently, then offer the neutral take.
- **Honest about AI.** Every AI judgment is labeled as such. No false authority.
- **Fast and calm.** Cached content loads instantly; the only "wait" is live Q&A, which
  is shown honestly.
- Visual consistency with jiwira-portfolio (Tailwind, the same type/spacing language).

## 2. Pages

### Home
- Today's **briefing**: large headline, a **sentiment badge** (🟢 bullish / ⚪ neutral /
  🔴 bearish), date.
- The **beginner layer** rendered by default (`react-markdown`), with a **"Go deeper →"**
  toggle revealing `pro_md`.
- Below: the day's **top stories** as cards (topic + source-spread mini-bar + sentiment).

### Story view
The signature screen. For one clustered story:
- **Source-spread bar** — e.g. `14 outlets · ◧◧◧◧◧ left 5 · ▦▦▦▦▦▦ center 6 · ◨◨◨ right 3`.
- **Neutral synthesis** (`neutral_md`) — clearly tagged *"WorldNews-101's AI neutral read."*
- **Economic impact + game theory** (the pro layer).
- **Sources list** — each outlet, its AI `lean` tag, and an outbound link to the original.

### Ask
- A prominent input: *"Ask about any world event — economically. e.g. 'Iran war — impact?'"*
- On submit: an honest **"🤖 Five agents are analyzing this…"** state (optionally a tiny
  step indicator: gathering → comparing sources → analyzing → writing).
- The layered answer renders when ready (client polls the question id).
- Recent public questions listed below (no PII — see security).

### Archive
- Past daily briefings, browseable by date.

### How it works (the showcase)
- Plain-English explanation of the n8n + CrewAI + Ollama engine, the agent roles, and the
  "all local, free, on an RTX 5070 Ti" story. Links to the jiwira-portfolio case study.
- This page is what makes the project "presentable to the world" as a *technical* artifact.

## 3. The bias spectrum component (key UI)

A horizontal bar segmented left / center / right, sized by `lean_spread` counts, with a
tooltip listing the outlets in each segment. Always accompanied by the label
*"AI assessment of framing — not an objective rating."*

## 4. States to design (don't skip)

- **Loading** (cached pages: skeleton; live Q&A: agent-progress state).
- **Empty** (no briefing yet today; no stories matched a question).
- **Error** (question failed → friendly message + retry; box offline → "agents are
  resting, briefings still available").
- **Slow** (Q&A taking long → reassuring progress, never a dead spinner).

## 5. Accessibility & i18n

- Semantic HTML, proper headings, color-independent sentiment (icon + label, not color alone).
- Content is generated in English for v1; the architecture allows a translation agent later.

## 6. What we are NOT building in v1

- Accounts, profiles, saved questions, dark/light theme switcher, comments. Deferred.
