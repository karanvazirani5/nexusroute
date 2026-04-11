"use client";

export function CommandPaletteTrigger() {
  return (
    <button
      type="button"
      onClick={() => {
        const ev = new KeyboardEvent("keydown", {
          key: "k",
          metaKey: true,
          bubbles: true,
        });
        window.dispatchEvent(ev);
      }}
      className="hidden items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[11px] text-zinc-500 transition-colors hover:border-white/10 hover:text-zinc-300 md:inline-flex"
    >
      <svg
        className="h-3 w-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <circle cx="11" cy="11" r="7" strokeWidth="2" />
        <path strokeWidth="2" d="M21 21l-4-4" />
      </svg>
      <span>Jump to…</span>
      <kbd className="ml-1 rounded border border-white/10 bg-white/[0.04] px-1 text-[9px]">
        ⌘K
      </kbd>
    </button>
  );
}
