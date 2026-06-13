"use client";
import { useState } from "react";
import { Markdown } from "./Markdown";

export function LayerToggle({ beginnerMd, proMd }: { beginnerMd: string; proMd: string }) {
  const [pro, setPro] = useState(false);
  return (
    <div>
      <Markdown>{pro ? proMd : beginnerMd}</Markdown>
      <button
        onClick={() => setPro((v) => !v)}
        className="mt-2 text-sm font-medium text-blue-600 hover:underline"
      >
        {pro ? "← Simpler" : "Go deeper →"}
      </button>
    </div>
  );
}
