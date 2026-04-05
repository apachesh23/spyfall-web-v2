import type { SupabaseClient } from '@supabase/supabase-js';

type BroadcastOptions = {
  subscribeTimeoutMs?: number;
  /** Повторная подписка + отправка (после сбоев Realtime). */
  maxAttempts?: number;
};

async function runOneBroadcastAttempt(
  supabase: SupabaseClient,
  roomId: string,
  event: string,
  payload: object,
  subscribeTimeoutMs: number,
): Promise<boolean> {
  const channel = supabase.channel(`room-${roomId}`);
  let subscribed = false;

  await new Promise<void>((resolve) => {
    const to = setTimeout(() => resolve(), subscribeTimeoutMs);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        subscribed = true;
        clearTimeout(to);
        resolve();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        clearTimeout(to);
        resolve();
      }
    });
  });

  try {
    if (!subscribed) {
      console.warn('[room broadcast] skipped (not subscribed in time):', event, roomId);
      return false;
    }
    const r = await channel.send({
      type: 'broadcast',
      event,
      payload,
    });
    if (r !== 'ok') {
      console.warn(`[room broadcast] send status ${String(r)}:`, event, roomId);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[room broadcast] send error:', event, roomId, e);
    return false;
  } finally {
    try {
      await supabase.removeChannel(channel);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Отправка broadcast в канал комнаты без бесконечного ожидания SUBSCRIBED.
 * Раньше `subscribe` без таймаута и без обработки TIMED_OUT/CHANNEL_ERROR блокировал route handler,
 * клиент получал AbortError по таймауту fetch, хотя БД уже была обновлена.
 */
export async function sendRoomBroadcast(
  supabase: SupabaseClient,
  roomId: string,
  event: string,
  payload: object,
  options?: BroadcastOptions,
): Promise<void> {
  const ms = options?.subscribeTimeoutMs ?? 12_000;
  const maxAttempts = options?.maxAttempts ?? 3;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const ok = await runOneBroadcastAttempt(supabase, roomId, event, payload, ms);
    if (ok) return;
    if (attempt < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
    }
  }
}

/**
 * Одна подписка — несколько событий подряд (меньше гонок с Realtime, чем N отдельных каналов).
 */
export async function sendRoomBroadcastBatch(
  supabase: SupabaseClient,
  roomId: string,
  messages: Array<{ event: string; payload: object }>,
  options?: BroadcastOptions,
): Promise<void> {
  if (messages.length === 0) return;
  const ms = options?.subscribeTimeoutMs ?? 15_000;
  const maxAttempts = options?.maxAttempts ?? 4;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const channel = supabase.channel(`room-${roomId}`);
    let subscribed = false;

    await new Promise<void>((resolve) => {
      const to = setTimeout(() => resolve(), ms);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          subscribed = true;
          clearTimeout(to);
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          clearTimeout(to);
          resolve();
        }
      });
    });

    let batchOk = subscribed;
    try {
      if (subscribed) {
        for (const { event, payload } of messages) {
          const r = await channel.send({ type: 'broadcast', event, payload });
          if (r !== 'ok') {
            console.warn(`[room broadcast batch] send status ${String(r)}:`, event, roomId);
            batchOk = false;
            break;
          }
        }
      } else {
        console.warn('[room broadcast batch] skipped (not subscribed in time):', roomId);
      }
    } catch (e) {
      console.warn('[room broadcast batch] send error:', roomId, e);
      batchOk = false;
    } finally {
      try {
        await supabase.removeChannel(channel);
      } catch {
        /* ignore */
      }
    }

    if (batchOk && subscribed) return;
    if (attempt < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
}
