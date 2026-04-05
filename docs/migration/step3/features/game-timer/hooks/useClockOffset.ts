'use client';

import { useState, useEffect, useRef } from 'react';

const SYNC_INTERVAL_MS = 60_000;
const PING_SAMPLES = 3;

async function measureOffset(): Promise<number> {
  const offsets: number[] = [];

  for (let i = 0; i < PING_SAMPLES; i++) {
    const t0 = Date.now();
    try {
      const res = await fetch('/api/time');
      const { t: serverTime } = await res.json();
      const t1 = Date.now();
      const rtt = t1 - t0;
      const offset = serverTime + rtt / 2 - t1;
      offsets.push(offset);
    } catch {
      // skip failed sample
    }
  }

  if (offsets.length === 0) return 0;
  offsets.sort((a, b) => a - b);
  return offsets[Math.floor(offsets.length / 2)]!;
}

/**
 * Returns the estimated offset (ms) between server and client clocks.
 * Use `Date.now() + offset` to get the server-aligned timestamp.
 * Re-syncs every 60 seconds.
 */
export function useClockOffset() {
  const [offset, setOffset] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const sync = async () => {
      const measured = await measureOffset();
      if (mountedRef.current) setOffset(measured);
    };

    sync();
    const interval = setInterval(sync, SYNC_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, []);

  return offset;
}
