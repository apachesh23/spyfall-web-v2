"use client";

import { useEffect } from "react";

const BODY_ATTR = "data-match-paused-grayscale";

type MatchPauseGrayscaleOverlayProps = {
  active: boolean;
};

/**
 * Ч/б при паузе: `body[data-match-paused-grayscale]` + `data-play-pause-filter`
 * на фоне Backdrop и колонке игры (без TopBar). См. globals.css.
 */
export function MatchPauseGrayscaleOverlay({ active }: MatchPauseGrayscaleOverlayProps) {
  useEffect(() => {
    if (!active) {
      document.body.removeAttribute(BODY_ATTR);
      return;
    }
    document.body.setAttribute(BODY_ATTR, "1");
    return () => {
      document.body.removeAttribute(BODY_ATTR);
    };
  }, [active]);

  return null;
}
