import type { Lang } from "./lang";

// Static UI-chrome strings in the three supported languages. Content (stories/briefings)
// is translated separately in the DB; this is only the interface labels.
type Str = Record<Lang, string>;
const S = {
  // utility / masthead / nav
  tagline_top: { en: "AI-powered economic briefing", id: "Ringkasan ekonomi bertenaga AI", zh: "AI 驱动的经济简报" },
  masthead_sub: {
    en: "The world's news — clustered & explained through an economic lens",
    id: "Berita dunia — dikelompokkan & dijelaskan lewat lensa ekonomi",
    zh: "世界新闻 —— 以经济视角聚合与解读",
  },
  nav_today: { en: "Today", id: "Hari Ini", zh: "今天" },
  nav_week: { en: "This Week", id: "Pekan Ini", zh: "本周" },
  nav_archive: { en: "Archive", id: "Arsip", zh: "存档" },
  nav_ask: { en: "Ask", id: "Tanya", zh: "提问" },
  nav_sources: { en: "Sources", id: "Sumber", zh: "来源" },
  nav_how: { en: "How it works", id: "Cara kerja", zh: "运作方式" },
  footer_disclaimer_a: { en: "Bias ratings and the “neutral” view are", id: "Penilaian bias dan pandangan “netral” adalah", zh: "偏向评级与“中立”观点均为" },
  footer_ai: { en: "AI assessments, not fact", id: "penilaian AI, bukan fakta", zh: "AI 评估，并非事实" },
  footer_edu: { en: "Analysis is for education", id: "Analisis untuk edukasi", zh: "分析仅供学习" },
  footer_notadvice: { en: "not financial advice", id: "bukan nasihat keuangan", zh: "并非投资建议" },
  // home
  todays_briefing: { en: "Today's Briefing", id: "Ringkasan Hari Ini", zh: "今日简报" },
  todays_stories: { en: "Today's stories", id: "Berita hari ini", zh: "今日新闻" },
  ranked_by: { en: "Ranked by impact × Indonesia relevance", id: "Diurutkan berdasarkan dampak × relevansi Indonesia", zh: "按影响力 × 印尼相关性排序" },
  no_briefing: { en: "No briefing yet today", id: "Belum ada ringkasan hari ini", zh: "今天还没有简报" },
  no_briefing_sub: { en: "The AI pipeline runs each morning. Check back soon.", id: "Pipeline AI berjalan tiap pagi. Cek lagi nanti.", zh: "AI 流程每天早晨运行，请稍后再来。" },
  no_stories: { en: "No stories available yet.", id: "Belum ada berita.", zh: "暂无新闻。" },
  // story
  lbl_story: { en: "Story", id: "Berita", zh: "新闻" },
  econ_outlook: { en: "Economic outlook", id: "Prospek ekonomi", zh: "经济前景" },
  how_big: { en: "How big a deal", id: "Seberapa penting", zh: "影响有多大" },
  affects: { en: "Affects", id: "Memengaruhi", zh: "影响" },
  means_for_you: { en: "What this means for you", id: "Apa artinya bagi Anda", zh: "这对您意味着什么" },
  plain_read: { en: "Plain-language economic read", id: "Ulasan ekonomi bahasa sederhana", zh: "通俗经济解读" },
  bias_spread: { en: "Media bias spread", id: "Sebaran bias media", zh: "媒体倾向分布" },
  neutral_read: { en: "The neutral read", id: "Ulasan netral", zh: "中立解读" },
  original_sources: { en: "Original sources", id: "Sumber asli", zh: "原始来源" },
  outlets_ratings: { en: "outlets · AI bias ratings", id: "media · penilaian bias AI", zh: "家媒体 · AI 偏向评级" },
  sources_disclaimer: { en: "Bias ratings are AI assessments of framing — not objective or final. Links open in a new tab.", id: "Penilaian bias adalah asesmen AI atas framing — tidak objektif atau final. Tautan terbuka di tab baru.", zh: "偏向评级是 AI 对报道框架的评估 —— 并非客观或最终结论。链接在新标签页打开。" },
  // week
  week_kicker: { en: "This Week", id: "Pekan Ini", zh: "本周" },
  week_title: { en: "The week in world & finance", id: "Sepekan dunia & keuangan", zh: "本周世界与财经" },
  week_intro: { en: "Every story analysed over the last seven days, grouped by the day it was published and ranked within each day by impact × Indonesia-relevance.", id: "Semua berita yang dianalisis dalam tujuh hari terakhir, dikelompokkan per hari terbit dan diurutkan tiap hari berdasarkan dampak × relevansi Indonesia.", zh: "过去七天分析的所有新闻，按发布日期分组，并在每天内按影响力 × 印尼相关性排序。" },
  week_empty: { en: "No analysed stories in the last seven days yet.", id: "Belum ada berita yang dianalisis dalam tujuh hari terakhir.", zh: "过去七天还没有已分析的新闻。" },
  story_one: { en: "story", id: "berita", zh: "条" },
  story_many: { en: "stories", id: "berita", zh: "条" },
  // archive
  arch_kicker: { en: "Archive", id: "Arsip", zh: "存档" },
  arch_title: { en: "Past briefings", id: "Ringkasan terdahulu", zh: "往期简报" },
  arch_intro: { en: "Every daily briefing, archived. Each links to the stories and sources from that day.", id: "Setiap ringkasan harian, terarsip. Tiap entri menautkan ke berita dan sumber hari itu.", zh: "每日简报存档，每条链接到当天的新闻与来源。" },
  arch_empty: { en: "No past briefings found.", id: "Tidak ada ringkasan terdahulu.", zh: "没有往期简报。" },
  // layer toggle
  go_deeper: { en: "Go deeper — the pro read →", id: "Lebih dalam — ulasan pro →", zh: "深入了解 — 专业版 →" },
  simpler: { en: "← Simpler", id: "← Lebih sederhana", zh: "← 简化版" },
  // sentiment (economic outlook)
  sent_pos: { en: "Positive", id: "Positif", zh: "利好" },
  sent_mixed: { en: "Mixed", id: "Campuran", zh: "中性" },
  sent_neg: { en: "Negative", id: "Negatif", zh: "利空" },
  sent_pos_gloss: { en: "good for growth / your costs", id: "baik untuk pertumbuhan / biaya Anda", zh: "利于增长 / 您的开支" },
  sent_mixed_gloss: { en: "balanced or unclear", id: "seimbang atau belum jelas", zh: "中性或不明朗" },
  sent_neg_gloss: { en: "a headwind — watch your costs", id: "angin sakal — perhatikan biaya Anda", zh: "逆风 —— 留意开支" },
  // impact tiers + caption
  impact_high: { en: "High impact", id: "Dampak tinggi", zh: "高影响" },
  impact_mod: { en: "Moderate impact", id: "Dampak sedang", zh: "中等影响" },
  impact_low: { en: "Low impact", id: "Dampak rendah", zh: "低影响" },
  impact_caption: { en: "How much this could affect Indonesia's economy and your costs (0–100).", id: "Seberapa besar ini bisa memengaruhi ekonomi Indonesia dan biaya Anda (0–100).", zh: "这对印尼经济与您的开支可能有多大影响（0–100）。" },
  impact_word: { en: "Impact", id: "Dampak", zh: "影响" },
  // bias spread + sources
  framed_by: { en: "How {n} outlets framed it", id: "Bagaimana {n} media membingkainya", zh: "{n} 家媒体如何报道" },
  lean_left: { en: "left", id: "kiri", zh: "左倾" },
  lean_center: { en: "centre", id: "tengah", zh: "中立" },
  lean_right: { en: "right", id: "kanan", zh: "右倾" },
  lean_left_long: { en: "left-leaning", id: "condong kiri", zh: "左倾" },
  lean_center_long: { en: "centre", id: "tengah", zh: "中立" },
  lean_right_long: { en: "right-leaning", id: "condong kanan", zh: "右倾" },
  bias_short_disclaimer: { en: "AI assessment of framing — not an objective rating.", id: "Asesmen AI atas framing — bukan penilaian objektif.", zh: "AI 对报道框架的评估 —— 并非客观评级。" },
  sources_word: { en: "sources", id: "sumber", zh: "来源" },
  // update button
  update_news: { en: "Update news", id: "Perbarui berita", zh: "更新新闻" },
  update_running: { en: "Updating…", id: "Memperbarui…", zh: "更新中…" },
  update_started: { en: "Update started — new stories arrive in a few minutes.", id: "Pembaruan dimulai — berita baru muncul dalam beberapa menit.", zh: "更新已开始 —— 新闻将在几分钟内出现。" },
  update_inprogress: { en: "An update is already running.", id: "Pembaruan sedang berjalan.", zh: "更新已在进行中。" },
  update_offline: { en: "Update engine offline.", id: "Mesin pembaruan tak aktif.", zh: "更新引擎离线。" },
} satisfies Record<string, Str>;

export type UIKey = keyof typeof S;
export function t(lang: Lang, key: UIKey): string {
  return S[key][lang] ?? S[key].en;
}
