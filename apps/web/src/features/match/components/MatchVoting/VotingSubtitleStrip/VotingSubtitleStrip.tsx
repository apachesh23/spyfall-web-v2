"use client";

import type React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  DecoStripWithComposeTransform,
  hudCompositionWrapStyle,
  hudScaleTransformOrigin,
} from "../votingDecoPrimitives";
import stripStyles from "../votingDecoPrimitives/votingDecoPrimitives.module.css";
import type { MatchVotingDecoConfig } from "../voting.config";
import { VOTING_STRIPE_ASSETS } from "../voting.config";

export type VotingSubtitleStripProps = {
  decoConfig: MatchVotingDecoConfig;
  openStripEnterOffsetPx: number;
  durationSec: number;
  closeDurationSec?: number;
  closeDelayTopSec?: number;
  /** Синхронно с закрытием корневого оверлея (уход полосок). */
  isOverlayExiting: boolean;
  reduceMotion: boolean | null;
  displayLabel: string;
  displayNumber: number;
  showNumber: boolean;
  showResultCountdown: boolean;
  phraseFontSize: string;
  stripeImageSrc?: string;
  shadowImageSrc?: string;
};

const LAST_SECONDS_ANIMATED = 10;

export function VotingSubtitleStrip({
  decoConfig,
  openStripEnterOffsetPx,
  durationSec,
  closeDurationSec,
  closeDelayTopSec,
  isOverlayExiting,
  reduceMotion,
  displayLabel,
  displayNumber,
  showNumber,
  showResultCountdown,
  phraseFontSize,
  stripeImageSrc,
  shadowImageSrc,
}: VotingSubtitleStripProps) {
  const hudBottomTf =
    decoConfig.hudComposition.bottomStripe ?? decoConfig.bottom.stripe;
  const hudTopTf = decoConfig.hudComposition.topStripe ?? decoConfig.top.stripe;
  const hudCompositionScale = decoConfig.hudComposition.compositionScale;
  const stripe = stripeImageSrc ?? VOTING_STRIPE_ASSETS.regular;
  const shadow = shadowImageSrc ?? VOTING_STRIPE_ASSETS.shadow;

  return (
    <div
      className={`${stripStyles.mediaDecoRotateWrap} ${stripStyles.mediaDecoRotateWrapHud}`}
      data-voting-subtitle-strip
      style={hudCompositionWrapStyle(decoConfig)}
    >
      <div
        className={stripStyles.mediaDecoScaleRoot}
        style={{
          transform: `scale(${hudCompositionScale})`,
          transformOrigin: hudScaleTransformOrigin(decoConfig),
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
                layerTransform={hudBottomTf}
                initialEnterX={openStripEnterOffsetPx}
                durationSec={durationSec}
                exitDurationSec={closeDurationSec}
                exitDelaySec={0}
                isExiting={isOverlayExiting}
                reduceMotion={reduceMotion}
              >
                <div className={stripStyles.mediaDecoStripUnit}>
                  <img src={stripe} alt="" className={stripStyles.mediaDecoImg} draggable={false} />
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
                layerTransform={hudTopTf}
                initialEnterX={-openStripEnterOffsetPx}
                durationSec={durationSec}
                delaySec={0.08}
                exitDurationSec={closeDurationSec}
                exitDelaySec={closeDelayTopSec ?? 0.08}
                isExiting={isOverlayExiting}
                reduceMotion={reduceMotion}
              >
                <div className={stripStyles.mediaDecoStripUnit}>
                  <img src={stripe} alt="" className={stripStyles.mediaDecoImg} draggable={false} />
                  <div
                    className={stripStyles.mediaDecoTextStaticCenter}
                    style={{ fontSize: phraseFontSize }}
                    role="status"
                    aria-live="polite"
                  >
                    <span
                      className={`${stripStyles.bottomStripText} ${stripStyles.countdownRow}`}
                    >
                      <span className={stripStyles.bottomStripLabel}>{displayLabel}</span>
                      <motion.span
                        className={stripStyles.countdownNumberWrap}
                        initial={{ opacity: 0 }}
                        animate={{
                          opacity: 1,
                          transition: {
                            delay: showResultCountdown ? 0 : 0.6,
                            duration: 0.25,
                          },
                        }}
                      >
                        {showNumber || showResultCountdown ? (
                          displayNumber > LAST_SECONDS_ANIMATED ? (
                            <span className={stripStyles.countdownNumber}>{displayNumber}</span>
                          ) : (
                            <AnimatePresence mode="wait">
                              <motion.span
                                key={displayNumber}
                                className={stripStyles.countdownNumber}
                                initial={{ scale: 0.35, opacity: 0 }}
                                animate={{
                                  scale: 1,
                                  opacity: 1,
                                  transition: {
                                    type: "spring",
                                    stiffness: 380,
                                    damping: 22,
                                  },
                                }}
                                exit={{
                                  scale: 0.5,
                                  opacity: 0,
                                  transition: { duration: 0.2 },
                                }}
                              >
                                {displayNumber}
                              </motion.span>
                            </AnimatePresence>
                          )
                        ) : (
                          <span className={stripStyles.countdownNumber}>—</span>
                        )}
                      </motion.span>
                    </span>
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
