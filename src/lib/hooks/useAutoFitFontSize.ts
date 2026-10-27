"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Shrinks an element's font-size (down to minPx) so its nowrap content
 * fits within its parent's width — used for translated labels whose
 * length varies a lot by language (Korean fits at basePx, other
 * languages may need a smaller size to stay on one line).
 */
export function useAutoFitFontSize<T extends HTMLElement>(
  deps: unknown[],
  basePx: number,
  minPx: number,
) {
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;

    const fit = () => {
      const available = parent.clientWidth;
      if (available <= 0) return;
      let size = basePx;
      el.style.fontSize = `${size}px`;
      while (el.scrollWidth > available && size > minPx) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
      }
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(parent);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}
