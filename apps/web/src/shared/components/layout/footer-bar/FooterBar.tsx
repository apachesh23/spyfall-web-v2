'use client';

import { useState, useRef, type ReactNode, type MouseEvent, type PointerEvent } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { IconShare, IconMoodSmile } from '@tabler/icons-react';
import { useReactions } from '@/features/reactions/context';
import { LobbyInviteBlock } from "@/features/lobby/components/LobbyInviteBlock";
import { HostPanelPlayerList } from "@/features/lobby/components/HostPanelPlayerList";
import { DangerButton, PrimaryButton } from "@/shared/components/ui";
import { useLobbyFooter } from "@/features/lobby/contexts/LobbyFooterContext";
import { playUI } from '@/lib/sound';
import styles from './FooterBar.module.css';

export type FooterBarVariant = 'lobby' | 'game';

type FooterBarProps = {
  variant: FooterBarVariant;
  inviteCode?: string;
  /** Для variant='game': контент левой ячейки (кнопка подсказки). */
  leftSlot?: ReactNode;
  /** Для variant='game': показывать кнопку «Панель управления». */
  isHost?: boolean;
  /** Для variant='game': доп. колбэк при открытии панели (опционально). */
  onHostPanelClick?: () => void;
  /** Для variant='game': контент оверлея «Панель управления» (пауза / завершить). */
  gameHostPanel?: ReactNode;
};

export function FooterBar({
  variant,
  inviteCode,
  leftSlot,
  isHost: isHostProp,
  onHostPanelClick,
  gameHostPanel,
}: FooterBarProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [hostPanelOpen, setHostPanelOpen] = useState(false);
  const [gameHostPanelOpen, setGameHostPanelOpen] = useState(false);
  const lobby = useLobbyFooter();
  const reactions = useReactions();
  const reactionsButtonRef = useRef<HTMLButtonElement>(null);

  const isHostLobby = lobby?.isHost ?? false;
  const isHost = variant === 'game' ? (isHostProp ?? false) : isHostLobby;

  return (
    <>
      <footer className={styles.root} data-footer-variant={variant}>
        <div className={styles.leftSlot}>
          {variant === 'lobby' && (
            <motion.button
              type="button"
              className={`${styles.iconButton} glass glass-hover`}
              onClick={() => {
                playUI('click');
                setShareOpen(true);
              }}
              onMouseEnter={() => playUI('hover')}
              aria-label="Поделиться"
              whileTap={{ scale: 0.94 }}
              transition={{ duration: 0.08 }}
            >
              <span className={styles.icon} aria-hidden>
                <IconShare size={28} stroke={2} />
              </span>
            </motion.button>
          )}
          {variant === 'game' && leftSlot != null && (
            <div className={styles.leftSlotGame}>{leftSlot}</div>
          )}
        </div>

        <div className={styles.centerSlot}>
          {variant === 'lobby' && isHost && (
            <motion.button
              type="button"
              className={`${styles.centerTextButton} glass glass-hover`}
              onClick={() => {
                playUI('click');
                setHostPanelOpen(true);
              }}
              onMouseEnter={() => playUI('hover')}
              aria-label="Панель ведущего"
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.08 }}
            >
              Панель управления
            </motion.button>
          )}
          {variant === 'game' &&
            isHost &&
            (gameHostPanel != null || onHostPanelClick) && (
            <motion.button
              type="button"
              className={`${styles.centerTextButton} glass glass-hover`}
              onClick={() => {
                playUI('click');
                onHostPanelClick?.();
                if (gameHostPanel != null) {
                  setGameHostPanelOpen(true);
                }
              }}
              onMouseEnter={() => playUI('hover')}
              aria-label="Панель управления"
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.08 }}
            >
              Панель управления
            </motion.button>
          )}
        </div>

        <div className={styles.rightSlot}>
          <motion.button
            ref={reactionsButtonRef}
            type="button"
            className={`${styles.iconButton} glass glass-hover`}
            onClick={() => {
              playUI('click');
              if (reactions && reactionsButtonRef.current) {
                reactions.openReactions(reactionsButtonRef.current.getBoundingClientRect());
              }
            }}
            onMouseEnter={() => playUI('hover')}
            aria-label="Реакции"
            whileTap={{ scale: 0.94 }}
            transition={{ duration: 0.08 }}
          >
            <span className={styles.icon} aria-hidden>
              <IconMoodSmile size={28} stroke={2} />
            </span>
          </motion.button>
        </div>
      </footer>

      {/* Share overlay */}
      <AnimatePresence>
        {shareOpen && variant === 'lobby' && inviteCode && (
          <motion.div
            className={styles.overlayBackdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              className={styles.overlayCloseArea}
              onClick={() => setShareOpen(false)}
              aria-hidden
            />
            <motion.div
              className={styles.overlayContent}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              onClick={(e: MouseEvent) => e.stopPropagation()}
            >
              <LobbyInviteBlock code={inviteCode} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Панель управления в матче (ведущий) */}
      <AnimatePresence>
        {gameHostPanelOpen && variant === 'game' && gameHostPanel && (
          <motion.div
            className={styles.overlayBackdropHost}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              className={styles.overlayCloseArea}
              onClick={() => setGameHostPanelOpen(false)}
              aria-hidden
            />
            <motion.div
              className={styles.overlayContentHost}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              onClick={(e: MouseEvent) => e.stopPropagation()}
              onPointerDown={(e: PointerEvent) => e.stopPropagation()}
            >
              <div className={styles.gameHostPanelBody}>{gameHostPanel}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Host panel overlay */}
      <AnimatePresence>
        {hostPanelOpen && variant === 'lobby' && lobby && (
          <motion.div
            className={styles.overlayBackdropHost}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              className={styles.overlayCloseArea}
              onClick={() => setHostPanelOpen(false)}
              aria-hidden
            />
            <motion.div
              className={styles.overlayContentHost}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              onClick={(e: MouseEvent) => e.stopPropagation()}
              onPointerDown={(e: PointerEvent) => e.stopPropagation()}
            >
              <div className={styles.hostPanelActions}>
                <PrimaryButton
                  className={`${styles.hostPanelBtn} ${styles.hostPanelBtnPrimary}`}
                  disabled={lobby.startingGame || lobby.players.length < 3}
                  loading={lobby.startingGame}
                  lottieIcon="/lottie/rocet.json"
                  onClick={() => {
                    lobby.onStartGame();
                    setHostPanelOpen(false);
                  }}
                  soundClick="click"
                  soundHover="hover"
                >
                  {lobby.startingGame ? "КНОПКА НАЖАТА…" : "СТАРТ ИГРЫ"}
                </PrimaryButton>
              </div>
              <div className={styles.hostPanelList}>
                <HostPanelPlayerList
                  players={lobby.players}
                  currentPlayerId={lobby.currentPlayerId}
                  isHost={lobby.isHost}
                  onKick={lobby.onKick}
                  kickingPlayerId={lobby.kickingPlayerId}
                />
              </div>
              <div className={styles.hostPanelActions}>
                <DangerButton
                  variant="text"
                  className={styles.hostPanelBtn}
                  onClick={() => {
                    lobby.onCloseRoom();
                    setHostPanelOpen(false);
                  }}
                  soundClick="click"
                  soundHover="hover"
                >
                  ЗАКРЫТЬ КОМНАТУ
                </DangerButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
