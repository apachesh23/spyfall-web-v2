'use client';

import type React from 'react';
import { useCallback, useRef, useEffect, useState } from 'react';
import Lottie, { type LottieRefCurrentProps } from 'lottie-react';

type LottieIconProps = {
  /** Путь к JSON в public, например /lottie/gamepad.json */
  src: string;
  /** Воспроизводить при наведении (передаётся с кнопки: true = hover) */
  playOnHover?: boolean;
  /** Родитель наведён — запустить анимацию с начала */
  hovered?: boolean;
  /** Зациклить анимацию (для логотипа) */
  loop?: boolean;
  /** Один раз проиграть с начала при монтировании (для реакций на аватарках) */
  autoplayOnce?: boolean;
  /** Проиграть один раз с начала; по окончании вызывается onComplete */
  playOnce?: boolean;
  /** При playOnce — проиграть только кадры [start, end]; по окончании сегмента вызывается onComplete */
  playSegment?: [number, number];
  /** Зацикленно проигрывать только кадры [start, end] (idle-анимация) */
  loopSegment?: [number, number];
  /** Вызывается по окончании анимации (при playOnce или pingPong) */
  onComplete?: () => void;
  /** Играть анимацию туда‑сюда: вперёд, потом назад, снова вперёд (для фоновых эффектов) */
  pingPong?: boolean;
  /**
   * Множитель скорости (`AnimationItem.setSpeed`): `1` = как в исходнике, `0.5` = вдвое медленнее.
   * Применяется после монтирования плеера (не в `useLayoutEffect` — иначе ref ещё пуст).
   */
  speed?: number;
  /**
   * Заполнить родителя: контейнер 100%×100%, SVG/canvas как `object-fit: cover` + `resize()` под lottie-web.
   * Без этого библиотека держит размер из JSON (например 512×512), и обычный CSS снаружи не растягивает рендер.
   */
  fillParent?: boolean;
  className?: string;
  size?: number;
};

export function LottieIcon({
  src,
  playOnHover = false,
  hovered = false,
  loop = false,
  autoplayOnce = false,
  playOnce = false,
  playSegment,
  loopSegment,
  onComplete,
  pingPong = false,
  speed = 1,
  fillParent = false,
  className = '',
  size,
}: LottieIconProps) {
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const [animationData, setAnimationData] = useState<object | null>(null);
  const pingDirectionRef = useRef<1 | -1>(1);
  const playOnceStartedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch(src)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setAnimationData(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [src]);

  const applyPlaybackSpeed = useCallback(() => {
    if (!animationData) return;
    const rate = Number.isFinite(speed) && speed > 0 ? speed : 1;
    const api = lottieRef.current;
    api?.setSpeed?.(rate);
  }, [animationData, speed]);

  const triggerLottieResize = () => {
    const item = (lottieRef.current as unknown as { animationItem?: { resize?: () => void } } | null)
      ?.animationItem;
    item?.resize?.();
  };

  /**
   * Скорость: родительский `useLayoutEffect` выполняется до `useEffect` в lottie-react,
   * где создаётся `AnimationItem` — поэтому только `useEffect` + `onDOMLoaded` + rAF.
   */
  useEffect(() => {
    if (!animationData) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      applyPlaybackSpeed();
      raf2 = requestAnimationFrame(applyPlaybackSpeed);
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [animationData, applyPlaybackSpeed]);

  useEffect(() => {
    if (!fillParent || !animationData || !wrapRef.current) return;
    const ro = new ResizeObserver(() => triggerLottieResize());
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [fillParent, animationData]);

  useEffect(() => {
    if (!playOnHover || !lottieRef.current) return;
    if (hovered) {
      lottieRef.current.goToAndPlay(0, true);
    } else {
      lottieRef.current.goToAndStop(0, true);
    }
  }, [playOnHover, hovered]);

  useEffect(() => {
    if (!autoplayOnce || pingPong || playOnce || !lottieRef.current || !animationData) return;
    lottieRef.current.goToAndPlay(0, true);
  }, [autoplayOnce, pingPong, playOnce, animationData]);

  // Сброс флага, когда playOnce выключили (чтобы при следующем закрытии анимация снова запустилась)
  useEffect(() => {
    if (!playOnce) playOnceStartedRef.current = false;
  }, [playOnce]);

  /** Новый JSON — можно снова проиграть playOnce (тот же компонент, другой src). */
  useEffect(() => {
    playOnceStartedRef.current = false;
  }, [src]);

  const startPlayOnceFromRef = useCallback(() => {
    if (!playOnce || playOnceStartedRef.current || !lottieRef.current) return;
    playOnceStartedRef.current = true;
    const inst = lottieRef.current as unknown as {
      playSegments?: (segments: number[], forceFlag: boolean) => void;
    } | null;
    if (playSegment && inst?.playSegments) {
      inst.playSegments([playSegment[0], playSegment[1]], true);
    } else {
      lottieRef.current.goToAndPlay(0, true);
    }
  }, [playOnce, playSegment]);

  const handleDomLoaded = () => {
    requestAnimationFrame(() => {
      applyPlaybackSpeed();
      if (fillParent) triggerLottieResize();
      // autoplay=false при playOnce — старт только после готовности lottie-web (ранний useEffect часто ловил пустой ref)
      startPlayOnceFromRef();
    });
  };

  useEffect(() => {
    if (!playOnce || !animationData) return;
    const t = window.setTimeout(() => startPlayOnceFromRef(), 120);
    return () => window.clearTimeout(t);
  }, [playOnce, animationData, startPlayOnceFromRef]);

  // Зацикленный сегмент кадров (idle)
  useEffect(() => {
    if (!loopSegment || !lottieRef.current || !animationData) return;
    const inst = lottieRef.current as unknown as { playSegments?: (segments: number[], forceFlag: boolean) => void } | null;
    inst?.playSegments?.([loopSegment[0], loopSegment[1]], true);
  }, [loopSegment, animationData]);

  // Ping-pong: вперёд → назад → вперёд...
  useEffect(() => {
    if (!pingPong || !lottieRef.current || !animationData) return;

    const inst = lottieRef.current;
    // стартуем вперёд
    inst?.setDirection?.(1);
    inst?.goToAndPlay?.(0, true);
  }, [pingPong, animationData]);

  const dimensionStyle: React.CSSProperties | undefined = fillParent
    ? { width: '100%', height: '100%', display: 'block' }
    : size != null
      ? { width: size, height: size }
      : undefined;

  if (!animationData) {
    return <span ref={wrapRef} className={className} style={dimensionStyle} aria-hidden />;
  }

  return (
    <span ref={wrapRef} className={className} style={dimensionStyle} aria-hidden>
      <Lottie
        lottieRef={lottieRef}
        animationData={animationData}
        onDOMLoaded={handleDomLoaded}
        rendererSettings={
          fillParent ? { preserveAspectRatio: 'xMidYMid slice' } : undefined
        }
        loop={pingPong ? false : !loopSegment && loop && !playOnce}
        autoplay={pingPong ? false : !loopSegment && (loop || autoplayOnce) && !playOnce}
        onComplete={
          pingPong
            ? () => {
                const inst = lottieRef.current;
                if (!inst) return;
                const nextDir = pingDirectionRef.current === 1 ? -1 : 1;
                pingDirectionRef.current = nextDir;
                inst.setDirection?.(nextDir);
                inst.goToAndPlay?.(0, true);
              }
            : playOnce
              ? () => {
                  onComplete?.();
                }
              : loopSegment
                ? () => {
                    const inst = lottieRef.current as unknown as { playSegments?: (segments: number[], forceFlag: boolean) => void } | null;
                    inst?.playSegments?.([loopSegment[0], loopSegment[1]], true);
                  }
                : undefined
        }
        style={dimensionStyle}
      />
    </span>
  );
}
