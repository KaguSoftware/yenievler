/**
 * Empty scroll with no text on it. The camera keeps falling and the background colour changes
 * here, so no copy is ever caught mid-transition. Collapsed when there is no 3D world.
 */
export function Spacer({ id, className = "" }: { id: string; className?: string }) {
  return <div data-station={id} aria-hidden className={`hidden world:block motion-reduce:h-[calc(var(--svh)*100)]! ${className}`} />;
}
