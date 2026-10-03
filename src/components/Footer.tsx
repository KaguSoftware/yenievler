export function Footer() {
  return (
    <footer className="overflow-hidden bg-ink px-[var(--pad)] pt-[clamp(48px,6vw,80px)] pb-9 text-paper">
      <div
        aria-hidden
        className="display -ml-[0.05em] text-[clamp(60px,22vw,140px)] sm:text-[clamp(88px,24vw,560px)] leading-[0.8] tracking-[-0.06em] text-signal"
        style={{ fontWeight: 900 }}
      >
        nimbo
      </div>
      <div className="mt-8 flex flex-wrap justify-between gap-x-8 gap-y-4 text-[14px] text-paper/60">
        <span>© 2026 Nimbo. Showers, basins, taps and baths.</span>
        <div className="flex flex-wrap gap-x-7 gap-y-2">
          <a href="mailto:trade@nimbo.example" className="hover:text-paper">Trade programme</a>
          <a href="mailto:care@nimbo.example" className="hover:text-paper">Care and warranty</a>
          <a href="#top" className="hover:text-paper">Back to top</a>
        </div>
      </div>
    </footer>
  );
}
