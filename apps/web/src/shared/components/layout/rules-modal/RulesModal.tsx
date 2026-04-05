"use client";

import { useState, type MouseEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { playUI } from "@/lib/sound";
import styles from "./RulesModal.module.css";

export type RulesModalProps = {
  open: boolean;
  onClose: () => void;
};

type RuleTab = {
  id: "core" | "flow" | "spy" | "voting" | "modes";
  label: string;
  body: string;
};

const RULE_TABS: RuleTab[] = [
  {
    id: "core",
    label: "🎯 Суть",
    body: "Spyfall — социальная игра на внимательность и дедукцию. Игроки задают друг другу вопросы, пытаясь понять, кто шпион. Мирные агенты знают локацию; шпион — нет. Агенты вычисляют шпиона, шпион пытается понять локацию и остаться незамеченным.",
  },
  {
    id: "flow",
    label: "🔄 Ход",
    body: "Игроки по очереди задают вопросы о локации. Вопрос не должен быть слишком прямым; ответ должен показать, что вы «в теме». После ответа ход переходит отвечавшему.",
  },
  {
    id: "spy",
    label: "🕵️ Шпион",
    body: "Шпион не знает локацию, но может один раз попытаться её угадать. Если угадал — победа шпиона.",
  },
  {
    id: "voting",
    label: "🗳 Голосование",
    body: "После обсуждения игроки голосуют, кто считается шпионом. Изгнанный покидает игру; затем проверяется роль.",
  },
  {
    id: "modes",
    label: "⚙️ Режимы",
    body: "В игре доступны дополнительные режимы (роли, темы, несколько шпионов и др.) — их описание будет в лобби и в правилах полной версии.",
  },
];

export function RulesModal({ open, onClose }: RulesModalProps) {
  const [activeTabId, setActiveTabId] = useState<RuleTab["id"]>("core");
  const activeTab = RULE_TABS.find((t) => t.id === activeTabId) ?? RULE_TABS[0];

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
          aria-label="Правила игры"
        >
          <div
            className={styles.closeArea}
            onClick={() => {
              playUI("click");
              onClose();
            }}
            aria-hidden
          />

          <motion.div
            className={`glass ${styles.card}`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            onClick={(e: MouseEvent) => e.stopPropagation()}
          >
            <div className={styles.header}>
              <h2 className={styles.title}>Правила игры</h2>
            </div>

            <div className={styles.content}>
              <div className={styles.tabs} role="tablist">
                {RULE_TABS.map((tab) => {
                  const isActive = tab.id === activeTab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      className={`${styles.tab} ${isActive ? styles.tabActive : "glass glass-hover"}`}
                      onClick={() => {
                        playUI("click");
                        setActiveTabId(tab.id);
                      }}
                      onMouseEnter={() => playUI("hover")}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className={styles.tabPanel} role="tabpanel">
                <p className={styles.tabDescription}>{activeTab.body}</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
