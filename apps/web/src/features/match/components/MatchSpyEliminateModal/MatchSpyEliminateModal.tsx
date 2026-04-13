"use client";

import { useState } from "react";
import type { MouseEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { GamePlayer } from "@/types/player";
import { LottieIcon } from "@/lib/lottie";
import { PlayerAvatar } from "@/features/player/components/PlayerAvatar";
import { GlassPanelButton } from "@/shared/components/ui/GlassPanelButton/GlassPanelButton";
import { playUI } from "@/lib/sound";
import styles from "./MatchSpyEliminateModal.module.css";

export type MatchSpyEliminateModalProps = {
  open: boolean;
  onClose: () => void;
  players: GamePlayer[];
  onEliminate: (playerId: string) => void;
};

export function MatchSpyEliminateModal({ open, onClose, players, onEliminate }: MatchSpyEliminateModalProps) {
  const aliveTargets = players.filter((p) => p.is_alive !== false && p.is_spy !== true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleBackdropClick = () => {
    playUI("click");
    onClose();
  };

  const handleKill = (id: string) => {
    playUI("click");
    onEliminate(id);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.backdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-label="Выбор цели для устранения"
        >
          <div className={styles.closeArea} onClick={handleBackdropClick} aria-hidden />

          <motion.div
            className={`glass ${styles.card}`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            onClick={(e: MouseEvent) => e.stopPropagation()}
          >
            <div className={styles.header}>
              <h2 className={styles.title}>Кого устранить?</h2>
              <p className={styles.hint}>Тратит 1 действие. Выберите игрока для устранения</p>
            </div>

            <ul className={styles.list}>
              {aliveTargets.map((p) => (
                <li
                  key={p.id}
                  className={`${styles.row} ${hoveredId === p.id ? styles.rowHovered : ""}`}
                  onMouseEnter={() => {
                    setHoveredId(p.id);
                    playUI("hover");
                  }}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <div className={styles.player}>
                    <PlayerAvatar avatarId={p.avatar_id} size="sm" className={styles.avatar} />
                    <p className={`${styles.name} ${hoveredId === p.id ? styles.nameHovered : ""}`}>{p.nickname}</p>
                  </div>
                  <button
                    type="button"
                    className={`glass glass-hover ${styles.killBtn}`}
                    onClick={() => handleKill(p.id)}
                    onMouseEnter={() => {
                      setHoveredId(p.id);
                      playUI("hover");
                    }}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <LottieIcon src="/lottie/kill.json" size={24} playOnHover hovered={hoveredId === p.id} />
                  </button>
                </li>
              ))}
            </ul>

            <div className={styles.closeRow}>
              <GlassPanelButton
                type="button"
                size="md"
                align="center"
                className={styles.btnCancel}
                onClick={() => onClose()}
              >
                Отмена
              </GlassPanelButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
