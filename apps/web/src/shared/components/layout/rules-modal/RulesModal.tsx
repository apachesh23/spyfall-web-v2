"use client";

import { useState, type MouseEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  MatchEarlyVoteBlock,
  MatchHintQuestionBlock,
  MatchSpyBlock,
} from "@/features/match/components";
import { playUI } from "@/lib/sound";
import styles from "./RulesModal.module.css";

export type RulesModalProps = {
  open: boolean;
  onClose: () => void;
};

type RuleTab = {
  id: "core" | "flow" | "spy" | "voting" | "modes";
  label: string;
  description: string;
  points: string[];
};

const RULE_TABS: RuleTab[] = [
  {
    id: "core",
    label: "🎯 Суть игры",
    description:
      "Spyfall - это социальная игра на внимательность, дедукцию и блеф.\nИгроки задают друг другу вопросы, пытаясь понять, кто из них шпион.",
    points: [],
  },
  {
    id: "flow",
    label: "🔄 Ход игры",
    description: "Игроки по очереди задают друг другу вопросы о локации.",
    points: [
      "Вопрос должен быть не слишком прямым.",
      "Ответ должен показать, что игрок в теме.",
      "После ответа ход переходит отвечавшему.",
    ],
  },
  {
    id: "spy",
    label: "🕵️ Шпион",
    description: "Шпион не знает локацию, но может попытаться угадать ее 1 раз за игру.",
    points: [],
  },
  {
    id: "voting",
    label: "🗳 Голосование",
    description: "",
    points: [],
  },
  {
    id: "modes",
    label: "⚙️ Режимы",
    description: "",
    points: [],
  },
];

export function RulesModal({ open, onClose }: RulesModalProps) {
  const [activeTabId, setActiveTabId] = useState<RuleTab["id"]>("core");

  const activeTab = RULE_TABS.find((tab) => tab.id === activeTabId) ?? RULE_TABS[0];

  const handleBackdropClick = () => {
    playUI("click");
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
          aria-label="Правила игры"
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
              <h2 className={styles.title}>Правила игры</h2>
            </div>

            <div className={styles.content}>
              <div className={styles.tabs} role="tablist" aria-label="Разделы правил">
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
                {activeTab.id === "core" ? (
                  <div className={styles.coreContent}>
                    <p className={styles.tabDescription}>{activeTab.description}</p>

                    <h3 className={styles.coreSubtitle}>Цель игры</h3>

                    <div className={`${styles.coreParagraph} ${styles.coreParagraphInfo}`}>
                      <p>
                        Вы - команда <span className={styles.roleAgent}>мирных агентов</span> на секретной
                        локации.
                        <br />
                        Среди вас есть <span className={styles.roleSpy}>шпион</span>, который не знает, где
                        находится.
                      </p>
                    </div>

                    <div className={`${styles.coreParagraph} ${styles.coreParagraphGoal}`}>
                      <p>
                        <span className={styles.roleAgent}>Цель агентов</span> - вычислить шпиона до конца
                        игры.
                        <br />
                        <span className={styles.roleSpy}>Цель шпиона</span> - понять локацию и не выдать
                        себя.
                      </p>
                    </div>

                    <p className={styles.coreDuration}>
                      <span className={styles.durationBadge}>⏱ Длительность игры: 15 минут</span>
                    </p>
                  </div>
                ) : activeTab.id === "flow" ? (
                  <div>
                    <p className={styles.tabDescription}>{activeTab.description}</p>
                    <ol className={styles.flowSteps}>
                      {activeTab.points.map((point, index) => (
                        <li key={point}>
                          <span className={styles.flowStepIndex}>{index + 1}</span>
                          <span className={styles.flowStepText}>{point}</span>
                        </li>
                      ))}
                    </ol>

                    <p className={styles.flowHintLead}>Подсказка</p>
                    <p className={styles.flowHintText}>
                      Если трудно придумать вопрос, можно использовать подсказку:
                    </p>

                    <div className={styles.hintComponentWrap}>
                      <MatchHintQuestionBlock previewMode />
                    </div>

                    <p className={styles.flowHintNote}>
                      Система предложит универсальный вопрос, не привязанный к конкретной локации.
                    </p>
                  </div>
                ) : activeTab.id === "spy" ? (
                  <div className={styles.spyContent}>
                    <p className={styles.tabDescription}>{activeTab.description}</p>

                    <p className={styles.spyLead}>Попытка шпиона</p>
                    <div className={styles.spyPreviewWrap}>
                      <MatchSpyBlock previewMode />
                    </div>

                    <p className={styles.spyLead}>Дальше возможны два варианта:</p>
                    <ol className={styles.spySteps}>
                      <li>
                        <span className={styles.spyStepIndex}>1</span>
                        <span className={styles.spyStepText}>
                          если ответ <span className={styles.spyGood}>точный</span> - шпион сразу побеждает
                        </span>
                      </li>
                      <li>
                        <span className={styles.spyStepIndex}>2</span>
                        <span className={styles.spyStepText}>
                          если формулировка <span className={styles.spyWarning}>спорная</span> - игроки
                          решают, был ли ответ достаточно близким
                        </span>
                      </li>
                    </ol>

                    <p className={styles.spyLead}>Решение игроков</p>
                    <p className={styles.spyHintText}>Если ответ спорный, запускается голосование:</p>
                    <div className={styles.spyVotePreviewWrap}>
                      <div className={styles.voteBarWrap}>
                        <div className={styles.voteBarHeader}>
                          <div className={`${styles.voteStat} ${styles.voteStatYes}`}>
                            <span className={styles.statLabel}>УГАДАЛ</span>
                            <span className={styles.statPercent}>64%</span>
                          </div>
                          <div className={`${styles.voteStat} ${styles.voteStatNo}`}>
                            <span className={styles.statLabel}>НЕТ</span>
                            <span className={styles.statPercent}>36%</span>
                          </div>
                        </div>

                        <div className={styles.voteBarTrack}>
                          <div
                            className={`${styles.voteBarFill} ${styles.voteBarFillYes}`}
                            style={{ width: "64%" }}
                          />
                          <div
                            className={`${styles.voteBarFill} ${styles.voteBarFillNo}`}
                            style={{ width: "36%" }}
                          />
                        </div>
                      </div>

                      <div className={styles.voteActions}>
                        <button
                          type="button"
                          className={`${styles.voteBtn} ${styles.voteBtnYes}`}
                          onMouseEnter={() => playUI("hover")}
                          onClick={() => playUI("click")}
                        >
                          УГАДАЛ
                        </button>
                        <button
                          type="button"
                          className={`glass glass-hover ${styles.voteBtn} ${styles.voteBtnNo}`}
                          onMouseEnter={() => playUI("hover")}
                          onClick={() => playUI("click")}
                        >
                          НЕТ
                        </button>
                      </div>
                    </div>

                    <p className={styles.spyNote}>Решение принимается большинством голосов.</p>
                  </div>
                ) : activeTab.id === "voting" ? (
                  <div className={styles.votingContent}>
                    <h3 className={styles.votingTitle}>📣 Досрочное голосование</h3>
                    <p className={styles.votingText}>
                      Если кто-то кажется подозрительным, игроки могут начать голосование досрочно.
                      <br />
                      Для запуска нужно, чтобы более <span className={styles.votingChip}>50%</span> игроков
                      поддержали:
                    </p>

                    <p className={styles.votingLead}>Пример кнопки:</p>
                    <div className={styles.votingPreviewWrap}>
                      <MatchEarlyVoteBlock
                        isActive={false}
                        primaryLabel="ГОЛОСОВАТЬ 2/5"
                        onPrimaryClick={() => {}}
                        disabled
                      />
                    </div>

                    <p className={styles.votingLead}>После запуска:</p>
                    <ol className={styles.votingSteps}>
                      <li>
                        <span className={styles.votingStepIndex}>1</span>
                        <span className={styles.votingStepText}>
                          голосование длится <span className={styles.votingChip}>1 минуту</span>
                        </span>
                      </li>
                      <li>
                        <span className={styles.votingStepIndex}>2</span>
                        <span className={styles.votingStepText}>каждый игрок голосует за подозреваемого</span>
                      </li>
                      <li>
                        <span className={styles.votingStepIndex}>3</span>
                        <span className={styles.votingStepText}>либо может выбрать пропуск</span>
                      </li>
                    </ol>

                    <p className={styles.votingLead}>Результат:</p>
                    <div className={styles.votingSectionNote}>
                      <ul className={styles.votingList}>
                        <li>один лидер по голосам - игрок покидает игру</li>
                        <li>равенство между двумя - повторное голосование</li>
                        <li>повторное равенство - голосование отменяется</li>
                      </ul>
                    </div>

                    <p className={styles.votingLead}>Ограничения:</p>
                    <div className={styles.votingSectionNote}>
                      <ul className={styles.votingList}>
                        <li>
                          первое голосование доступно через <span className={styles.votingChip}>3 минуты</span>
                        </li>
                        <li>
                          всего <span className={styles.votingChip}>2 голосования</span> за игру
                        </li>
                        <li>
                          перезарядка между ними - <span className={styles.votingChip}>3 минуты</span>
                        </li>
                      </ul>
                    </div>

                    <h3 className={styles.votingTitle}>📢 Финальное голосование</h3>
                    <p className={styles.votingText}>
                      Когда время игры заканчивается, автоматически запускается финальное голосование.
                    </p>
                    <div className={styles.votingSectionNote}>
                      <ul className={styles.votingList}>
                        <li>участвуют все живые игроки</li>
                        <li>каждый игрок может отдать голос за подозреваемого</li>
                        <li>если игрок не проголосовал - его голос считается как пропуск</li>
                      </ul>
                    </div>

                    <p className={styles.votingLead}>Результат:</p>
                    <div className={styles.votingResultNote}>
                      Если выбран шпион - <span className={styles.votingGood}>побеждают агенты</span>.
                      <br />
                      Если выбран мирный или большинство не отдало голос -{" "}
                      <span className={styles.votingBad}>побеждает шпион</span>.
                    </div>
                  </div>
                ) : activeTab.id === "modes" ? (
                  <div className={styles.modesContent}>
                    <h3 className={styles.modesTitle}>Тема локации</h3>
                    <p className={styles.modesText}>
                      Все игроки, включая шпиона, получают общее описание локации.
                      <br />
                      Это помогает сузить круг вариантов.
                    </p>

                    <h3 className={styles.modesTitle}>Роли локации</h3>
                    <p className={styles.modesText}>
                      Игроки получают роли для отыгрыша.
                      <br />
                      Это добавляет разнообразие в вопросы и ответы.
                    </p>

                    <h3 className={styles.modesTitle}>Скрытая угроза</h3>
                    <p className={styles.modesText}>
                      Дополнительный режим для <span className={styles.modesChip}>5+ игроков</span> и только
                      с <span className={styles.modesChip}>одним шпионом</span>.
                      <br />
                      В этом режиме у шпиона две попытки за игру: угадать локацию и/или устранить игроков.
                    </p>

                    <p className={styles.modesLead}>Пример кнопок:</p>
                    <div className={styles.modesPreviewWrap}>
                      <MatchSpyBlock
                        modeHiddenThreat
                        previewMode
                        actionStatusLine="Использовано действий 0/2"
                      />
                    </div>

                    <ul className={styles.modesList}>
                      <li>
                        <span className={styles.modesGood}>Угадать локацию</span> - работает как обычно
                        (попытка победить сразу)
                      </li>
                      <li>
                        <span className={styles.modesWarning}>Устранить агента</span> - выбранный игрок
                        покидает игру
                      </li>
                    </ul>

                    <p className={styles.modesNote}>
                      Всего две попытки за партию — в любом сочетании угадываний и устранений.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className={styles.tabDescription}>{activeTab.description}</p>
                    <ul className={styles.tabList}>
                      {activeTab.points.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>

            <div className={styles.closeRow}>
              <button
                type="button"
                className={`glass glass-hover ${styles.closeBtn}`}
                onClick={handleBackdropClick}
                onMouseEnter={() => playUI("hover")}
              >
                ЗАКРЫТЬ
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
