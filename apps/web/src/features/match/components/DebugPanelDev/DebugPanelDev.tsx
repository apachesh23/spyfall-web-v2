"use client";

import styles from "./DebugPanelDev.module.css";

export type MatchConnectionStatus = "idle" | "connecting" | "ok" | "error";

export type DebugPanelDevProps = {
  open: boolean;
  roomCode: string;
  canEndMatch: boolean;
  endMatchBusy: boolean;
  endMatchError: string | null;
  onEndMatch: () => void;
  colyseusUrl: string;
  connectionStatus: MatchConnectionStatus;
  connectErrorDetail?: string | null;
  pong?: string | null;
  children?: React.ReactNode;
};

function statusClass(s: MatchConnectionStatus): string {
  if (s === "ok") return styles.statusOk;
  if (s === "error") return styles.statusErr;
  if (s === "connecting") return styles.statusWarn;
  return "";
}

function statusText(s: MatchConnectionStatus): string {
  if (s === "idle") return "ожидание";
  if (s === "connecting") return "подключение…";
  if (s === "ok") return "в комнате";
  return "нет соединения";
}

/**
 * Горизонтальная dev-полоса по верху экрана: завершение матча + статус game-server.
 */
export function DebugPanelDev({
  open,
  roomCode,
  canEndMatch,
  endMatchBusy,
  endMatchError,
  onEndMatch,
  colyseusUrl,
  connectionStatus,
  connectErrorDetail,
  pong,
  children,
}: DebugPanelDevProps) {
  if (!open) return null;

  return (
    <div className={styles.root} role="region" aria-label="Отладочная панель матча">
      <span className={styles.badge}>DEV</span>
      <button
        type="button"
        className={styles.btnEnd}
        disabled={!canEndMatch || endMatchBusy}
        onClick={() => void onEndMatch()}
      >
        {endMatchBusy ? "Завершение…" : "Завершить матч → лобби"}
      </button>
      <div className={styles.status}>
        <span className={styles.statusLabel}>комната</span>
        <span className={styles.mono}>{roomCode}</span>
        <span className={styles.statusLabel}>·</span>
        <span className={styles.statusLabel}>Colyseus</span>
        <span className={`${statusClass(connectionStatus)}`}>{statusText(connectionStatus)}</span>
        <span className={styles.mono}>{colyseusUrl}</span>
        {pong ? (
          <>
            <span className={styles.statusLabel}>·</span>
            <span className={styles.statusOk}>pong ok</span>
          </>
        ) : null}
      </div>
      {!canEndMatch ? (
        <p className={styles.hint}>Завершить матч может только ведущий (id из лобби).</p>
      ) : null}
      {connectionStatus === "error" && connectErrorDetail ? (
        <p className={styles.error}>
          {connectErrorDetail}
          <span className={styles.mono}> · проверь {colyseusUrl}/health</span>
        </p>
      ) : null}
      {endMatchError ? <p className={styles.error}>{endMatchError}</p> : null}
      {children ? <div className={styles.slot}>{children}</div> : null}
    </div>
  );
}
