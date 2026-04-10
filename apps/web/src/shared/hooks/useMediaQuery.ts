'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Синхронное чтение `matchMedia` на клиенте (через `useSyncExternalStore`), чтобы первый кадр
 * после монтирования совпадал с вьюпортом. Раньше `useState(false)` + `useEffect` давали один
 * кадр с `false` — ломало `initial` у framer-motion и одноразовые раскладки.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (typeof window === 'undefined') return () => {};
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onStoreChange);
      return () => mq.removeEventListener('change', onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  }, [query]);

  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
