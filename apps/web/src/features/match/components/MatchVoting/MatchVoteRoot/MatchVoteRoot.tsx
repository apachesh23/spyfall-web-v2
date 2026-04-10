"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "framer-motion";
import { LottieIcon } from "@/lib/lottie";
import { playVFX } from "@/lib/sound";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import rootStyles from "./MatchVoteRoot.module.css";
import type { VotingSplashProps } from "../matchVoteRoot.types";
import { VotingHeadlineStrips } from "../VotingHeadlineStrips";
import { VotingSubtitleStrip } from "../VotingSubtitleStrip";
import {
  VotingPhaseNoVote,
  noVotePhaseStackVariants,
} from "../VotingPhaseNoVote";
import {
  VotingPhaseRevoteCandidates,
  type MatchVoteRevoteCandidatesPair,
} from "../VotingPhaseRevoteCandidates";
import { RevoteVsLogo } from "../RevoteVsLogo";
import {
  getOpenStripEnterOffsetPx,
  getStripCloseMotionWindowSec,
  MATCH_VOTING_DECO_PHONE_MAX_WIDTH_PX,
  MATCH_VOTING_DECO_TABLET_MAX_WIDTH_PX,
  matchVotingDecoConfig,
  matchVotingDecoForViewport,
  matchVotingRevoteVsConfig,
  stripeImageForVariant,
  VOTING_BACKDROP_DECOR_BLUR_PX,
  VOTING_BACKDROP_DECOR_BRIGHTNESS,
  VOTING_BACKDROP_DECOR_FADE_IN_SEC,
  backdropDecorSrcForVariant,
  MATCH_VOTING_COPY,
  VOTING_NO_VOTE_BACKDROP_LOTTIE_BASE_PX,
  VOTING_NO_VOTE_BACKDROP_LOTTIE_COMPOSITION_PX,
  VOTING_NO_VOTE_BACKDROP_LOTTIE_COVER_BLEED,
  VOTING_NO_VOTE_BACKDROP_LOTTIE_OFFSET_Y_PX,
  VOTING_NO_VOTE_BACKDROP_LOTTIE_OPACITY,
  VOTING_NO_VOTE_BACKDROP_LOTTIE_SPEED,
  VOTING_NO_VOTE_BACKDROP_LOTTIE_SRC,
  type MatchVotingCenterPhase,
  type MatchVotingDecoConfig,
  type VoteStripeVariant,
} from "../voting.config";

const LAST_SECONDS_ANIMATED = 10;
/** Синхрон с exit цифры в `VotingSubtitleStrip` (~0.2s). */
const COUNTDOWN_TICK_SOUND_DELAY_MS = 220;
const easeSmooth = [0.22, 1, 0.36, 1] as const;
const DEFAULT_COLORS = { front: "#F3A221", back: "#B77918" };
const DEFAULT_COUNTDOWN = 60;
const DEFAULT_COUNTDOWN_LABEL = "ОСТАЛОСЬ...";
const CLOCK_SKEW_GRACE_SEC = 60;

/** Согласовано с сервером `VOTE_COUNTDOWN_ZERO_PAD_MS`: показываем 0 целую секунду до дедлайна. */
function matchVotingDisplayedSecondsRemaining(endMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((endMs - nowMs) / 1000) - 1);
}

/** При значении на нижнем таймере ≤ порога убираем заголовки no_vote (exit), таймер ещё показывает эту цифру. */
const NO_VOTE_TITLE_EXIT_AT_RESULT_COUNTDOWN = 0;

function backdropDecorFilter(blurPx: number, brightness: number): string | undefined {
  const parts: string[] = [];
  if (blurPx > 0) parts.push(`blur(${blurPx}px)`);
  if (Math.abs(brightness - 1) > 1e-4) parts.push(`brightness(${brightness})`);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

export type MatchVoteRootProps = VotingSplashProps & {
  /** Верхняя бегущая строка (раунд). */
  roundMarqueeLabel?: string;
  /** Нижняя бегущая строка в шапочной композиции. По умолчанию `title`. */
  headlineMarqueeLabel?: string;
  voteStripeVariant?: VoteStripeVariant;
  /** Показать/скрыть верхние полоски без размонтирования корня. */
  headlineStripsVisible?: boolean;
  centerPhase?: MatchVotingCenterPhase;
  /** @deprecated Используйте `roundMarqueeLabel`. */
  decoTopRepeatLabel?: string;
  /**
   * Фоновый декор под затемнением. `undefined` — по `voteStripeVariant` (webp) или, при `centerPhase === "no_vote"`, Lottie `VOTING_NO_VOTE_BACKDROP_LOTTIE_SRC`; `null` — без фона.
   */
  backdropDecorSrc?: string | null;
  /**
   * Blur декора (px). `undefined` — из `VOTING_BACKDROP_DECOR_BLUR_PX`, `null` — без blur.
   */
  backdropDecorBlurPx?: number | null;
  /**
   * Яркость декора (`brightness()`), `1` = исходная. `undefined` — из `VOTING_BACKDROP_DECOR_BRIGHTNESS`, `null` — как `1`.
   */
  backdropDecorBrightness?: number | null;
  /**
   * Длительность fade-in декора (сек). `undefined` — `VOTING_BACKDROP_DECOR_FADE_IN_SEC`, `null` — без анимации.
   */
  backdropDecorFadeInSec?: number | null;
  /** Два кандидата на повторное голосование (`centerPhase === "revote_candidates"`). */
  revoteCandidates?: MatchVoteRevoteCandidatesPair | null;
  /** Фаза `no_vote`: переопределить заголовок (продакшен с сервера). */
  noVotePhaseTitle?: string;
  /**
   * Вторая строка под заголовком; `undefined` — `MATCH_VOTING_COPY.noVoteSubtitle`; `""` — скрыть.
   */
  noVotePhaseSubtitle?: string;
  /**
   * Доп. тусклая строка (третья); `undefined` / `""` — не показывать.
   */
  noVotePhaseHint?: string;
};

export type { MatchVoteRevoteCandidatesPair };

type MatchVoteOverlayBodyProps = MatchVoteRootProps & {
  decoConfig: MatchVotingDecoConfig;
  isRootExiting: boolean;
};

function MatchVoteOverlayBody({
  decoConfig,
  isRootExiting,
  title = "ГОЛОСОВАНИЕ",
  titleBadge,
  decoTopRepeatLabel,
  roundMarqueeLabel: roundMarqueeLabelProp,
  headlineMarqueeLabel: headlineMarqueeLabelProp,
  voteStripeVariant = "regular",
  headlineStripsVisible = true,
  centerPhase = "vote",
  countdownLabel = DEFAULT_COUNTDOWN_LABEL,
  countdownSeconds: countdownSecondsProp,
  eventAt: eventAtProp,
  endsAt: endsAtProp,
  clockSkewMs = 0,
  onClose,
  resultCountdown = null,
  resultCountdownLabel,
  colors = DEFAULT_COLORS,
  children,
  revoteCandidates = null,
  noVotePhaseTitle,
  noVotePhaseSubtitle,
  noVotePhaseHint,
}: MatchVoteOverlayBodyProps) {
  const reduceMotion = useReducedMotion();
  const decoCfg = decoConfig;
  const isStripExit = isRootExiting;
  const showResultCountdown = resultCountdown !== undefined && resultCountdown !== null;
  const wasShowingResultRef = useRef(false);
  const exitingFromResultRef = useRef(false);
  const lastResultLabelRef = useRef(resultCountdownLabel ?? "");
  if (showResultCountdown) {
    wasShowingResultRef.current = true;
    lastResultLabelRef.current = resultCountdownLabel ?? "";
  } else if (wasShowingResultRef.current) {
    wasShowingResultRef.current = false;
    exitingFromResultRef.current = true;
  }
  // После мини-фазы (tie/no_vote) при старте следующего раунда возвращаем обычный countdown.
  if (
    !showResultCountdown &&
    (endsAtProp != null || (countdownSecondsProp ?? DEFAULT_COUNTDOWN) > 0)
  ) {
    exitingFromResultRef.current = false;
  }
  const exitingFromResult = exitingFromResultRef.current;

  const countdownSeconds = Math.max(0, countdownSecondsProp ?? DEFAULT_COUNTDOWN);

  const initialCount = (() => {
    if (showResultCountdown) return 0;
    const nowSync = Date.now() + clockSkewMs;
    if (endsAtProp) {
      return matchVotingDisplayedSecondsRemaining(new Date(endsAtProp).getTime(), nowSync);
    }
    if (countdownSeconds <= 0 || !eventAtProp) return countdownSeconds;
    let elapsed = Math.floor((nowSync - new Date(eventAtProp).getTime()) / 1000);
    if (elapsed < 0) elapsed = 0;
    if (elapsed < CLOCK_SKEW_GRACE_SEC) elapsed = 0;
    const remaining = countdownSeconds - elapsed;
    if (remaining <= 0) return 0;
    return remaining;
  })();

  const [count, setCount] = useState(initialCount);
  const [showNumber, setShowNumber] = useState(false);
  const prevCountRef = useRef(initialCount);
  const closedRef = useRef(false);
  const wooshOutPlayedRef = useRef(false);

  const triggerWooshOut = () => {
    if (wooshOutPlayedRef.current) return;
    wooshOutPlayedRef.current = true;
    playVFX("woosh_out");
  };

  const hasCountdown =
    showResultCountdown ||
    exitingFromResult ||
    (!!endsAtProp && !exitingFromResult) ||
    (countdownSeconds > 0 && !exitingFromResult);

  useEffect(() => {
    playVFX("woosh_in");
  }, []);

  useEffect(() => {
    if (isRootExiting) {
      triggerWooshOut();
    }
  }, [isRootExiting]);

  useEffect(() => {
    if (!hasCountdown) return;
    const t = setTimeout(() => setShowNumber(true), 600);
    return () => clearTimeout(t);
  }, [hasCountdown]);

  useEffect(() => {
    if (isRootExiting) return;
    if (showResultCountdown) return;
    if (!hasCountdown || !showNumber || count > LAST_SECONDS_ANIMATED) return;
    if (count >= prevCountRef.current) {
      prevCountRef.current = count;
      return;
    }
    prevCountRef.current = count;
    if (count === 0) {
      playVFX("countdown_last");
      return;
    }
    const t = window.setTimeout(() => playVFX("countdown_sec"), COUNTDOWN_TICK_SOUND_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [isRootExiting, showResultCountdown, hasCountdown, showNumber, count]);

  const prevResultCountRef = useRef<number | null>(null);
  useEffect(() => {
    if (isRootExiting) return;
    if (!showResultCountdown || resultCountdown == null) {
      prevResultCountRef.current = null;
      return;
    }
    const n = resultCountdown;
    const prev = prevResultCountRef.current;
    if (prev === null || n >= prev) {
      prevResultCountRef.current = n;
      return;
    }
    prevResultCountRef.current = n;
    if (n === 0) {
      playVFX("countdown_last");
      return;
    }
    const t = window.setTimeout(() => playVFX("countdown_sec"), COUNTDOWN_TICK_SOUND_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [isRootExiting, showResultCountdown, resultCountdown]);

  useEffect(() => {
    if (isRootExiting) return;
    if (showResultCountdown) return;
    if (!hasCountdown) return;
    if (endsAtProp) return;
    if (count <= 0) {
      if (onClose && !closedRef.current) {
        closedRef.current = true;
        const t = setTimeout(() => {
          triggerWooshOut();
          onClose();
        }, 800);
        return () => clearTimeout(t);
      }
      return undefined;
    }
    if (!showNumber) return;
    const t = setInterval(() => setCount((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [isRootExiting, showResultCountdown, hasCountdown, showNumber, count, onClose, endsAtProp]);

  useEffect(() => {
    if (isRootExiting) return;
    if (showResultCountdown) return;
    if (!endsAtProp || !hasCountdown) return;
    if (!showNumber) return;
    const endMs = new Date(endsAtProp).getTime();
    const tick = () => {
      const nowAccurate = Date.now() + clockSkewMs;
      setCount(matchVotingDisplayedSecondsRemaining(endMs, nowAccurate));
      if (nowAccurate >= endMs && onClose && !closedRef.current) {
        closedRef.current = true;
        window.setTimeout(() => {
          triggerWooshOut();
          onClose();
        }, 800);
      }
    };
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [
    isRootExiting,
    showResultCountdown,
    endsAtProp,
    hasCountdown,
    showNumber,
    clockSkewMs,
    onClose,
  ]);

  const displayLabel = exitingFromResult
    ? lastResultLabelRef.current
    : showResultCountdown
      ? (resultCountdownLabel ?? "")
      : centerPhase === "revote_candidates"
        ? MATCH_VOTING_COPY.revoteSubtitleLabel
        : countdownLabel;
  const displayNumber = exitingFromResult ? 0 : showResultCountdown ? resultCountdown! : count;

  const noVoteTitlesVisible =
    !showResultCountdown ||
    resultCountdown == null ||
    resultCountdown > NO_VOTE_TITLE_EXIT_AT_RESULT_COUNTDOWN;

  const roundMarqueeLabel =
    roundMarqueeLabelProp?.trim() ||
    decoTopRepeatLabel?.trim() ||
    titleBadge?.trim() ||
    "РАУНД 1";
  const headlineMarqueeLabel =
    headlineMarqueeLabelProp?.trim() || title.trim() || "ГОЛОСОВАНИЕ";

  const stripeSrc = stripeImageForVariant(voteStripeVariant);
  const openStripCfg = decoCfg.openStrip;
  const openStripEnterOffsetPx = getOpenStripEnterOffsetPx(decoCfg);

  const showHeadlineStrips =
    headlineStripsVisible &&
    centerPhase !== "revote_candidates" &&
    centerPhase !== "no_vote";
  const centerLayoutClass =
    centerPhase === "revote_candidates" ? rootStyles.centerRevoteBleed : "";

  const phaseMotionClass =
    centerPhase === "vote"
      ? `${rootStyles.centerPhaseMotion} ${rootStyles.centerPhaseMotionBallot}`
      : centerPhase === "no_vote"
        ? `${rootStyles.centerPhaseMotion} ${rootStyles.centerPhaseMotionNoVote}`
        : rootStyles.centerPhaseMotion;

  return (
    <>
      <div className={`${rootStyles.inner} ${rootStyles.innerAboveDim}`}>
        <div className={`${rootStyles.center} ${centerLayoutClass}`.trim()}>
          <div
            className={
              centerPhase === "no_vote"
                ? `${rootStyles.centerAnimateHost} ${rootStyles.centerAnimateHostNoVote}`
                : rootStyles.centerAnimateHost
            }
          >
            <AnimatePresence mode="wait">
            {centerPhase === "vote" ? (
              <motion.div
                key="phase-vote"
                className={phaseMotionClass}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {children}
              </motion.div>
            ) : centerPhase === "revote_candidates" ? (
              <motion.div
                key="phase-revote"
                className={phaseMotionClass}
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <VotingPhaseRevoteCandidates candidates={revoteCandidates} />
              </motion.div>
            ) : (
              <motion.div
                key="phase-no-vote"
                className={phaseMotionClass}
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
              >
                {/* `initial` по умолчанию: иначе Framer не проигрывает `initial`→`animate` у стека заголовков при первом появлении. */}
                <AnimatePresence>
                  {noVoteTitlesVisible ? (
                    <motion.div
                      key="no-vote-title-stack"
                      className={`${rootStyles.phaseRoot} ${rootStyles.phaseRootNoVote}`.trim()}
                      variants={noVotePhaseStackVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                    >
                      <VotingPhaseNoVote
                        title={noVotePhaseTitle}
                        subtitle={noVotePhaseSubtitle}
                        hint={noVotePhaseHint}
                        reduceMotion={reduceMotion}
                      />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <VotingHeadlineStrips
        decoConfig={decoCfg}
        openStripEnterOffsetPx={openStripEnterOffsetPx}
        durationSec={openStripCfg.durationSec}
        closeDurationSec={openStripCfg.closeDurationSec}
        closeDelayTopSec={openStripCfg.closeDelayTopSec}
        roundMarqueeLabel={roundMarqueeLabel}
        headlineMarqueeLabel={headlineMarqueeLabel}
        stripeImageSrc={stripeSrc}
        reduceMotion={reduceMotion}
        isOverlayExiting={isStripExit}
        visible={showHeadlineStrips}
      />

      {hasCountdown ? (
        <VotingSubtitleStrip
          decoConfig={decoCfg}
          openStripEnterOffsetPx={openStripEnterOffsetPx}
          durationSec={openStripCfg.durationSec}
          closeDurationSec={openStripCfg.closeDurationSec}
          closeDelayTopSec={openStripCfg.closeDelayTopSec}
          isOverlayExiting={isStripExit}
          reduceMotion={reduceMotion}
          displayLabel={displayLabel}
          displayNumber={displayNumber}
          showNumber={showNumber}
          showResultCountdown={showResultCountdown}
          phraseFontSize={decoCfg.text.phraseFontSize}
          stripeImageSrc={stripeSrc}
        />
      ) : null}
    </>
  );
}

export function MatchVoteRoot(props: MatchVoteRootProps) {
  const isPresent = useIsPresent();
  const reduceMotion = useReducedMotion();
  const {
    title = "ГОЛОСОВАНИЕ",
    colors = DEFAULT_COLORS,
    backdropDecorSrc,
    backdropDecorBlurPx,
    backdropDecorBrightness,
    backdropDecorFadeInSec,
    voteStripeVariant = "regular",
    centerPhase = "vote",
  } = props;

  const revoteRotation = matchVotingRevoteVsConfig.rotation;
  const useRevoteRotateLayer =
    centerPhase === "revote_candidates" && revoteRotation != null;
  const useRevoteSplitDim = centerPhase === "revote_candidates";
  const openStripCfg = matchVotingDecoConfig.openStrip;
  const stripCloseMotionSec = getStripCloseMotionWindowSec(openStripCfg);
  const overlayFadeDelaySec =
    stripCloseMotionSec + (openStripCfg.closeOverlayFadeDelaySec ?? 0.06);
  const overlayFadeDurationSec = openStripCfg.closeOverlayFadeDurationSec ?? 0.28;

  const useNoVoteLottieBackdrop =
    centerPhase === "no_vote" && backdropDecorSrc === undefined;

  const decorSrc = useNoVoteLottieBackdrop
    ? null
    : backdropDecorSrc === undefined
      ? backdropDecorSrcForVariant(voteStripeVariant)
      : backdropDecorSrc;

  const showBackdropDecor = useNoVoteLottieBackdrop || !!decorSrc;

  const decorBlurPx = Math.max(
    0,
    backdropDecorBlurPx === undefined
      ? VOTING_BACKDROP_DECOR_BLUR_PX
      : backdropDecorBlurPx === null
        ? 0
        : backdropDecorBlurPx,
  );

  const decorBrightness = Math.min(
    2.5,
    Math.max(
      0,
      backdropDecorBrightness === undefined
        ? VOTING_BACKDROP_DECOR_BRIGHTNESS
        : backdropDecorBrightness === null
          ? 1
          : backdropDecorBrightness,
    ),
  );

  const decorFilter = backdropDecorFilter(decorBlurPx, decorBrightness);

  const decorFadeInSec = Math.max(
    0,
    backdropDecorFadeInSec === undefined
      ? VOTING_BACKDROP_DECOR_FADE_IN_SEC
      : backdropDecorFadeInSec === null
        ? 0
        : backdropDecorFadeInSec,
  );

  const isTabletOrNarrowerVotingDeco = useMediaQuery(
    `(max-width: ${MATCH_VOTING_DECO_TABLET_MAX_WIDTH_PX}px)`,
  );
  const isPhoneOrNarrowerVotingDeco = useMediaQuery(
    `(max-width: ${MATCH_VOTING_DECO_PHONE_MAX_WIDTH_PX}px)`,
  );
  const matchVoteDecoCfg = useMemo(
    () =>
      matchVotingDecoForViewport({
        isTabletOrNarrower: isTabletOrNarrowerVotingDeco,
        isPhoneOrNarrower: isPhoneOrNarrowerVotingDeco,
      }),
    [isTabletOrNarrowerVotingDeco, isPhoneOrNarrowerVotingDeco],
  );

  const noVoteLottieCoverRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!useNoVoteLottieBackdrop) return;
    const el = noVoteLottieCoverRef.current;
    if (!el) return;

    const applyCoverScale = () => {
      const vv = window.visualViewport;
      const vw = vv?.width ?? window.innerWidth;
      const vh = vv?.height ?? window.innerHeight;
      const basePx = Math.max(1, VOTING_NO_VOTE_BACKDROP_LOTTIE_BASE_PX);
      const cover =
        (Math.max(vw, vh) / basePx) * VOTING_NO_VOTE_BACKDROP_LOTTIE_COVER_BLEED;
      el.style.setProperty("--mv-no-vote-lottie-cover-scale", cover.toFixed(4));
      el.style.setProperty(
        "--mv-no-vote-lottie-offset-y",
        `${VOTING_NO_VOTE_BACKDROP_LOTTIE_OFFSET_Y_PX}px`,
      );
    };

    applyCoverScale();
    window.addEventListener("resize", applyCoverScale);
    window.visualViewport?.addEventListener("resize", applyCoverScale);
    window.visualViewport?.addEventListener("scroll", applyCoverScale);
    return () => {
      window.removeEventListener("resize", applyCoverScale);
      window.visualViewport?.removeEventListener("resize", applyCoverScale);
      window.visualViewport?.removeEventListener("scroll", applyCoverScale);
    };
  }, [
    useNoVoteLottieBackdrop,
    VOTING_NO_VOTE_BACKDROP_LOTTIE_BASE_PX,
    VOTING_NO_VOTE_BACKDROP_LOTTIE_COMPOSITION_PX,
    VOTING_NO_VOTE_BACKDROP_LOTTIE_COVER_BLEED,
    VOTING_NO_VOTE_BACKDROP_LOTTIE_OFFSET_Y_PX,
  ]);

  const noVoteLottieLayerOpacity = Math.min(
    1,
    Math.max(0, VOTING_NO_VOTE_BACKDROP_LOTTIE_OPACITY),
  );

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={`${rootStyles.overlayRoot} ${
        centerPhase === "revote_candidates"
          ? rootStyles.overlayRootRevoteCardsBleed
          : ""
      }`}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{
        opacity: 0,
        transition: {
          delay: overlayFadeDelaySec,
          duration: overlayFadeDurationSec,
          ease: easeSmooth,
        },
      }}
      style={
        {
          "--voting-front": colors.front,
          "--voting-back": colors.back,
        } as React.CSSProperties
      }
    >
      {showBackdropDecor ? (
        <motion.div
          className={rootStyles.backdropDecor}
          initial={{ opacity: reduceMotion ? 1 : 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration:
              reduceMotion || decorFadeInSec <= 0 ? 0 : decorFadeInSec,
            ease: easeSmooth,
          }}
          style={decorFilter ? { filter: decorFilter } : undefined}
          aria-hidden
        >
          {useNoVoteLottieBackdrop ? (
            <div
              className={rootStyles.backdropDecorLottieWrap}
              style={{ opacity: noVoteLottieLayerOpacity }}
            >
              <div
                ref={noVoteLottieCoverRef}
                className={rootStyles.backdropDecorLottieCoverScaler}
                style={{
                  width: VOTING_NO_VOTE_BACKDROP_LOTTIE_COMPOSITION_PX,
                  height: VOTING_NO_VOTE_BACKDROP_LOTTIE_COMPOSITION_PX,
                }}
              >
                <LottieIcon
                  src={VOTING_NO_VOTE_BACKDROP_LOTTIE_SRC}
                  playOnce
                  fillParent
                  speed={VOTING_NO_VOTE_BACKDROP_LOTTIE_SPEED}
                  className={rootStyles.backdropDecorLottie}
                />
              </div>
            </div>
          ) : (
            <img
              src={decorSrc!}
              alt=""
              className={rootStyles.backdropDecorImg}
              draggable={false}
              style={{
                transform: `scale(${matchVoteDecoCfg.backdropDecorScale})`,
                transformOrigin: "center center",
              }}
            />
          )}
        </motion.div>
      ) : null}
      {useRevoteRotateLayer && revoteRotation ? (
        <motion.div
          className={rootStyles.revoteRotateLayer}
          aria-hidden
          initial={{ rotate: reduceMotion ? revoteRotation.rotateDeg : 0 }}
          animate={{ rotate: revoteRotation.rotateDeg }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : {
                  delay: revoteRotation.startDelaySec,
                  type: "spring",
                  stiffness: revoteRotation.springStiffness,
                  damping: revoteRotation.springDamping,
                  mass: revoteRotation.springMass,
                }
          }
        >
          <div
            className={rootStyles.revoteRotateDimExpand}
            style={{
              width: `${revoteRotation.dimCoverVmax}vmax`,
              height: `${revoteRotation.dimCoverVmax}vmax`,
            }}
          >
            <div className={rootStyles.backdropDim}>
              <div className={rootStyles.backdropDimHalfLeft} />
              <div className={rootStyles.backdropDimHalfRight} />
            </div>
          </div>
          <div className={rootStyles.revoteRotateLayerVsSlot}>
            <RevoteVsLogo />
          </div>
        </motion.div>
      ) : useRevoteSplitDim ? (
        <div className={rootStyles.backdropDim} aria-hidden>
          <div className={rootStyles.backdropDimHalfLeft} />
          <div className={rootStyles.backdropDimHalfRight} />
        </div>
      ) : (
        <div className={rootStyles.backdropDimUniform} aria-hidden />
      )}
      <MatchVoteOverlayBody
        {...props}
        decoConfig={matchVoteDecoCfg}
        isRootExiting={!isPresent}
      />
    </motion.div>
  );
}
