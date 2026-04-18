/**
 * Конфигурация MatchVoting.
 *
 * Секции файла:
 * 1. Декор полосок — геометрия, маркью, таймер-HUD (`matchVotingDecoConfig`).
 * 2. Медиа-полосы — ассеты vote / final / shadow.
 * 3. Фон оверлея — декор под затемнением, blur / brightness / fade-in.
 * 4. Повторное голосование — композиция VS из двух букв.
 * 5. Тексты и фазы — строки, `VoteStripeVariant`, хелперы.
 * 6. Deprecated — алиасы `VotingSplashV2*`.
 */

// =============================================================================
// 1. Декор полосок (типы + значения + хелперы)
// =============================================================================

/** Смещение и поворот слоя; точка отсчёта — центр слоя в стеке. */
export type MatchVotingDecoLayerTransform = {
  x: number;
  y: number;
  rotateDeg: number;
};

/**
 * Тайминги вылета/ухода полосок и пауза перед затуханием всего оверлея.
 * Стартовый вылет: `offsetPx` или `offsetDesignWidthMult * compositionDesignWidthPx`.
 */
export type MatchVotingDecoOpenStripConfig = {
  durationSec: number;
  offsetPx?: number;
  offsetDesignWidthMult?: number;
  closeDurationSec?: number;
  closeDelayTopSec?: number;
  closeOverlayFadeDelaySec?: number;
  closeOverlayFadeDurationSec?: number;
};

/** Скорость бегущей строки на верхней/нижней полоске (сек на полный цикл). */
export type MatchVotingDecoMarqueeConfig = {
  topLoopDurationSec: number;
  bottomLoopDurationSec: number;
};

export type MatchVotingHudCompositionAnchor =
  | "topLeft"
  | "bottomLeft"
  | "bottomCenter"
  | "bottomRight";

/** Вторая композиция (нижний HUD): якорь к краю экрана, смещения, масштаб. */
export type MatchVotingHudCompositionConfig = {
  anchor: MatchVotingHudCompositionAnchor;
  positionXPx: number;
  positionYPx: number;
  globalRotateDeg: number;
  compositionScale: number;
  bottomStripe?: MatchVotingDecoLayerTransform;
  topStripe?: MatchVotingDecoLayerTransform;
};

/** Текст на полосках: размер фразы, кружки-разделители. */
export type MatchVotingDecoTextConfig = {
  phraseFontSize: string;
  dotDiameter: string;
  phraseDotGap: string;
};

export type MatchVotingDecoConfig = {
  compositionDesignWidthPx: number;
  compositionDesignHeightPx: number;
  compositionScale: number;
  compositionPositionXPx: number;
  compositionPositionYPx: number;
  compositionGlobalRotateDeg: number;
  bottom: {
    stripe: MatchVotingDecoLayerTransform;
    shadow: MatchVotingDecoLayerTransform;
  };
  top: {
    stripe: MatchVotingDecoLayerTransform;
  };
  text: MatchVotingDecoTextConfig;
  marquee: MatchVotingDecoMarqueeConfig;
  openStrip: MatchVotingDecoOpenStripConfig;
  hudComposition: MatchVotingHudCompositionConfig;
  /** Масштаб фонового `decor-stipe` под dim (центр `.backdropDecor`). */
  backdropDecorScale: number;
};

export function getOpenStripEnterOffsetPx(cfg: MatchVotingDecoConfig): number {
  if (cfg.openStrip.offsetPx != null) {
    return cfg.openStrip.offsetPx;
  }
  const mult = cfg.openStrip.offsetDesignWidthMult ?? 0.68;
  return Math.ceil(cfg.compositionDesignWidthPx * mult);
}

export function getStripCloseMotionWindowSec(open: MatchVotingDecoOpenStripConfig): number {
  const dur = open.closeDurationSec ?? open.durationSec;
  const topDel = open.closeDelayTopSec ?? 0.08;
  return dur + topDel;
}

export function getHudBottomStripeTransform(
  cfg: MatchVotingDecoConfig,
): MatchVotingDecoLayerTransform {
  return cfg.hudComposition.bottomStripe ?? cfg.bottom.stripe;
}

export function getHudTopStripeTransform(cfg: MatchVotingDecoConfig): MatchVotingDecoLayerTransform {
  return cfg.hudComposition.topStripe ?? cfg.top.stripe;
}

export const matchVotingDecoConfig: MatchVotingDecoConfig = {
  compositionDesignWidthPx: 960,
  compositionDesignHeightPx: 350,
  compositionScale: 1.3,
  compositionPositionXPx: -200,
  compositionPositionYPx: 0,
  compositionGlobalRotateDeg: -15,
  bottom: {
    stripe: { x: 0, y: 0, rotateDeg: -2 },
    shadow: { x: 0, y: 0, rotateDeg: -2 },
  },
  top: {
    stripe: { x: -10, y: -60, rotateDeg: -8 },
  },
  text: {
    phraseFontSize: "28px",
    dotDiameter: "10px",
    phraseDotGap: "1em",
  },
  marquee: {
    topLoopDurationSec: 80,
    bottomLoopDurationSec: 110,
  },
  openStrip: {
    durationSec: 1.5,
    closeDurationSec: 0.4,
    offsetDesignWidthMult: 1.5,
  },
  hudComposition: {
    anchor: "bottomRight",
    positionXPx: -380,
    positionYPx: -260,
    globalRotateDeg: -1,
    compositionScale: 1.4,
  },
  backdropDecorScale: 1,
};

/**
 * Планшет / узкий десктоп — как у play / `MatchScreen`: `(max-width: 1270px)`.
 */
export const MATCH_VOTING_DECO_TABLET_MAX_WIDTH_PX = 1270;

/**
 * Телефон в портрете. 460px — ориентир между типичными 390–430 и 480; подстрой под макет.
 */
export const MATCH_VOTING_DECO_PHONE_MAX_WIDTH_PX = 690;

/** @deprecated Переименовано в `MATCH_VOTING_DECO_TABLET_MAX_WIDTH_PX`. */
export const MATCH_VOTING_DECO_MOBILE_MAX_WIDTH_PX = MATCH_VOTING_DECO_TABLET_MAX_WIDTH_PX;

/**
 * Планшет (≤1270px, >460px): Headline / HUD относительно базы.
 * Subtitle: scale + **X/Y** вместе — иначе уезжает якорь `bottomRight`.
 */
export const matchVotingDecoTabletOverrides = {
  compositionScale: 1,
  backdropDecorScale: 1.2,
  hudComposition: {
    positionXPx: -260,
    positionYPx: -220,
    globalRotateDeg: -1,
    compositionScale: 1.2,
  },
} as const;

/**
 * Телефон (≤ `MATCH_VOTING_DECO_PHONE_MAX_WIDTH_PX`): поверх планшета.
 * Subtitle: якорь `bottomCenter` — `positionXPx` сдвиг от центра в `translateX`, `positionYPx` → `bottom`.
 */
export const matchVotingDecoPhoneOverrides = {
  compositionScale: 0.8,
  backdropDecorScale: 2,
  hudComposition: {
    anchor: "bottomCenter" as const,
    positionXPx: 0,
    positionYPx: -200,
    globalRotateDeg: 2,
    compositionScale: 1,
  },
} as const;

/** @deprecated Используйте `matchVotingDecoTabletOverrides`. */
export const matchVotingDecoNarrowOverrides = matchVotingDecoTabletOverrides;

export type MatchVotingDecoViewportFlags = {
  /** `(max-width: MATCH_VOTING_DECO_TABLET_MAX_WIDTH_PX)` */
  isTabletOrNarrower: boolean;
  /** `(max-width: MATCH_VOTING_DECO_PHONE_MAX_WIDTH_PX)` */
  isPhoneOrNarrower: boolean;
};

export function matchVotingDecoForViewport(flags: MatchVotingDecoViewportFlags): MatchVotingDecoConfig {
  if (!flags.isTabletOrNarrower) {
    return matchVotingDecoConfig;
  }
  const tabletMerged: MatchVotingDecoConfig = {
    ...matchVotingDecoConfig,
    compositionScale: matchVotingDecoTabletOverrides.compositionScale,
    backdropDecorScale: matchVotingDecoTabletOverrides.backdropDecorScale,
    hudComposition: {
      ...matchVotingDecoConfig.hudComposition,
      ...matchVotingDecoTabletOverrides.hudComposition,
    },
  };
  if (!flags.isPhoneOrNarrower) {
    return tabletMerged;
  }
  return {
    ...tabletMerged,
    compositionScale: matchVotingDecoPhoneOverrides.compositionScale,
    backdropDecorScale: matchVotingDecoPhoneOverrides.backdropDecorScale,
    hudComposition: {
      ...tabletMerged.hudComposition,
      ...matchVotingDecoPhoneOverrides.hudComposition,
    },
  };
}

// =============================================================================
// 2. Медиа-полосы (vote / final / shadow)
// =============================================================================

export const VOTING_STRIPE_ASSETS = {
  regular: "/voting/vote_stipe.webp",
  final: "/voting/final_stipe.webp",
  shadow: "/voting/shadow_stipe.webp",
} as const;

// =============================================================================
// 3. Фон оверлея (картинка под dim; при `no_vote` — Lottie, см. `VOTING_NO_VOTE_BACKDROP_*`)
// Размеры ассета декора 2000×920; порог растяжения по ширине — `MatchVoteRoot.module.css` (1400px).
// =============================================================================

export const VOTING_BACKDROP_DECOR_ASSETS = {
  regular: "/voting/decor-stipe.webp",
  final: "/voting/final-decor-stipe.webp",
} as const;

export const VOTING_BACKDROP_DECOR_SRC = VOTING_BACKDROP_DECOR_ASSETS.regular;

export const VOTING_BACKDROP_DECOR_BLUR_PX = 6;
export const VOTING_BACKDROP_DECOR_BRIGHTNESS = 0.6;
export const VOTING_BACKDROP_DECOR_FADE_IN_SEC = 3;

/** Фон вместо `decor-stipe` при `centerPhase === "no_vote"` (под затемнением). Один проход без loop — `MatchVoteRoot` + `LottieIcon` `playOnce`. */
export const VOTING_NO_VOTE_BACKDROP_LOTTIE_SRC = "/voting/tv.json";

/** Скорость воспроизведения Lottie (`setSpeed`), `1` = норма. */
export const VOTING_NO_VOTE_BACKDROP_LOTTIE_SPEED = 0.55;

/**
 * Сдвиг фона по вертикали (px): **отрицательный** — выше центра экрана, **положительный** — ниже.
 * Подбирается на глаз: композиция часто визуально «тяжелее» снизу.
 */
export const VOTING_NO_VOTE_BACKDROP_LOTTIE_OFFSET_Y_PX = 180;

/**
 * Сторона контейнера под рендер Lottie (px) — **должна совпадать с `w`/`h` в JSON** (`tv.json` → 512).
 * Не путать с `BASE_PX`: если подставить одно число и в width/height, и в знаменатель scale, они сокращаются и зум не меняется.
 */
export const VOTING_NO_VOTE_BACKDROP_LOTTIE_COMPOSITION_PX = 256;

/**
 * Делитель в формуле `scale = max(vw,vh) / BASE_PX * BLEED` (контейнер при этом `COMPOSITION_PX`).
 * **Меньше BASE_PX** → крупнее картинка на экране, **больше** → мельче.
 * При `BASE_PX === COMPOSITION_PX` сторона на экране ≈ `max(vw,vh) * BLEED` (базовый cover).
 */
export const VOTING_NO_VOTE_BACKDROP_LOTTIE_BASE_PX = 512;

/** Запас к `max(vw,vh) / BASE`, чтобы не было просветов по краям после blur. */
export const VOTING_NO_VOTE_BACKDROP_LOTTIE_COVER_BLEED = 4;

/**
 * Непрозрачность слоя TV (0…1): только Lottie под dim, без затемняющего оверлея.
 */
export const VOTING_NO_VOTE_BACKDROP_LOTTIE_OPACITY = 1;

// =============================================================================
// 4. Повторное голосование — логотип VS (две буквы, отдельные ассеты)
// Координаты — смещение от центра блока `compositionWidth/Height` (px).
// Контейнер с `overflow: hidden`: буквы вне рамки не видны.
// =============================================================================

/** Общий easing для входа букв VS и въезда карточек кандидатов (framer-motion). */
export const MATCH_VOTING_REVOTE_ENTRY_EASE: [number, number, number, number] = [
  0.22, 1, 0.36, 1,
];

export type MatchVotingRevoteVsLetter = {
  src: string;
  xPx: number;
  yPx: number;
};

/** Вход по оси Y: стартовые Y; финал — поля `v.yPx` / `s.yPx`. */
export type MatchVotingRevoteVsEntryAnimationConfig = {
  durationSec: number;
  vFromYPx: number;
  sFromYPx: number;
};

/**
 * Поворот затемнения (2 половины) + VS одним слоем.
 * Пружина framer-motion — «взрывной» импульс; крутить скорость — stiffness / damping / mass.
 */
export type MatchVotingRevoteRotationConfig = {
  /** Задержка старта поворота от монтирования слоя (сек), не зависит от анимации вылета букв. */
  startDelaySec: number;
  /** Целевой угол (град.); отрицательный — против часовой. */
  rotateDeg: number;
  springStiffness: number;
  springDamping: number;
  springMass: number;
  /**
   * Сторона квадрата затемнения в `vmax` (центр экрана). Берётся **большая** сторона вьюпорта — на широком экране
   * не «упираемся» только в высоту, как с `vmin`, и после поворота не остаются просветы по ширине.
   * >100 — запас под поворот; при больших `rotateDeg` подними (например 160–200).
   */
  dimCoverVmax: number;
};

/** Въезд двух карточек кандидатов (та же шкала времени, что у входа VS). */
export type MatchVotingRevoteCandidateCardsConfig = {
  /**
   * `x` — левая с `-offscreenXvw`, правая с `+offscreenXvw`.
   * `y` — левая сверху (`-offscreenYvh`), правая снизу (`+offscreenYvh`).
   */
  entryAxis: "x" | "y";
  offscreenXvw: number;
  offscreenYvh: number;
  /**
   * Длительность; `null` — как у `matchVotingRevoteVsConfig.entryAnimation.durationSec`.
   */
  durationSec: number | null;
  /** Стартовая непрозрачность (к 1). */
  fromOpacity: number;
};

export const matchVotingRevoteCandidateCardsConfig: MatchVotingRevoteCandidateCardsConfig =
  {
    entryAxis: "x",
    offscreenXvw: 108,
    offscreenYvh: 50,
    durationSec: null,
    fromOpacity: 0,
  };

export type MatchVotingRevoteViewportFlags = {
  /** Тот же брейкпоинт, что `matchVotingDecoForViewport` / TABLET deco. */
  isTabletOrNarrower: boolean;
};

/** Планшет и уже: VS поменьше в центре. */
export function matchVotingRevoteVsForViewport(
  flags: MatchVotingRevoteViewportFlags,
): MatchVotingRevoteVsConfig {
  if (!flags.isTabletOrNarrower) return matchVotingRevoteVsConfig;
  return { ...matchVotingRevoteVsConfig, lettersScale: 1 };
}

/** Планшет и уже: карточки въезжают сверху и снизу. */
export function matchVotingRevoteCandidateCardsForViewport(
  flags: MatchVotingRevoteViewportFlags,
): MatchVotingRevoteCandidateCardsConfig {
  const base = matchVotingRevoteCandidateCardsConfig;
  if (!flags.isTabletOrNarrower) return base;
  return { ...base, entryAxis: "y" };
}

export function getRevoteCandidateCardsEntryDurationSec(
  cardsCfg: MatchVotingRevoteCandidateCardsConfig,
  vsCfg: { entryAnimation: MatchVotingRevoteVsEntryAnimationConfig | null },
): number {
  if (cardsCfg.durationSec != null) return cardsCfg.durationSec;
  return vsCfg.entryAnimation?.durationSec ?? 0.85;
}

export type MatchVotingRevoteVsConfig = {
  compositionWidthPx: number;
  compositionHeightPx: number;
  /** Общий `scale` для обеих букв, центр — середина контейнера. */
  lettersScale: number;
  v: MatchVotingRevoteVsLetter;
  s: MatchVotingRevoteVsLetter;
  /** `null` — без анимации входа (сразу финальные Y). */
  entryAnimation: MatchVotingRevoteVsEntryAnimationConfig | null;
  /** `null` — без поворота слоя (только затемнение без общего rotate с VS). */
  rotation: MatchVotingRevoteRotationConfig | null;
};

export const matchVotingRevoteVsConfig: MatchVotingRevoteVsConfig = {
  compositionWidthPx: 100,
  compositionHeightPx: 170,
  lettersScale: 2,
  v: {
    src: "/voting/v_red.webp",
    xPx: -22,
    yPx: 28,
  },
  s: {
    src: "/voting/s_blue.webp",
    xPx: 22,
    yPx: -28,
  },
  entryAnimation: {
    durationSec: 1,
    vFromYPx: 150,
    sFromYPx: -150,
  },
  rotation: {
    startDelaySec: 0.1,
    rotateDeg: 22,
    springStiffness: 300,
    springDamping: 30,
    springMass: 3,
    dimCoverVmax: 165,
  },
};

// =============================================================================
// 5. Тексты, вариант полосок, фазы, хелперы
// =============================================================================

export const MATCH_VOTING_COPY = {
  round1: "РАУНД 1",
  round2: "РАУНД 2",
  voting: "ГОЛОСОВАНИЕ",
  finalVoting: "ФИНАЛЬНОЕ ГОЛОСОВАНИЕ",
  revoteCandidatePlaceholderLeft: "Кандидат 1",
  revoteCandidatePlaceholderRight: "Кандидат 2",
  noVoteTitle: "ГОЛОСОВАНИЕ НЕ СОСТОЯЛОСЬ",
  /** Вторая строка по центру (под заголовком «не состоялось»). */
  noVoteSubtitle: "Никто не исключён — игра продолжается",
  /** Подпись на нижней полоске с таймером (`intermission_no_vote` / `intermission_revote_no_vote`). */
  noVoteTimerStripLabel: "Продолжаем...",
  /** Финал: любое «не состоялось» — затем победный сплэш шпионов. */
  finalAutoSpyWinSubtitle: "Автоматическая победа шпионов",
  finalAutoSpyWinTimerStripLabel: "Игра завершена...",
  countdown: "ОСТАЛОСЬ...",
  /** Подпись на нижней полоске (subtitle) в фазе кандидатов на повторное. */
  revoteSubtitleLabel: "НА 2 РАУНД...",
  /** Финальное голосование при «Шпионском хаосе»: неизвестно, сколько шпионов было в начале. */
  finalSpiesStatusBanner: "Шпионы всё ещё среди нас. Но сколько?",
} as const;

/** Склонение «N шпион(а/ов)» для плашки над списком игроков. */
export function spyCountWordRu(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "шпион";
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return "шпиона";
  return "шпионов";
}

/** Финальное голосование при известном числе шпионов в ростере (без «хаоса»). */
export function formatFinalSpiesToFindBanner(remaining: number): string {
  return `Осталось найти ${remaining} ${spyCountWordRu(remaining)}`;
}

export type VoteStripeVariant = "regular" | "final";

export type MatchVotingCenterPhase = "vote" | "revote_candidates" | "no_vote";

export function stripeImageForVariant(variant: VoteStripeVariant): string {
  return variant === "final" ? VOTING_STRIPE_ASSETS.final : VOTING_STRIPE_ASSETS.regular;
}

export function backdropDecorSrcForVariant(variant: VoteStripeVariant): string {
  return variant === "final"
    ? VOTING_BACKDROP_DECOR_ASSETS.final
    : VOTING_BACKDROP_DECOR_ASSETS.regular;
}

// =============================================================================
// 6. Deprecated — алиасы имён `VotingSplashV2*` (историческое API)
// =============================================================================

/** @deprecated Используйте `MatchVotingDecoLayerTransform`. */
export type VotingSplashV2DecoLayerTransform = MatchVotingDecoLayerTransform;
/** @deprecated Используйте `MatchVotingDecoOpenStripConfig`. */
export type VotingSplashV2DecoOpenStripConfig = MatchVotingDecoOpenStripConfig;
/** @deprecated Используйте `MatchVotingDecoMarqueeConfig`. */
export type VotingSplashV2DecoMarqueeConfig = MatchVotingDecoMarqueeConfig;
/** @deprecated Используйте `MatchVotingHudCompositionAnchor`. */
export type VotingSplashV2HudCompositionAnchor = MatchVotingHudCompositionAnchor;
/** @deprecated Используйте `MatchVotingHudCompositionConfig`. */
export type VotingSplashV2HudCompositionConfig = MatchVotingHudCompositionConfig;
/** @deprecated Используйте `MatchVotingDecoTextConfig`. */
export type VotingSplashV2DecoTextConfig = MatchVotingDecoTextConfig;
/** @deprecated Используйте `MatchVotingDecoConfig`. */
export type VotingSplashV2DecoConfig = MatchVotingDecoConfig;

/** @deprecated Используйте `matchVotingDecoConfig`. */
export const votingSplashV2DecoConfig = matchVotingDecoConfig;
