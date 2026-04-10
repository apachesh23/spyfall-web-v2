"use client";

import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { playVFX } from "@/lib/sound";
import {
  DecoMarqueeStripText,
  DecoStripWithComposeTransform,
} from "../votingDecoPrimitives";
import stripStyles from "../votingDecoPrimitives/votingDecoPrimitives.module.css";
import type { MatchVotingDecoConfig } from "../voting.config";
import { VOTING_STRIPE_ASSETS } from "../voting.config";

export type VotingHeadlineStripsProps = {
  decoConfig: MatchVotingDecoConfig;
  openStripEnterOffsetPx: number;
  durationSec: number;
  closeDurationSec?: number;
  closeDelayTopSec?: number;
  /** Текст верхней бегущей строки (например РАУНД 1 / РАУНД 2). */
  roundMarqueeLabel: string;
  /** Текст на нижней полоске композиции (ГОЛОСОВАНИЕ / ФИНАЛЬНОЕ ГОЛОСОВАНИЕ). */
  headlineMarqueeLabel: string;
  /** Обычная или финальная полоска (разные webp). Тень одна и та же. */
  stripeImageSrc?: string;
  shadowImageSrc?: string;
  reduceMotion: boolean | null;
  /**
   * Пока корень голосования на экране: false — уезжают анимацией и группа размонтируется после exit.
   */
  visible: boolean;
  /** Явный флаг выхода корневого оверлея (`MatchVoteRoot` в exit). */
  isOverlayExiting?: boolean;
};

function HeadlineStripsGroup({
  decoConfig,
  openStripEnterOffsetPx,
  durationSec,
  closeDurationSec,
  closeDelayTopSec,
  roundMarqueeLabel,
  headlineMarqueeLabel,
  stripeImageSrc,
  shadowImageSrc,
  reduceMotion,
  isExiting,
}: Omit<VotingHeadlineStripsProps, "visible"> & { isExiting: boolean }) {
  const isStripExit = isExiting;
  const decoTextCfg = decoConfig.text;
  const decoMarqueeCfg = decoConfig.marquee;
  const stripe = stripeImageSrc ?? VOTING_STRIPE_ASSETS.regular;
  const shadow = shadowImageSrc ?? VOTING_STRIPE_ASSETS.shadow;

  return (
    <div
      className={stripStyles.mediaDecoRotateWrap}
      aria-hidden
      style={{
        top: `${decoConfig.compositionPositionYPx}px`,
        left: `${decoConfig.compositionPositionXPx}px`,
        transform: `rotate(${decoConfig.compositionGlobalRotateDeg}deg)`,
        transformOrigin: "top left",
      }}
    >
      <div
        className={stripStyles.mediaDecoScaleRoot}
        style={{
          transform: `scale(${decoConfig.compositionScale})`,
          transformOrigin: "top left",
        }}
      >
        <div
          className={stripStyles.mediaDecoStack}
          style={
            {
              "--composition-design-width-px": `${decoConfig.compositionDesignWidthPx}px`,
              height: `${decoConfig.compositionDesignHeightPx}px`,
            } as React.CSSProperties
          }
        >
          <div className={stripStyles.mediaDecoLayers}>
            <div
              className={`${stripStyles.mediaDecoLayer} ${stripStyles.mediaDecoLayerBottomStripe}`}
            >
              <DecoStripWithComposeTransform
                layerTransform={decoConfig.bottom.stripe}
                initialEnterX={openStripEnterOffsetPx}
                durationSec={durationSec}
                exitDurationSec={closeDurationSec}
                exitDelaySec={0}
                isExiting={isStripExit}
                reduceMotion={reduceMotion}
              >
                <div className={stripStyles.mediaDecoStripUnit}>
                  <img src={stripe} alt="" className={stripStyles.mediaDecoImg} draggable={false} />
                  <div className={stripStyles.mediaDecoTextOnStripe} aria-hidden>
                    <DecoMarqueeStripText
                      label={headlineMarqueeLabel}
                      textCfg={decoTextCfg}
                      direction="left"
                      loopDurationSec={decoMarqueeCfg.bottomLoopDurationSec}
                    />
                  </div>
                  <img
                    src={shadow}
                    alt=""
                    className={stripStyles.mediaDecoImg}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      pointerEvents: "none",
                    }}
                    draggable={false}
                  />
                </div>
              </DecoStripWithComposeTransform>
            </div>

            <div
              className={`${stripStyles.mediaDecoLayer} ${stripStyles.mediaDecoLayerTopStripe}`}
            >
              <DecoStripWithComposeTransform
                layerTransform={decoConfig.top.stripe}
                initialEnterX={-openStripEnterOffsetPx}
                durationSec={durationSec}
                delaySec={0.08}
                exitDurationSec={closeDurationSec}
                exitDelaySec={closeDelayTopSec ?? 0.08}
                isExiting={isStripExit}
                reduceMotion={reduceMotion}
              >
                <div className={stripStyles.mediaDecoStripUnit}>
                  <img src={stripe} alt="" className={stripStyles.mediaDecoImg} draggable={false} />
                  <div className={stripStyles.mediaDecoTextOnStripe} aria-hidden>
                    <DecoMarqueeStripText
                      label={roundMarqueeLabel}
                      textCfg={decoTextCfg}
                      direction="right"
                      loopDurationSec={decoMarqueeCfg.topLoopDurationSec}
                    />
                  </div>
                </div>
              </DecoStripWithComposeTransform>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VotingHeadlineStrips({ visible, ...rest }: VotingHeadlineStripsProps) {
  const {
    durationSec,
    closeDurationSec,
    closeDelayTopSec,
    isOverlayExiting = false,
  } = rest;
  const [shouldRender, setShouldRender] = useState(visible);
  const prevVisibleRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (prevVisibleRef.current === null) {
      prevVisibleRef.current = visible;
      return;
    }
    if (prevVisibleRef.current !== visible) {
      prevVisibleRef.current = visible;
      playVFX(visible ? "woosh_in" : "woosh_out");
    }
  }, [visible]);

  const exitWindowMs = useMemo(() => {
    const closeSec = closeDurationSec ?? durationSec;
    const delaySec = closeDelayTopSec ?? 0.08;
    return Math.max(0, Math.ceil((closeSec + delaySec) * 1000));
  }, [durationSec, closeDurationSec, closeDelayTopSec]);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      return;
    }
    if (!shouldRender) return;
    const timeoutId = window.setTimeout(() => {
      setShouldRender(false);
    }, exitWindowMs);
    return () => window.clearTimeout(timeoutId);
  }, [visible, shouldRender, exitWindowMs]);

  if (!shouldRender) return null;

  return (
    <HeadlineStripsGroup
      {...rest}
      isExiting={isOverlayExiting || !visible}
    />
  );
}
