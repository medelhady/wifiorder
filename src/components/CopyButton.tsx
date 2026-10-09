"use client";

import { useState } from "react";

// زر نسخ صغير بجانب أي معلومة: ينسخ قيمتها فقط، ويتحول لعلامة ✓ لحظة النسخ
export default function CopyButton({
  value,
  label,
}: {
  value: string | null | undefined;
  label?: string;
}) {
  const [done, setDone] = useState(false);
  const text = (value ?? "").trim();

  // Nothing to copy, nothing to show.
  if (!text) return null;

  async function copy(event: React.MouseEvent) {
    event.stopPropagation();

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Older browsers, or a page that may not use the clipboard: the long way round.
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand("copy");
      } catch {
        /* nothing more to try */
      }
      area.remove();
    }

    setDone(true);
    setTimeout(() => setDone(false), 1500);
  }

  const title = done ? "تم النسخ" : `نسخ${label ? ` ${label}` : ""}`;

  return (
    <button
      type="button"
      className={`copy-btn${done ? " done" : ""}`}
      onClick={copy}
      title={title}
      aria-label={title}
    >
      {done ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="12" height="12" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      )}
    </button>
  );
}
