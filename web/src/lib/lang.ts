// Client-safe language constants/types (no server-only imports — used by the toggle too).
export type Lang = "en" | "id" | "zh";

export const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "id", label: "ID" },
  { code: "zh", label: "中文" },
];

export function normalizeLang(v: string | undefined | null): Lang {
  return v === "id" || v === "zh" ? v : "en";
}
