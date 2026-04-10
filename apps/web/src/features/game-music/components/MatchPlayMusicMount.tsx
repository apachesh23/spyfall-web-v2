"use client";

import { useEffect, useRef } from "react";
import { startGameMusic, stopGameMusic, stopVoteMusic } from "@/lib/sound";

/**
 * Страница /play: фоновая игровая музыка после первого жеста (как в лобби).
 * Переключение на vote1/vote2 и обратно — в `MatchScreen` (Colyseus phase / voteStage).
 */
export function MatchPlayMusicMount() {
  const authorized = useRef(false);
  const startedAfterGesture = useRef(false);

  useEffect(() => {
    const onUserInteraction = () => {
      if (!authorized.current) {
        authorized.current = true;
      }
      if (document.visibilityState !== "visible") return;
      if (!startedAfterGesture.current) {
        startGameMusic();
        startedAfterGesture.current = true;
      }
    };

    document.addEventListener("click", onUserInteraction, { passive: true });
    document.addEventListener("touchend", onUserInteraction, { passive: true });
    document.addEventListener("keydown", onUserInteraction, { passive: true });

    const handleVisibility = () => {
      if (!authorized.current) return;
      if (document.visibilityState === "hidden") {
        if (startedAfterGesture.current) {
          stopGameMusic();
          stopVoteMusic();
          startedAfterGesture.current = false;
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stopGameMusic();
      stopVoteMusic();
      startedAfterGesture.current = false;
      document.removeEventListener("click", onUserInteraction);
      document.removeEventListener("touchend", onUserInteraction);
      document.removeEventListener("keydown", onUserInteraction);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return null;
}
