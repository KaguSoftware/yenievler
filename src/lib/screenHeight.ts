/**
 * Pins an element sized in viewport units (svh, lvh) to the height in px it has now, and reads it
 * again only when the screen really changes: a rotation, split screen, a desktop window drag.
 *
 * A phone's toolbar slides in and out as the page scrolls, which changes the window's height alone,
 * by well under 160px. svh and lvh are meant to ignore that, but Chrome and the other third-party
 * browsers on iOS (and some iOS 26 Safari builds) let it through, so a canvas sized in them changes
 * aspect mid-scroll and the shot reframes. Pinned, it does not move.
 *
 * `grow`: also re-pin when the window gets taller than the element (for a canvas that must cover
 * the screen; with working lvh it is already as tall as the window can get, so this never fires).
 * `onChange` runs after each re-pin. Returns the cleanup.
 */
export function pinScreenHeight(el: HTMLElement, { grow = false, onChange = () => {} } = {}) {
  const touch = window.matchMedia("(pointer: coarse)").matches;
  let w = -1;
  let h = 0;
  const pin = () => {
    const iw = window.innerWidth;
    const ih = window.innerHeight;
    const toolbar = touch && iw === w && Math.abs(ih - h) < 160;
    if (toolbar && !(grow && ih > el.offsetHeight)) return;
    w = iw;
    h = ih;
    el.style.height = "";
    el.style.height = `${grow ? Math.max(el.offsetHeight, ih) : el.offsetHeight}px`;
    onChange();
  };
  pin();
  window.addEventListener("resize", pin);
  return () => {
    window.removeEventListener("resize", pin);
    el.style.height = "";
  };
}
