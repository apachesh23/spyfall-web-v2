"use client";

import React, { useEffect } from "react";
import {
  motion,
  useReducedMotion,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion";
import stripStyles from "./votingDecoPrimitives.module.css";
import type {
  MatchVotingDecoConfig,
  MatchVotingDecoLayerTransform,
  MatchVotingDecoTextConfig,
} from "../voting.config";

export type MarqueeDirection = "left" | "right";

const STRIP_TEXT_REPEAT = 18;

export const STRIPE_OPEN_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const STRIPE_CLOSE_EASE: [number, number, number, number] = [0.42, 0, 0.95, 0.38];

export function hudCompositionWrapStyle(cfg: MatchVotingDecoConfig): React.CSSProperties {
  const h = cfg.hudComposition;
  if (h.anchor === "bottomCenter") {
    return {
      left: "50%",
      bottom: `${h.positionYPx}px`,
      top: "auto",
      right: "auto",
      transform: `translateX(calc(-50% + ${h.positionXPx}px)) rotate(${h.globalRotateDeg}deg)`,
      transformOrigin: "bottom center",
    };
  }
  if (h.anchor === "bottomRight") {
    return {
      right: `${h.positionXPx}px`,
      bottom: `${h.positionYPx}px`,
      top: "auto",
      left: "auto",
      transform: `rotate(${h.globalRotateDeg}deg)`,
      transformOrigin: "bottom right",
    };
  }
  if (h.anchor === "bottomLeft") {
    return {
      left: `${h.positionXPx}px`,
      bottom: `${h.positionYPx}px`,
      top: "auto",
      right: "auto",
      transform: `rotate(${h.globalRotateDeg}deg)`,
      transformOrigin: "bottom left",
    };
  }
  return {
    left: `${h.positionXPx}px`,
    top: `${h.positionYPx}px`,
    bottom: "auto",
    right: "auto",
    transform: `rotate(${h.globalRotateDeg}deg)`,
    transformOrigin: "top left",
  };
}

export function hudScaleTransformOrigin(cfg: MatchVotingDecoConfig): string {
  switch (cfg.hudComposition.anchor) {
    case "bottomLeft":
      return "bottom left";
    case "bottomCenter":
      return "bottom center";
    case "bottomRight":
      return "bottom right";
    default:
      return "top left";
  }
}

export function DecoStripWithComposeTransform({
  layerTransform,
  initialEnterX,
  durationSec,
  delaySec = 0,
  exitDurationSec,
  exitDelaySec = 0,
  isExiting,
  reduceMotion,
  children,
}: {
  layerTransform: MatchVotingDecoLayerTransform;
  initialEnterX: number;
  durationSec: number;
  delaySec?: number;
  exitDurationSec?: number;
  exitDelaySec?: number;
  isExiting: boolean;
  reduceMotion: boolean | null;
  children: React.ReactNode;
}) {
  const enter = useMotionValue(reduceMotion ? 0 : initialEnterX);

  useEffect(() => {
    if (reduceMotion) {
      enter.set(isExiting ? -initialEnterX : 0);
      return;
    }
    if (isExiting) {
      const ctrl = animate(enter, -initialEnterX, {
        duration: exitDurationSec ?? durationSec,
        delay: exitDelaySec,
        ease: STRIPE_CLOSE_EASE,
      });
      return () => ctrl.stop();
    }
    enter.set(initialEnterX);
    const ctrl = animate(enter, 0, {
      duration: durationSec,
      delay: delaySec,
      ease: STRIPE_OPEN_EASE,
    });
    return () => ctrl.stop();
  }, [
    reduceMotion,
    isExiting,
    initialEnterX,
    durationSec,
    delaySec,
    exitDelaySec,
    exitDurationSec,
    enter,
  ]);

  const { x, y, rotateDeg } = layerTransform;
  const transform = useTransform(
    enter,
    (ex) =>
      `translate3d(${x}px, ${y}px, 0) rotate(${rotateDeg}deg) translate3d(${ex}px, 0, 0)`,
  );

  return (
    <motion.div className={stripStyles.mediaDecoLayerTransform} style={{ transform }}>
      {children}
    </motion.div>
  );
}

function DecoRepeatingPhrase({
  label,
  textCfg,
}: {
  label: string;
  textCfg: MatchVotingDecoTextConfig;
}) {
  return (
    <div className={stripStyles.mediaDecoRepeatedRow}>
      {Array.from({ length: STRIP_TEXT_REPEAT }, (_, i) => (
        <React.Fragment key={i}>
          {i > 0 ? (
            <div
              className={stripStyles.mediaDecoDotCircle}
              style={{
                width: textCfg.dotDiameter,
                height: textCfg.dotDiameter,
                marginLeft: textCfg.phraseDotGap,
                marginRight: textCfg.phraseDotGap,
              }}
              aria-hidden
            />
          ) : null}
          <span
            className={stripStyles.mediaDecoRepeatedPhrase}
            style={{ fontSize: textCfg.phraseFontSize }}
          >
            {label}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

function DecoMarqueePhraseDot({ textCfg }: { textCfg: MatchVotingDecoTextConfig }) {
  return (
    <div
      className={stripStyles.mediaDecoDotCircle}
      style={{
        width: textCfg.dotDiameter,
        height: textCfg.dotDiameter,
        marginLeft: textCfg.phraseDotGap,
        marginRight: textCfg.phraseDotGap,
      }}
      aria-hidden
    />
  );
}

export function DecoMarqueeStripText({
  label,
  textCfg,
  direction,
  loopDurationSec,
}: {
  label: string;
  textCfg: MatchVotingDecoTextConfig;
  direction: MarqueeDirection;
  loopDurationSec: number;
}) {
  const trackClass =
    direction === "right"
      ? `${stripStyles.mediaDecoMarqueeTrack} ${stripStyles.mediaDecoMarqueeTrackRight}`
      : `${stripStyles.mediaDecoMarqueeTrack} ${stripStyles.mediaDecoMarqueeTrackLeft}`;

  const tile = (
    <div className={stripStyles.mediaDecoMarqueeSegment} aria-hidden>
      <DecoRepeatingPhrase label={label} textCfg={textCfg} />
      <DecoMarqueePhraseDot textCfg={textCfg} />
    </div>
  );

  return (
    <div
      className={trackClass}
      style={
        {
          "--marquee-duration": `${loopDurationSec}s`,
        } as React.CSSProperties
      }
    >
      {tile}
      {tile}
    </div>
  );
}

export { useReducedMotion };
