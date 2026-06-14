"use client";
import { useRouter } from "next/navigation";
import { LANGS, type Lang } from "@/lib/lang";

export function LanguageToggle({ current }: { current: Lang }) {
  const router = useRouter();

  function choose(code: Lang) {
    if (code === current) return;
    document.cookie = `lang=${code}; path=/; max-age=31536000; samesite=lax`;
    router.refresh(); // re-render server components with the new cookie
  }

  return (
    <div className="flex items-center gap-2">
      {LANGS.map(({ code, label }, i) => (
        <span key={code} className="flex items-center gap-2">
          {i > 0 && <span className="text-paper/30" aria-hidden>·</span>}
          <button
            onClick={() => choose(code)}
            aria-current={current === code}
            className={`kicker transition-colors ${
              current === code ? "text-gold" : "text-paper/60 hover:text-paper"
            }`}
          >
            {label}
          </button>
        </span>
      ))}
    </div>
  );
}
