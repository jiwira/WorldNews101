"use client";
import { useState } from "react";
import { Markdown } from "./Markdown";
import { t } from "@/lib/ui";
import type { Lang } from "@/lib/lang";

export function LayerToggle({
  beginnerMd,
  proMd,
  lang = "en",
}: {
  beginnerMd: string;
  proMd: string;
  lang?: Lang;
}) {
  const [pro, setPro] = useState(false);
  const hasLayers = proMd.trim().length > 0 && proMd.trim() !== beginnerMd.trim();

  return (
    <div>
      <Markdown>{pro && hasLayers ? proMd : beginnerMd}</Markdown>
      {hasLayers && (
        <button
          onClick={() => setPro((v) => !v)}
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-brand transition-colors hover:text-gold"
        >
          {pro ? t(lang, "simpler") : t(lang, "go_deeper")}
        </button>
      )}
    </div>
  );
}
