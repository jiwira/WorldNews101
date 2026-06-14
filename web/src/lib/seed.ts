import type { DataSource } from "./datasource";
import type { Briefing, Story } from "./types";

const STORIES: Story[] = [
  // ─── 1. Iran oil sanctions & Pertamina ──────────────────────────────────────
  {
    id: "iran-oil-sanctions",
    topic: "US tightens Iran oil sanctions — Pertamina sourcing at risk",
    sourceCount: 7,
    leanSpread: { left: 2, center: 3, right: 2 },
    sources: [
      {
        source: "Reuters",
        url: "https://www.reuters.com/business/energy/us-tightens-iran-oil-sanctions-2026-06/",
        lean: "center",
      },
      {
        source: "Bloomberg",
        url: "https://www.bloomberg.com/news/articles/2026-06-13/iran-oil-sanctions-pertamina",
        lean: "center",
      },
      {
        source: "Al Jazeera",
        url: "https://www.aljazeera.com/economy/2026/6/13/iran-oil-sanctions-asia",
        lean: "left",
      },
      {
        source: "WSJ",
        url: "https://www.wsj.com/articles/iran-oil-sanctions-global-markets-2026",
        lean: "right",
      },
      {
        source: "Jakarta Post",
        url: "https://www.thejakartapost.com/business/2026/06/13/pertamina-iran-oil-sourcing.html",
        lean: "center",
      },
      {
        source: "Antara",
        url: "https://en.antaranews.com/news/2026-06-13/pertamina-iran-crude-alternatives",
        lean: "center",
      },
      {
        source: "CNBC Indonesia",
        url: "https://www.cnbcindonesia.com/market/2026061312000/sanctions-iran-minyak",
        lean: "center",
      },
    ],
    neutralMd: `US Treasury expanded secondary sanctions on Iranian crude exports, closing loopholes used by Asian refiners. Pertamina, Indonesia's state oil company, had quietly sourced discounted Iranian crude via intermediaries. The move forces a switch to pricier Middle-East or West African alternatives.

Reuters and Bloomberg emphasise the enforcement mechanism and secondary-sanctions risk for Asian banks financing the trades. Al Jazeera highlights the humanitarian cost and Iranian government's rebuttal. WSJ frames it as leverage in nuclear negotiations. Jakarta Post covers domestic fuel-subsidy implications; Antara notes Pertamina is "evaluating alternative crude baskets."`,
    beginnerMd: `**What this means for you:** Indonesia imports a lot of oil. If Pertamina has to buy from more expensive sources, the government faces higher fuel-subsidy costs — which can lead to budget pressure, a weaker rupiah, or — eventually — higher pump prices.

**Simple chain:** Sanctions → pricier crude → higher subsidy bill → budget pressure → weaker IDR → costlier imports for everyone.`,
    proMd: `**Impact chain:** Secondary-sanctions exposure forces Asian intermediaries out; Pertamina's cost-of-crude rises ~$4–8/bbl on spot differentials. Ministry of Finance faces IDR 15–25 trillion additional subsidy exposure at current Pertalite price cap. BI may need to absorb IDR weakness via FX intervention.

**Markets watch:** Brent/WTI spread, Pertamina bond spreads, IDR/USD (target: 16,400), palm-oil correlation (subsidy trade-off vs bio-fuel blending mandate). Saudi Aramco OSP for Arab Light is the key re-pricing benchmark.`,
    sentiment: "bearish",
    impactScore: 88,
    impactSummary:
      "Pricier Iranian crude for Pertamina inflates Indonesia's fuel-subsidy bill and pressures the rupiah.",
    affectedRegions: ["Indonesia", "Iran", "Middle East", "Southeast Asia"],
    regionRelevance: 0.92,
  },

  // ─── 2. US-China tariffs & nickel ───────────────────────────────────────────
  {
    id: "us-china-tariffs-nickel",
    topic: "US-China tariff truce cracks — Indonesia nickel exports in crossfire",
    sourceCount: 8,
    leanSpread: { left: 2, center: 4, right: 2 },
    sources: [
      {
        source: "Reuters",
        url: "https://www.reuters.com/markets/commodities/us-china-tariff-nickel-indonesia-2026-06/",
        lean: "center",
      },
      {
        source: "Financial Times",
        url: "https://www.ft.com/content/us-china-nickel-tariff-2026",
        lean: "center",
      },
      {
        source: "Global Times",
        url: "https://www.globaltimes.cn/page/202606/nickel-processing-indonesia.shtml",
        lean: "left",
      },
      {
        source: "WSJ",
        url: "https://www.wsj.com/articles/us-china-tariff-nickel-ev-battery-2026",
        lean: "right",
      },
      {
        source: "CNBC",
        url: "https://www.cnbc.com/2026/06/13/us-china-tariff-nickel-ev-battery-supply.html",
        lean: "center",
      },
      {
        source: "Kontan",
        url: "https://industri.kontan.co.id/news/tarif-nikel-as-china-2026",
        lean: "center",
      },
      {
        source: "Detik Finance",
        url: "https://finance.detik.com/industri/d-2026061301/nikel-indonesia-tarif-as-china",
        lean: "center",
      },
      {
        source: "Xinhua",
        url: "https://english.news.cn/2026-06/13/nickel-processing-asean.htm",
        lean: "left",
      },
    ],
    neutralMd: `Washington re-imposed a 25 % tariff on Chinese EV batteries containing Indonesian processed nickel, citing supply-chain transparency rules. China accounts for ~60 % of Indonesia's downstream nickel-processing output (HPAL, NPI). The tariff targets the "China-plus-one" routing that sent Indonesian nickel products through Chinese processors to US auto makers.

Global Times frames it as "tech protectionism"; WSJ calls it "closing a loophole." Indonesian officials are pressing for a bilateral MoU to certify origin. The EU's CBAM creates similar pressure from the west.`,
    beginnerMd: `**What this means for you:** Indonesia has huge nickel deposits and built processing plants partly to supply EV batteries. If the US blocks those products, Indonesia earns less foreign currency, factory jobs are at risk, and the companies involved may cut investment.

**Simple chain:** Tariff → lower nickel export revenue → weaker current account → rupiah pressure → local inflation.`,
    proMd: `**Macro:** Indonesia's nickel export revenue (~$30 bn/yr) faces a 12–18 % demand shock if US auto OEMs need to re-source. HPAL plant utilisation rates are the leading indicator. BEI-listed nickel plays (INCO, ANTM) have priced in ~60 % of the tariff risk per options skew.

**Strategic play:** Indonesia's leverage is raw-ore export ban (already in force). Renegotiating the IPEF Supply-Chain Agreement is the diplomatic path. Watch RKAB (mining quota) decisions as a canary for government confidence.`,
    sentiment: "bearish",
    impactScore: 91,
    impactSummary:
      "US tariffs on China-processed Indonesian nickel threaten the country's top export earner and EV-battery investment pipeline.",
    affectedRegions: ["Indonesia", "China", "United States", "ASEAN"],
    regionRelevance: 0.95,
  },

  // ─── 3. Fed rate hold & BI response ─────────────────────────────────────────
  {
    id: "fed-rates-bi-response",
    topic: "Fed holds rates at 4.5 % — Bank Indonesia faces tough follow-on choice",
    sourceCount: 6,
    leanSpread: { left: 1, center: 4, right: 1 },
    sources: [
      {
        source: "Reuters",
        url: "https://www.reuters.com/markets/us/fed-holds-rates-june-2026/",
        lean: "center",
      },
      {
        source: "Bloomberg",
        url: "https://www.bloomberg.com/news/articles/2026-06-13/fed-june-hold-emerging-markets",
        lean: "center",
      },
      {
        source: "BBC",
        url: "https://www.bbc.com/news/business/2026-06-13/us-federal-reserve-rates-hold",
        lean: "center",
      },
      {
        source: "CNBC",
        url: "https://www.cnbc.com/2026/06/13/fed-rate-decision-june-2026-emerging-market.html",
        lean: "center",
      },
      {
        source: "CNBC Indonesia",
        url: "https://www.cnbcindonesia.com/market/2026061312000/fed-hold-bi-rate",
        lean: "center",
      },
      {
        source: "Antara",
        url: "https://en.antaranews.com/news/2026-06-13/bi-rate-decision-fed-hold",
        lean: "left",
      },
    ],
    neutralMd: `The Federal Open Market Committee left the federal funds rate at 4.25–4.50 % for the third consecutive meeting. Chair Powell cited "persistent services inflation" and a still-tight labour market. The statement dropped previous language about "appropriate to cut," signalling a higher-for-longer stance.

Bloomberg and Reuters focus on the dot-plot revision (2 cuts in 2027 vs 3 previously). BBC leads with consumer impact. CNBC Indonesia notes Bank Indonesia's June RDG meeting falls in two weeks — BI has kept its benchmark at 6.25 % since February. A Fed hold reduces BI's room to cut without widening the rate differential and risking capital outflow.`,
    beginnerMd: `**What this means for you:** When the US keeps interest rates high, global money tends to stay in dollars. That puts pressure on currencies like the rupiah. Bank Indonesia may keep its own rates high to stop money leaving — which keeps mortgage and business loan rates elevated in Indonesia too.

**Simple chain:** Fed holds → USD stays strong → IDR under pressure → BI keeps rates high → borrowing expensive for Indonesians.`,
    proMd: `**Transmission:** USDIDR spot at 16,200 reflects a 75-bp carry premium. BI's real rate is +0.8 % (CPI 5.4 %). A 25-bp BI cut would compress the differential to ~175 bp, risking a 1–2 % IDR depreciation per historical regression. OFZ-style capital flight risk is low (Indonesia's SBN foreign ownership at 14 %, down from 38 % in 2019) but non-trivial.

**Watch:** BI's RDG statement on June 26; USD index (DXY) > 105 is the line where BI rhetoric firms; 10Y SUN yield spread vs UST (currently 380 bp). Equity: rate-sensitive sectors (BBCA, BMRI, property) most exposed.`,
    sentiment: "neutral",
    impactScore: 82,
    impactSummary:
      "A Fed hold keeps US rates elevated, constraining Bank Indonesia's ability to cut and sustaining high borrowing costs domestically.",
    affectedRegions: ["Indonesia", "United States", "Emerging Markets"],
    regionRelevance: 0.88,
  },

  // ─── 4. Palm oil EU deforestation regulation ────────────────────────────────
  {
    id: "palm-oil-eu-deforestation",
    topic: "EU deforestation law delayed again — palm oil exporters get reprieve",
    sourceCount: 5,
    leanSpread: { left: 2, center: 2, right: 1 },
    sources: [
      {
        source: "Reuters",
        url: "https://www.reuters.com/sustainability/eu-deforestation-regulation-delay-2026-06/",
        lean: "center",
      },
      {
        source: "BBC",
        url: "https://www.bbc.com/news/science-environment/2026-06-13/eu-deforestation-law-delay",
        lean: "center",
      },
      {
        source: "Al Jazeera",
        url: "https://www.aljazeera.com/economy/2026/6/13/eu-palm-oil-deforestation-delay",
        lean: "left",
      },
      {
        source: "Jakarta Post",
        url: "https://www.thejakartapost.com/business/2026/06/13/eu-deforestation-palm-oil-reprieve.html",
        lean: "center",
      },
      {
        source: "Kompas",
        url: "https://money.kompas.com/read/2026/06/13/minyak-sawit-eu-deforestasi",
        lean: "left",
      },
    ],
    neutralMd: `The European Parliament voted to push the EU Deforestation Regulation (EUDR) enforcement deadline from December 2026 to June 2028, citing "implementation challenges" for partner-country supply-chain traceability systems. The regulation requires palm oil, soy, cocoa, and timber exporters to prove products are not linked to land cleared after 2020.

Al Jazeera and environmental groups call it a "capitulation to agribusiness." Jakarta Post and Kompas frame it as diplomatic success for ASEAN. Reuters notes that EU member states and the Parliament still disagree on the country-risk benchmarking system.`,
    beginnerMd: `**What this means for you:** Indonesia and Malaysia together produce about 85 % of the world's palm oil. The EU rule threatened to block exports unless companies could prove no deforestation was involved. The delay gives Indonesian palm-oil farmers and companies two more years before they need expensive tracking systems.

**Simple chain:** Delay → less near-term compliance cost → palm oil exports to EU continue → CPO price support → better income for farmers.`,
    proMd: `**Markets:** CPO futures (BMD) rallied 2.1 % on the news. Indonesia's palm-oil export levy (CPO Fund) stands to collect ~$800 m extra in 2026–27 vs the blocked scenario. Key risk: delay is not cancellation — EUDR returns in 2028, and the traceability system (ISPO 2.0 + blockchain pilots) must still be built.

**Strategic:** Companies with SAN/RSPO certification are better positioned. Stocks: AALI, LSIP. Watch CPO-gasoil spread for biodiesel blending mandate economics (B40 mandatory by Q3 2026).`,
    sentiment: "bullish",
    impactScore: 78,
    impactSummary:
      "A two-year delay in EU deforestation enforcement protects Indonesian palm-oil export volumes and CPO prices near-term.",
    affectedRegions: ["Indonesia", "Malaysia", "European Union", "ASEAN"],
    regionRelevance: 0.85,
  },

  // ─── 5. Rupiah & BI intervention ────────────────────────────────────────────
  {
    id: "rupiah-bi-intervention",
    topic: "Rupiah slides past 16,300 — BI deploys FX reserves in spot and NDF markets",
    sourceCount: 6,
    leanSpread: { left: 1, center: 4, right: 1 },
    sources: [
      {
        source: "Bloomberg",
        url: "https://www.bloomberg.com/news/articles/2026-06-13/rupiah-bi-fx-intervention-16300",
        lean: "center",
      },
      {
        source: "Reuters",
        url: "https://www.reuters.com/markets/currencies/rupiah-bi-intervention-june-2026/",
        lean: "center",
      },
      {
        source: "CNBC",
        url: "https://www.cnbc.com/2026/06/13/indonesian-rupiah-16300-bi-intervention.html",
        lean: "center",
      },
      {
        source: "Detik Finance",
        url: "https://finance.detik.com/moneter/d-2026061302/rupiah-16300-bi-intervensi",
        lean: "center",
      },
      {
        source: "CNBC Indonesia",
        url: "https://www.cnbcindonesia.com/market/2026061313000/rupiah-bi-intervensi-ndf",
        lean: "center",
      },
      {
        source: "Antara",
        url: "https://en.antaranews.com/news/2026-06-13/bi-intervene-rupiah-16300",
        lean: "left",
      },
    ],
    neutralMd: `The Indonesian rupiah touched IDR 16,340/USD intraday on June 13 — its weakest since the March 2020 pandemic shock — before recovering to 16,270 after Bank Indonesia confirmed it was active in both spot and NDF (non-deliverable forward) markets. BI's foreign-exchange reserves stood at $144.2 billion at end-May, giving it substantial firepower.

Bloomberg and Reuters focus on EM capital outflows following the Fed hold; CNBC notes the NDF intervention signals BI is prepared to defend a line. Detik Finance and CNBC Indonesia report domestic importers are scrambling for USD hedges. Antara quoted BI Deputy Governor emphasising reserves remain "adequate."`,
    beginnerMd: `**What this means for you:** When the rupiah weakens, everything imported gets more expensive — electronics, fuel, raw materials for manufacturing. Inflation tends to follow. BI uses its dollar reserves to buy rupiah and stabilise the exchange rate, but those reserves are finite.

**Simple chain:** Weak rupiah → pricier imports → higher inflation → BI rate pressure → less room for growth stimulus.`,
    proMd: `**Technicals:** IDR 16,300–16,350 is the critical band; a close above 16,350 would trigger stop-loss selling toward 16,500 (2020 high). BI's NDF intervention cost: estimated $800 m–1.2 bn this week alone. Reserves at $144 bn = ~7.2 months of import cover (IMF safety threshold: 3 months).

**Carry trade unwind risk:** Non-resident SBN holdings at IDR 892 tn; a 1 % FX move typically triggers IDR 4–6 tn outflow from this base. Watch 3M NDF implied vol and CDS spreads (currently 85 bp, 2-year high). BI's SRBI (Sekuritas Rupiah BI) at 7 % offers defensive yield for domestic funds.`,
    sentiment: "bearish",
    impactScore: 85,
    impactSummary:
      "Rupiah weakness past 16,300 forces costly BI reserve spending and risks importing inflation.",
    affectedRegions: ["Indonesia"],
    regionRelevance: 0.98,
  },

  // ─── 6. ASEAN-GCC trade pact ─────────────────────────────────────────────────
  {
    id: "asean-gcc-trade-pact",
    topic: "ASEAN-GCC Free Trade Agreement framework agreed — energy and halal goods the centrepiece",
    sourceCount: 5,
    leanSpread: { left: 1, center: 3, right: 1 },
    sources: [
      {
        source: "Reuters",
        url: "https://www.reuters.com/world/asia-pacific/asean-gcc-fta-framework-2026-06/",
        lean: "center",
      },
      {
        source: "Al Jazeera",
        url: "https://www.aljazeera.com/economy/2026/6/13/asean-gcc-fta-energy-halal",
        lean: "left",
      },
      {
        source: "CNBC",
        url: "https://www.cnbc.com/2026/06/13/asean-gcc-free-trade-agreement-halal-energy.html",
        lean: "center",
      },
      {
        source: "Antara",
        url: "https://en.antaranews.com/news/2026-06-13/asean-gcc-fta-indonesia-halal",
        lean: "center",
      },
      {
        source: "Jakarta Post",
        url: "https://www.thejakartapost.com/business/2026/06/13/asean-gcc-fta-indonesia-benefits.html",
        lean: "center",
      },
    ],
    neutralMd: `ASEAN and Gulf Cooperation Council (GCC) trade ministers agreed a preliminary FTA framework at the Riyadh summit. Key provisions: zero tariffs on halal-certified processed food and cosmetics, a joint energy corridor for LNG and renewables, and a digital-trade annex covering e-payment interoperability.

Al Jazeera leads with the geopolitical dimension (reducing US dollar dependence in trade settlement). Reuters focuses on the energy corridor linking Indonesia's LNG fields to GCC re-export hubs. Antara and Jakarta Post emphasise Indonesia's role as the largest ASEAN economy and halal-goods exporter.`,
    beginnerMd: `**What this means for you:** Indonesia is the world's largest Muslim-majority country and a big producer of halal food, cosmetics, and pharmaceuticals. Zero tariffs to Gulf countries mean Indonesian exporters face less cost — which could mean more jobs and foreign-exchange earnings.

**Simple chain:** FTA → cheaper Indonesian halal exports to Gulf → more export revenue → more jobs in halal industry → stronger current account.`,
    proMd: `**Quantification:** Indonesia's halal exports to GCC currently ~$3.2 bn/yr; FTA modelling suggests +$800 m–1.2 bn uplift over 5 years. LNG corridor: Bontang (Pertamina) + Tangguh (BP/CNOOC) have combined 23 MTPA capacity; GCC offtake agreements could lock in 3–5 MTPA.

**Risk:** Text not yet finalised; "framework" agreements routinely slip 18–36 months to ratification. Watch Indonesia's BPJPH halal-certification backlog (currently 14-month wait) as the operational bottleneck. Stocks: ICBP, MYOR (halal food); sector ETF: FTSE Indonesia.`,
    sentiment: "bullish",
    impactScore: 72,
    impactSummary:
      "An ASEAN-GCC trade framework could boost Indonesia's halal-goods exports and LNG revenues by over a billion dollars a year.",
    affectedRegions: ["Indonesia", "ASEAN", "Gulf Cooperation Council", "Middle East"],
    regionRelevance: 0.82,
  },

  // ─── 7. Coal export demand & China ──────────────────────────────────────────
  {
    id: "coal-china-demand",
    topic: "China's coal import surge lifts Indonesian thermal-coal prices — but for how long?",
    sourceCount: 6,
    leanSpread: { left: 2, center: 3, right: 1 },
    sources: [
      {
        source: "Reuters",
        url: "https://www.reuters.com/markets/commodities/china-coal-imports-indonesia-surge-2026-06/",
        lean: "center",
      },
      {
        source: "Bloomberg",
        url: "https://www.bloomberg.com/news/articles/2026-06-13/china-coal-imports-indonesia-june-2026",
        lean: "center",
      },
      {
        source: "Xinhua",
        url: "https://english.news.cn/2026-06/13/china-coal-imports-energy-security.htm",
        lean: "left",
      },
      {
        source: "Global Times",
        url: "https://www.globaltimes.cn/page/202606/china-coal-indonesia-energy.shtml",
        lean: "left",
      },
      {
        source: "CNBC Indonesia",
        url: "https://www.cnbcindonesia.com/market/2026061312000/batu-bara-china-harga-naik",
        lean: "center",
      },
      {
        source: "Kontan",
        url: "https://industri.kontan.co.id/news/batu-bara-china-indonesia-2026",
        lean: "center",
      },
    ],
    neutralMd: `China imported 47.3 million tonnes of coal in May 2026, up 18 % year-on-year, driven by a heatwave pushing power demand and hydro shortfalls in the south. Indonesia supplies ~62 % of China's seaborne thermal coal. Newcastle benchmark rallied to $132/t, an 8-month high.

Xinhua and Global Times frame the surge as "energy security diversification." Reuters and Bloomberg note the rally is likely temporary: China's domestic coal output is recovering, and new renewable capacity (120 GW/yr additions) structurally reduces import dependency. CNBC Indonesia and Kontan focus on windfall royalties for the state budget.`,
    beginnerMd: `**What this means for you:** Indonesia earns a huge amount from selling coal to China. When China needs more coal, prices go up and Indonesia earns more foreign currency. That helps the rupiah and fills the government's coffers with royalties. But coal demand will likely fall as China builds more solar and wind — so this is a short-term boost.

**Simple chain:** High coal price → more export revenue → stronger current account → rupiah support → more government royalties.`,
    proMd: `**Short-term:** At $132/t, Indonesia's coal export revenue runs at an annualised ~$38 bn. Every $10/t move = ~$3 bn annual revenue change. DMO (Domestic Market Obligation) at 25 % of output caps PLN supply at HBA price (~$70/t) — the gap is the coal windfall.

**Structural risk:** China's 2030 coal-consumption peak implies a secular demand decline. Indonesia's coal royalty receipts (15–20 % of mining revenue) fund ~8 % of the state budget — a transition fiscal risk. Watch ADARO (ADRO), ITMG, PTBA on IDX; DMO compliance announcements; and China's NPC energy directives for structural signals.`,
    sentiment: "bullish",
    impactScore: 76,
    impactSummary:
      "A China-driven coal price rally boosts Indonesia's export revenue and budget royalties, but structural demand decline looms beyond 2027.",
    affectedRegions: ["Indonesia", "China", "Asia-Pacific"],
    regionRelevance: 0.87,
  },
];

const BRIEFING: Briefing = {
  id: "demo-2026-06-13",
  date: "2026-06-13",
  headline: "Iran sanctions, nickel tariffs, and a sliding rupiah dominate Indonesia's economic outlook",
  overallSentiment: "bearish",
  beginnerMd: `Today's big picture: **three headwinds** are squeezing Indonesia's economy at once.

1. **Oil costs up** — US sanctions on Iran mean Pertamina pays more for crude, pushing fuel-subsidy costs higher.
2. **Nickel exports threatened** — US tariffs on China-processed Indonesian nickel put the country's top export earner at risk.
3. **Rupiah under pressure** — The US Federal Reserve kept rates high, making the dollar stronger and the rupiah weaker.

On the bright side, a delay in EU deforestation rules gives palm-oil farmers breathing room, China is buying more coal (good for royalties), and a new Gulf trade deal could open doors for halal exports.`,
  proMd: `**Macro read (bearish, -1.2σ vs 90-day baseline):** The triple headwind of USD-strength (DXY 104.8), commodity-price divergence (crude ↑, processed nickel ↓), and BI's constrained rate path creates the most adverse macro setup since Q4 2023.

Key risk cluster: IDR/USD > 16,350 triggers SBN outflow and forces BI's hand on rates, compressing the growth outlook. Offset: CPO and coal windfalls improve the current account by ~$1.5 bn/month at current prices. Net: cautious — watch BI's June 26 RDG for the policy pivot signal.`,
  storyIds: [
    "iran-oil-sanctions",
    "us-china-tariffs-nickel",
    "fed-rates-bi-response",
    "rupiah-bi-intervention",
    "palm-oil-eu-deforestation",
    "coal-china-demand",
    "asean-gcc-trade-pact",
  ],
};

export class SeedDataSource implements DataSource {
  async latestBriefing(): Promise<Briefing | null> { return BRIEFING; }

  async briefingByDate(date: string): Promise<Briefing | null> {
    return date === BRIEFING.date ? BRIEFING : null;
  }

  async recentBriefings(limit: number): Promise<Briefing[]> {
    return [BRIEFING].slice(0, limit);
  }

  async storyById(id: string): Promise<Story | null> {
    return STORIES.find((s) => s.id === id) ?? null;
  }

  async storiesByIds(ids: string[]): Promise<Story[]> {
    return STORIES.filter((s) => ids.includes(s.id));
  }

  async rankedStories(limit: number): Promise<Story[]> {
    return [...STORIES]
      .sort((a, b) => b.impactScore * b.regionRelevance - a.impactScore * a.regionRelevance)
      .slice(0, limit);
  }

  async storiesInRange(_days: number): Promise<Story[]> {
    // Spread the demo stories across recent days (2 per day) so the weekly view
    // has something to group when running on seed content.
    const [y, m, d] = BRIEFING.date.split("-").map(Number);
    return [...STORIES]
      .sort((a, b) => b.impactScore * b.regionRelevance - a.impactScore * a.regionRelevance)
      .map((s, i) => {
        const dt = new Date(y, m - 1, d - Math.floor(i / 2));
        const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
          dt.getDate(),
        ).padStart(2, "0")}`;
        return { ...s, date: iso };
      });
  }
}
