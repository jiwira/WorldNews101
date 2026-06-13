"use client";
import { useState } from "react";
import { Markdown } from "./Markdown";

export function LayerToggle({ beginnerMd, proMd }: { beginnerMd: string; proMd: string }) {
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
          {pro ? "← Simpler" : "Go deeper — the pro read →"}
        </button>
      )}
    </div>
  );
}
