"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import type { Settings } from "@/types";
import { useLobbyData } from "@/features/lobby/hooks/useLobbyData";
import { useLobbyRealtimeChannel } from "@/features/lobby/hooks/useLobbyRealtimeChannel";
import { useIsLobbyMobile } from "@/features/lobby/hooks/useIsLobbyMobile";
import { LobbyFooterProvider } from "@/features/lobby/contexts/LobbyFooterContext";
import { useReactions } from "@/features/reactions/context";
import { FooterBar } from "@/shared/components/layout/footer-bar/FooterBar";
import { LobbyInviteBlock } from "@/features/lobby/components/LobbyInviteBlock";
import { LobbySettings } from "@/features/lobby/components/LobbySettings";
import { PlayerList } from "@/features/player";
import {
  ConfirmDialog,
  DangerButton,
  LoadingDots,
  PrimaryButton,
} from "@/shared/components/ui";
import { FullscreenLoader } from "@/shared/components/layout/route-loader/FullscreenLoader";
import { SplashScreen, type SplashType } from "@/features/splash-screen";
import { SplashScreenDevPanel } from "@/features/splash-screen";
import { useRouteLoaderStore } from "@/store/route-loader-store";
import { IconTrash } from "@tabler/icons-react";
import styles from "@/features/lobby/lobby-screen.module.css";

type LobbyScreenProps = {
  code: string;
};

export function LobbyScreen({ code }: LobbyScreenProps) {
  const isLobbyMobile = useIsLobbyMobile();

  const {
    players,
    setPlayers,
    roomId,
    loading,
    error,
    currentPlayerId,
    isHost,
    settings,
    setSettings,
    splashEvent,
    setSplashEvent,
    roomStatus,
    setRoomStatus,
  } = useLobbyData(code);

  const [onlinePlayers, setOnlinePlayers] = useState<Set<string>>(new Set());
  const [kickingPlayerId, setKickingPlayerId] = useState<string | null>(null);
  const [startingGame, setStartingGame] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSettingsRef = useRef<Settings | null>(null);
  const [showLoader, setShowLoader] = useState(true);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [closeRoomConfirmOpen, setCloseRoomConfirmOpen] = useState(false);
  const [kickConfirmPlayerId, setKickConfirmPlayerId] = useState<string | null>(null);
  const router = useRouter();
  const stopGlobalLoader = useRouteLoaderStore((s) => s.stop);

  const getStartSplashRemainingSec = useCallback(() => {
    if (splashEvent?.type !== "system_start") return 0;
    if (splashEvent.ends_at) {
      const diffSec = Math.floor(
        (new Date(splashEvent.ends_at).getTime() - Date.now()) / 1000,
      );
      return diffSec > 0 ? diffSec : 0;
    }
    const totalSec = splashEvent.countdownSeconds ?? 5;
    const elapsedSec = Math.floor(
      (Date.now() - new Date(splashEvent.at).getTime()) / 1000,
    );
    const remaining = totalSec - (elapsedSec < 0 ? 0 : elapsedSec);
    return remaining > 0 ? remaining : 0;
  }, [splashEvent]);

  const startSplashActive =
    splashEvent?.type === "system_start" && getStartSplashRemainingSec() > 0;

  useEffect(() => {
    if (loading || error || !roomStatus) return;
    if (roomStatus === "playing" && !startSplashActive) {
      router.replace(`/play/${code}`);
    }
  }, [loading, error, roomStatus, startSplashActive, code, router]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    if (!loading) {
      timeout = setTimeout(() => {
        setShowLoader(false);
      }, 2000);
      stopGlobalLoader();
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [loading, stopGlobalLoader]);

  const reactions = useReactions();
  const { sendReaction } = useLobbyRealtimeChannel({
    roomId,
    code,
    playerId: currentPlayerId,
    setPlayers,
    setSettings,
    setOnlinePlayers,
    setRoomStatus,
    setSplashEvent,
    onReaction: (payload) => reactions?.addReaction(payload),
  });

  useEffect(() => {
    if (!startingGame) return;
    if (startSplashActive) return;
    if (roomStatus === "playing") return;
    setStartingGame(false);
  }, [startingGame, startSplashActive, roomStatus]);

  async function triggerSplash(
    type:
      | "system_start"
      | "system_pause"
      | "game_over_spy_win"
      | "game_over_civilians_win"
      | "voting_kicked_civilian"
      | "spy_kill"
      | "voting",
    opts?: { countdownSeconds?: number; countdownLabel?: string },
  ) {
    if (!roomId || !currentPlayerId || !isHost) return;
    try {
      const body: Record<string, unknown> = {
        roomId,
        hostId: currentPlayerId,
        type,
      };
      if (opts?.countdownSeconds != null) body.countdownSeconds = opts.countdownSeconds;
      if (opts?.countdownLabel != null) body.countdownLabel = opts.countdownLabel;
      const res = await fetch("/api/rooms/splash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        console.error("Splash trigger error:", data.error);
      }
    } catch (e) {
      console.error("Splash trigger error:", e);
    }
  }

  async function dismissSplash() {
    if (!roomId || !currentPlayerId) return;
    try {
      const res = await fetch("/api/rooms/splash/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, playerId: currentPlayerId }),
      });
      if (!res.ok) {
        const data = await res.json();
        console.error("Splash dismiss error:", data.error);
      }
    } catch (e) {
      console.error("Splash dismiss error:", e);
    }
  }

  const sendReactionRef = useRef(sendReaction);
  sendReactionRef.current = sendReaction;

  const sendReactionWithSelf = useCallback(
    (reactionId: number) => {
      if (currentPlayerId) reactions?.addReaction({ playerId: currentPlayerId, reactionId });
      sendReactionRef.current(reactionId);
    },
    [currentPlayerId, reactions],
  );

  useEffect(() => {
    reactions?.registerSendReaction(sendReactionWithSelf);
    return () => reactions?.registerSendReaction(() => {});
  }, [reactions, sendReactionWithSelf]);

  function requestKickPlayer(playerId: string) {
    if (!roomId || !currentPlayerId) return;
    setKickConfirmPlayerId(playerId);
  }

  async function performKick(playerId: string) {
    if (!roomId || !currentPlayerId) return;
    setKickingPlayerId(playerId);
    try {
      const response = await fetch("/api/rooms/kick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, roomId, kickerId: currentPlayerId }),
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || "Ошибка");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка");
    } finally {
      setKickingPlayerId(null);
    }
  }

  function handleKickConfirm() {
    const playerId = kickConfirmPlayerId;
    setKickConfirmPlayerId(null);
    if (playerId) performKick(playerId);
  }

  async function saveSettings(settingsToSave?: Settings) {
    if (!roomId || !currentPlayerId) return;
    let payload = settingsToSave ?? settings;
    if (!payload) return;

    const multiSpyOn = payload.mode_multi_spy && players.length >= 7;
    payload = {
      ...payload,
      spy_count: multiSpyOn ? (players.length >= 11 ? 3 : 2) : 1,
    };

    try {
      const response = await fetch("/api/rooms/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, hostId: currentPlayerId, settings: payload }),
      });

      const res = await response.json();
      if (!response.ok) {
        alert(res.error || "Ошибка");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка");
    }
  }

  function handleSettingsChange(newSettings: Settings) {
    setSettings(newSettings);
    if (!isHost) return;
    pendingSettingsRef.current = newSettings;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      if (pendingSettingsRef.current) {
        saveSettings(pendingSettingsRef.current);
        pendingSettingsRef.current = null;
      }
      saveTimeoutRef.current = null;
    }, 400);
  }

  async function handleLeave() {
    if (!roomId || !currentPlayerId) return;
    try {
      const res = await fetch("/api/rooms/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, playerId: currentPlayerId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Не удалось выйти");
        return;
      }
      if (typeof window !== "undefined") window.localStorage.removeItem("active_room_code");
      router.push("/");
    } catch (e) {
      console.error(e);
      alert("Ошибка выхода");
    }
  }

  async function handleCloseRoom() {
    if (!roomId || !currentPlayerId) return;
    try {
      const res = await fetch("/api/rooms/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, hostId: currentPlayerId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Не удалось закрыть комнату");
        return;
      }
      if (typeof window !== "undefined") window.localStorage.removeItem("active_room_code");
      router.push("/");
    } catch (e) {
      console.error(e);
      alert("Ошибка закрытия комнаты");
    }
  }

  async function startGame() {
    if (!roomId || !currentPlayerId) return;

    if (players.length < 3) {
      alert("Минимум 3 игрока для старта!");
      return;
    }

    setStartingGame(true);
    try {
      await triggerSplash("system_start", { countdownSeconds: 5 });

      const response = await fetch("/api/game/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, hostId: currentPlayerId }),
      });

      const data = await response.json();
      if (!response.ok) {
        alert(data.error || "Ошибка старта игры");
        setStartingGame(false);
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка старта игры");
      setStartingGame(false);
    }
  }

  if (error) {
    return (
      <div className={styles.errorWrap}>
        <h2 className={styles.errorTitle}>Ошибка</h2>
        <p className={styles.errorText}>{error}</p>
      </div>
    );
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {startSplashActive ? (
          <SplashScreen
            key="system_start"
            type={"system_start" as SplashType}
            onClose={() => {
              dismissSplash();
            }}
            countdownSeconds={splashEvent.countdownSeconds ?? 5}
            countdownLabel={splashEvent.countdownLabel}
            eventAt={splashEvent.at}
            endsAt={splashEvent.ends_at}
            players={players}
          />
        ) : null}
      </AnimatePresence>
      <div style={{ display: "none" }} aria-hidden>
        <SplashScreenDevPanel
          splashEvent={splashEvent}
          isHost={!!isHost}
          roomId={roomId}
          currentPlayerId={currentPlayerId}
          players={players}
          onTriggerSplash={triggerSplash}
          onDismissSplash={dismissSplash}
        />
      </div>
      <FullscreenLoader show={showLoader} />
      <LobbyFooterProvider
        value={{
          isHost: !!isHost,
          players,
          currentPlayerId,
          onStartGame: startGame,
          onCloseRoom: () => setCloseRoomConfirmOpen(true),
          onKick: requestKickPlayer,
          startingGame,
          kickingPlayerId,
        }}
      >
        <div className={styles.pageWithFooter}>
          <div className={styles.contentGrid}>
            <div className={styles.leftCol}>
              <div className={`glass ${styles.glassBlock}`}>
                <div className={styles.glassBlockInner}>
                  <span className={styles.glassBlockDots}>
                    <LoadingDots />
                  </span>
                  <span className={styles.glassBlockText}>
                    Ожидание игроков... [{players.length}/{settings?.max_players ?? 8}]
                  </span>
                  <span className={styles.glassBlockTextShort}>
                    Ожидание... [{players.length}/{settings?.max_players ?? 8}]
                  </span>
                </div>
                {!isHost && (
                  <div className={styles.glassBlockExitWrap}>
                    <DangerButton
                      variant="text"
                      compact
                      onClick={() => setExitConfirmOpen(true)}
                      soundClick="click"
                      soundHover="hover"
                    >
                      ВЫХОД
                    </DangerButton>
                  </div>
                )}
              </div>
              <div className={styles.playerListWrap}>
                <PlayerList
                  players={players}
                  currentPlayerId={currentPlayerId}
                  onlinePlayers={onlinePlayers}
                  isHost={isHost}
                  onKick={requestKickPlayer}
                  kickingPlayerId={kickingPlayerId}
                />
              </div>
              <div className={styles.row3Left}>
                {isHost ? (
                  <div className={styles.row3LeftHostRow}>
                    <PrimaryButton
                      toolbar
                      toolbarExpand
                      disabled={startingGame || players.length < 3}
                      loading={startingGame}
                      lottieIcon="/lottie/rocet.json"
                      onClick={startGame}
                      soundClick="click"
                      soundHover="hover"
                    >
                      {startingGame ? "Запуск..." : "СТАРТ ИГРЫ"}
                    </PrimaryButton>
                    <DangerButton
                      variant="icon"
                      aria-label="Закрыть комнату"
                      onClick={() => setCloseRoomConfirmOpen(true)}
                      soundClick="click"
                      soundHover="hover"
                    >
                      <IconTrash size={28} stroke={2} aria-hidden />
                    </DangerButton>
                  </div>
                ) : (
                  <DangerButton
                    variant="text"
                    className={styles.row3LeftFull}
                    onClick={() => setExitConfirmOpen(true)}
                    soundClick="click"
                    soundHover="hover"
                  >
                    ВЫХОД
                  </DangerButton>
                )}
              </div>
            </div>

            <div className={styles.rightCol}>
              <div className={`glass ${styles.row1Right}`}>
                <span className={styles.row1RightTitle}>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="#747BFF"
                    className={styles.row1RightIcon}
                    aria-hidden
                  >
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                  </svg>
                  Режимы игры
                </span>
              </div>
              <div className={styles.modesWrap}>
                {settings && (
                  <LobbySettings
                    settings={settings}
                    onSettingsChange={handleSettingsChange}
                    isHost={isHost}
                    playerCount={players.length}
                  />
                )}
              </div>
              {!isLobbyMobile && (
                <LobbyInviteBlock code={code} className={styles.row3Right} />
              )}
            </div>
          </div>
          <footer className={styles.lobbyPageFooter}>
            <FooterBar variant="lobby" inviteCode={code} />
          </footer>
        </div>
      </LobbyFooterProvider>
      <ConfirmDialog
        open={exitConfirmOpen}
        onClose={() => setExitConfirmOpen(false)}
        question="Вы точно хотите выйти?"
        onConfirm={handleLeave}
        soundClick="click"
        soundHover="hover"
      />
      <ConfirmDialog
        open={closeRoomConfirmOpen}
        onClose={() => setCloseRoomConfirmOpen(false)}
        question="Вы точно хотите удалить комнату?"
        onConfirm={handleCloseRoom}
        soundClick="click"
        soundHover="hover"
      />
      <ConfirmDialog
        open={!!kickConfirmPlayerId}
        onClose={() => setKickConfirmPlayerId(null)}
        question={(() => {
          const candidate = kickConfirmPlayerId
            ? players.find((p) => p.id === kickConfirmPlayerId)
            : null;
          return candidate?.nickname
            ? `Удалить ${candidate.nickname} из комнаты?`
            : "Кикнуть игрока из комнаты?";
        })()}
        onConfirm={handleKickConfirm}
        soundClick="click"
        soundHover="hover"
      />
    </>
  );
}
