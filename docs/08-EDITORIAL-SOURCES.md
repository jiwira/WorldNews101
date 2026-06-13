# 08 — Editorial Sources & Selection Config

> The concrete "what news do we pull, and what counts as relevant" config (D-012/D-013/D-014).
> Drops into the daily run (`run_all(rss_feeds, gdelt_queries)` + the crew). **Feed URLs
> must be validated before first use** — outlets change/retire RSS endpoints.

## 1. Home region & thresholds

| Setting | Value | Notes |
|---------|-------|-------|
| `home_region` | `Indonesia` | config, not hardcoded (D-012) |
| `min_impact_score` | `25` (start) | stories below this are filtered from the default feed; tune after watching real output |
| regional neighbors | China, Singapore, India, Malaysia, ASEAN | weighted above global, below local |

## 2. RSS feeds (verify each URL before use)

> ⚠️ **Reuters retired most public RSS feeds** — rely on the working ones below + GDELT for
> Reuters-origin breadth. Validate every URL with a quick fetch first.

**International**
| Outlet | Candidate RSS | Status |
|--------|---------------|--------|
| BBC Business | `https://feeds.bbci.co.uk/news/business/rss.xml` | usually works |
| Al Jazeera | `https://www.aljazeera.com/xml/rss/all.xml` | usually works |
| CNBC (Intl) | `https://www.cnbc.com/id/100003114/device/rss/rss.html` | verify |
| AP | (no reliable public RSS) | use GDELT instead |

**Indonesia (home region — weighted highest)**
| Outlet | Candidate RSS | Status |
|--------|---------------|--------|
| Antara (Ekonomi) | `https://www.antaranews.com/rss/ekonomi` | verify |
| Detik Finance | `https://finance.detik.com/rss` | verify |
| Kompas | category RSS (verify current path) | verify |
| CNBC Indonesia | site RSS (verify current path) | verify |
| Kontan / Bisnis | verify current paths | verify |

> Where an outlet has no working RSS, GDELT's `sourcecountry:Indonesia` filter covers it.

## 3. GDELT query seeds (the breadth backbone — API always works)

Run these via the GDELT doc API; they target Indonesia-relevant economic signal:

**Energy & commodities (Indonesia imports fuel, exports these):**
`oil price`, `OPEC`, `natural gas price`, `coal price`, `nickel`, `palm oil`, `tin price`

**Monetary & FX:**
`Bank Indonesia`, `rupiah`, `Federal Reserve rate`, `inflation Indonesia`, `interest rate decision`

**Trade & policy:**
`tariff`, `US China trade`, `export ban Indonesia`, `Indonesia investment`, `fuel subsidy Indonesia`

**Macro / geopolitics with economic spillover:**
`Indonesia economy`, `ASEAN trade`, `commodity prices`, `supply chain`, `sanctions oil`

> Plus a daily `sourcecountry:Indonesia` sweep for general home-region coverage.

## 4. Impact taxonomy (how the Curator/Editor score `impact_score`)

**High (60–100) — chosen:** energy/oil, Indonesia's export commodities (nickel/coal/palm oil/tin),
monetary (BI/Fed/inflation/IDR), trade wars/tariffs, local fiscal policy & subsidies, macro
shocks (recession/banking/sovereign-debt), sanctions affecting commodities.

**Medium (25–59) — included if regionally relevant:** broad global macro, large-economy
policy with indirect spillover, sector news touching Indonesian supply chains.

**Low (0–24) — filtered out (viewable under "show everything we filtered"):**
celebrity, entertainment, sport, lifestyle, crime/human-interest with no economic channel,
domestic foreign politics with no market impact.

**The litmus test:** *can a chain be drawn from this event to an Indonesian's cost of living,
job, or savings?* If yes → score it + write the chain as `impact_summary`. If no → filter.

## 5. Worked examples

| Headline | impact_score | region_relevance | Verdict |
|----------|-------------:|-----------------:|---------|
| Iran–Israel tension escalates | 90 | 0.8 | oil → fuel → inflation → **top** |
| China cuts nickel imports | 85 | 0.95 | Indonesia = top nickel producer → **top** |
| US Fed holds rates | 80 | 0.7 | USD/IDR, BI pressure → **high** |
| US–China tariff war | 80 | 0.7 | trade reroute, prices → **high** |
| Hollywood actor divorce | 3 | 0.1 | no economic channel → **filtered** |
| European football transfer | 5 | 0.1 | no Indonesian channel → **filtered** |

## 6. Wiring (once the crew is built)

- Pass §2 feeds + §3 queries into `pipeline.run_all(rss_feeds, gdelt_queries)` (Plan 1).
- The crew (Plan 2) scores `impact_score` per §4 and weights region per §1.
- n8n's daily workflow (Plan 2 Task 8) calls the run with this config on a 06:00 cron.
- `min_impact_score` lives in `CrewConfig` (Plan 2 Task 1).
