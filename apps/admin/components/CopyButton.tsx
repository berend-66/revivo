"use client";

import { useState } from "react";

export function CopyButton({
  text,
  label = "Kopieer",
  className = "btn btn-sm",
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard blocked — operator can select the text manually */
        }
      }}
    >
      {copied ? "Gekopieerd ✓" : label}
    </button>
  );
}
