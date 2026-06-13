import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sources & Methodology — World & Finance 101",
  description:
    "How World & Finance 101 aggregates news from dozens of outlets, assesses bias, and produces Indonesia-focused economic analysis.",
};

interface Outlet {
  name: string;
  country: string;
  type: string;
  notes: string;
}

const INDONESIAN_OUTLETS: Outlet[] = [
  { name: "Antara",         country: "🇮🇩 Indonesia", type: "Wire",      notes: "State news agency; official government statements, economic data releases." },
  { name: "Kompas",         country: "🇮🇩 Indonesia", type: "Newspaper", notes: "Largest national daily; independent, centrist editorial stance." },
  { name: "Detik Finance",  country: "🇮🇩 Indonesia", type: "Digital",   notes: "High-volume business news portal; fast-breaking market updates." },
  { name: "Kontan",         country: "🇮🇩 Indonesia", type: "Business",  notes: "Business and investment daily; strong on commodities and IDX." },
  { name: "CNBC Indonesia", country: "🇮🇩 Indonesia", type: "TV/Digital","notes": "Licensed CNBC brand for Indonesia; macro and market commentary." },
  { name: "Jakarta Post",   country: "🇮🇩 Indonesia", type: "Newspaper", notes: "English-language broadsheet; international audience, liberal framing." },
];

const INTERNATIONAL_OUTLETS: Outlet[] = [
  { name: "Reuters",        country: "🇬🇧 UK / Global", type: "Wire",      notes: "Primary factual source; used as cross-check baseline for all stories." },
  { name: "Bloomberg",      country: "🇺🇸 USA",         type: "Financial", notes: "Market data and financial analysis; terminals desk." },
  { name: "AP",             country: "🇺🇸 USA",         type: "Wire",      notes: "Non-profit wire; centre framing, widely republished." },
  { name: "BBC",            country: "🇬🇧 UK",          type: "Broadcast", notes: "Centre-left; strong on geopolitics and humanitarian angles." },
  { name: "Al Jazeera",     country: "🇶🇦 Qatar",       type: "Broadcast", notes: "Centre-left; Middle-East and Global South emphasis." },
  { name: "CNBC",           country: "🇺🇸 USA",         type: "TV/Digital","notes": "Centre; pro-market, strong earnings and Fed coverage." },
  { name: "Financial Times",country: "🇬🇧 UK",          type: "Newspaper", notes: "Centre; authoritative on global finance and policy." },
  { name: "WSJ",            country: "🇺🇸 USA",         type: "Newspaper", notes: "Centre-right; strong US policy and corporate coverage." },
  { name: "Xinhua",         country: "🇨🇳 China",       type: "Wire",      notes: "Chinese state agency; included for Beijing's stated position." },
  { name: "Global Times",   country: "🇨🇳 China",       type: "Newspaper", notes: "Chinese state tabloid; nationalist framing — included as counterpoint." },
];

const SUPPLEMENTARY: { name: string; notes: string }[] = [
  { name: "GDELT Project",       notes: "Global database of events, language, and tone. Used for global story discovery and sentiment signals at scale." },
  { name: "Quandl / CEIC",       notes: "Economic time-series for Indonesia (BPS data, BI reserves, commodity prices) cross-referenced in analysis." },
  { name: "OECD & World Bank",   notes: "Long-run structural data; cited in pro-layer analysis for macro context." },
];

function OutletRow({ outlet }: { outlet: Outlet }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex flex-shrink-0 flex-col gap-0.5 sm:w-44">
        <span className="font-semibold text-slate-900">{outlet.name}</span>
        <div className="flex gap-2 text-xs text-slate-400">
          <span>{outlet.country}</span>
          <span>·</span>
          <span>{outlet.type}</span>
        </div>
      </div>
      <p className="text-sm text-slate-600 leading-relaxed">{outlet.notes}</p>
    </div>
  );
}

export default function SourcesPage() {
  return (
    <div className="space-y-14">
      {/* ── Page heading ── */}
      <header className="space-y-4">
        <h1
          className="text-3xl font-bold tracking-tight text-slate-900"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          Sources &amp; Methodology
        </h1>
        <p className="max-w-2xl text-base text-slate-600 leading-relaxed">
          World &amp; Finance 101 aggregates stories from dozens of outlets — Indonesian and
          international — and uses local AI models to cluster, cross-reference, and analyse them
          through an economic lens. Here is exactly what we pull from and why.
        </p>
      </header>

      {/* ── How multi-source aggregation works ── */}
      <section className="rounded-2xl border border-slate-200 bg-white px-7 py-8 shadow-sm space-y-4">
        <h2
          className="text-xl font-bold text-slate-900"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          How aggregation works
        </h2>
        <div className="space-y-3 text-sm text-slate-700 leading-relaxed">
          <p>
            <strong className="text-slate-900">1. Ingestion.</strong> Every few hours a crawler
            collects headlines and article text from RSS feeds, APIs, and direct scrapes of the
            outlets listed below.
          </p>
          <p>
            <strong className="text-slate-900">2. Clustering.</strong> An AI model groups articles
            that cover the same underlying event into a single <em>story cluster</em>, regardless of
            which outlet published first or how they frame it.
          </p>
          <p>
            <strong className="text-slate-900">3. Bias assessment.</strong> For each article,
            the model rates the outlet's framing on a left–centre–right axis based on word choice,
            source selection, and emphasis — not political affiliation. This rating is an{" "}
            <strong className="text-red-700">AI estimate, not an objective fact</strong>.
          </p>
          <p>
            <strong className="text-slate-900">4. Analysis.</strong> A multi-agent pipeline
            (Curator → Bias Analyst → Game-Theory Analyst → Markets Analyst → Editor) produces a
            neutral summary and a two-layer economic analysis: plain-language and professional-grade.
          </p>
          <p>
            <strong className="text-slate-900">5. Impact scoring.</strong> Each story receives an
            impact score (0–100) and an Indonesia-relevance weight (0–1), so the front page surfaces
            what matters most to an Indonesian reader first.
          </p>
        </div>
      </section>

      {/* ── Indonesian outlets ── */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2
            className="text-xl font-bold text-slate-900"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Indonesian outlets
          </h2>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Primary domestic sources
          </span>
        </div>
        <div className="space-y-2">
          {INDONESIAN_OUTLETS.map((o) => (
            <OutletRow key={o.name} outlet={o} />
          ))}
        </div>
      </section>

      {/* ── International outlets ── */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2
            className="text-xl font-bold text-slate-900"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            International outlets
          </h2>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Cross-reference &amp; global breadth
          </span>
        </div>
        <div className="space-y-2">
          {INTERNATIONAL_OUTLETS.map((o) => (
            <OutletRow key={o.name} outlet={o} />
          ))}
        </div>
      </section>

      {/* ── Supplementary data ── */}
      <section className="space-y-4">
        <h2
          className="text-xl font-bold text-slate-900"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          Supplementary data sources
        </h2>
        <div className="space-y-2">
          {SUPPLEMENTARY.map((s) => (
            <div
              key={s.name}
              className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-start sm:gap-4"
            >
              <span className="flex-shrink-0 font-semibold text-slate-900 sm:w-44">{s.name}</span>
              <p className="text-sm text-slate-600 leading-relaxed">{s.notes}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Disclaimer ── */}
      <section className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-5 space-y-2">
        <h2 className="text-sm font-bold text-amber-900 uppercase tracking-wide">
          Important caveats
        </h2>
        <ul className="space-y-1.5 text-sm text-amber-800 leading-relaxed list-disc pl-4">
          <li>
            Bias ratings are <strong>AI assessments of framing</strong> in individual articles,
            not endorsements or objective political ratings of the outlet as a whole.
          </li>
          <li>
            The &quot;neutral read&quot; is a model-generated synthesis. It may contain errors,
            omissions, or unintended framing. Always consult original sources for consequential decisions.
          </li>
          <li>
            Nothing on this site constitutes <strong>financial, legal, or investment advice</strong>.
            Analysis is for educational purposes only.
          </li>
          <li>
            The AI pipeline runs on local hardware (RTX 5070 Ti). No story data is sent to
            third-party AI APIs.
          </li>
        </ul>
      </section>
    </div>
  );
}
