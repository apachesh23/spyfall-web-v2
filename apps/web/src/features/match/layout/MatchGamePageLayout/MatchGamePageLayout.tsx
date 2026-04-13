"use client";

import { PlayerList } from "@/features/player";
import type { Player } from "@/types/player";
import {
  MatchEarlyVoteBlock,
  MatchGameTimer,
  MatchHintQuestionBlock,
  MatchLocationImage,
  MatchModeCard,
  MatchSpyBlock,
} from "../../components";
import type { MatchSpyBlockProps } from "../../components/MatchSpyBlock/MatchSpyBlock";
import styles from "./MatchGamePageLayout.module.css";

export type MatchGamePageLayoutProps = {
  isMobile: boolean;
  /** Отступ сверху под фиксированную dev-панель (px) */
  topInsetPx?: number;
  themeCardValue: string;
  locationCardValue: string;
  roleCardValue: string;
  isSpy: boolean;
  players: Player[];
  currentPlayerId: string | null;
  onlinePlayers: Set<string>;
  clockDisplay: string;
  timerTone: "normal" | "warn" | "danger";
  /** Пауза матча (Supabase): «ПАУЗА» вместо цифр */
  timerPaused?: boolean;
  locationImageKey: string;
  spyCardUrl: string;
  /** Фиксированные кнопки ведущего + заглушки */
  hostAside: React.ReactNode;
  /** Доп. блоки под сеткой (например JSON matchDebug) */
  footerExtras?: React.ReactNode;
  /** Supabase `rooms.id` — случайный вопрос без повторов внутри партии */
  hintGameId?: string | null;
  /** Мобильный футер: Hint + «Панель управления» + реакции (как в лобби) */
  footerBar?: React.ReactNode;
  /** Досрочное голосование (Colyseus) */
  earlyVoteShowPrimary?: boolean;
  earlyVotePrimaryLabel?: string;
  earlyVoteSecondaryLabel?: string;
  earlyVoteIsActive?: boolean;
  onEarlyVoteToggle?: () => void;
  earlyVoteDisabled?: boolean;
  /** Изгнанный игрок — жёлтая кнопка скрыта, показ «ВЫ ВЫБЫЛИ» */
  earlyVoteEliminated?: boolean;
  /** Живая панель шпиона в матче (иначе при isSpy — превью для вёрстки). */
  spyBlockLive?: Omit<MatchSpyBlockProps, "previewMode" | "className"> | null;
};

export function MatchGamePageLayout({
  isMobile,
  topInsetPx = 0,
  themeCardValue,
  locationCardValue,
  roleCardValue,
  isSpy,
  players,
  currentPlayerId,
  onlinePlayers,
  clockDisplay,
  timerTone,
  timerPaused = false,
  locationImageKey,
  spyCardUrl,
  hostAside,
  footerExtras,
  hintGameId = null,
  footerBar = null,
  earlyVoteShowPrimary = true,
  earlyVotePrimaryLabel,
  earlyVoteSecondaryLabel = "ГОЛОСОВАНИЕ НЕДОСТУПНО",
  earlyVoteIsActive = false,
  onEarlyVoteToggle,
  earlyVoteDisabled = false,
  earlyVoteEliminated = false,
  spyBlockLive = null,
}: MatchGamePageLayoutProps) {
  const totalPlayers = Math.max(1, players.length);
  const earlyVoteLabel =
    earlyVotePrimaryLabel ?? `ГОЛОСОВАТЬ 0/${Math.max(1, Math.floor(totalPlayers / 2) + 1)}`;

  if (isMobile) {
    return (
      <>
        {hostAside}
        <div className={styles.pageBody} style={{ paddingTop: topInsetPx }}>
        <div className={styles.mobileRoot}>
          <div className={styles.mobileFixedTop}>
            <div className={styles.mobilePlayerListWrap}>
              <PlayerList
                layout="game"
                players={players}
                currentPlayerId={currentPlayerId}
                onlinePlayers={onlinePlayers}
                isHost={false}
                hideMinPlaceholders
              />
            </div>
          </div>
          <div className={styles.mobileScroll}>
            <div className={styles.mobileModes}>
              <div className={`glass ${styles.mobileModeCard}`}>
                <MatchModeCard noGlass variant="theme" value={themeCardValue} />
              </div>
              {isSpy ? (
                <div className={styles.mobileSpyBlock}>
                  {spyBlockLive ? (
                    <MatchSpyBlock previewMode={false} {...spyBlockLive} />
                  ) : (
                    <MatchSpyBlock previewMode />
                  )}
                </div>
              ) : (
                <>
                  <div className={`glass ${styles.mobileModeCard}`}>
                    <MatchModeCard noGlass variant="location" value={locationCardValue} />
                  </div>
                  <div className={`glass ${styles.mobileModeCard}`}>
                    <MatchModeCard noGlass variant="role" value={roleCardValue} />
                  </div>
                </>
              )}
            </div>

            <div className={styles.mobileImageColumn}>
              <div className={styles.mobileStackTimer}>
                <MatchGameTimer
                  clock={clockDisplay}
                  tone={timerTone}
                  variant="block"
                  paused={timerPaused}
                />
              </div>
              <div className={styles.mobileImageWrap}>
                <div className={styles.mobileImageInner}>
                  <MatchLocationImage
                    key={`m-${locationImageKey}-${isSpy}-${spyCardUrl}`}
                    imageKey={locationImageKey}
                    isSpy={isSpy}
                    spyCardUrl={spyCardUrl || undefined}
                  />
                </div>
              </div>
            </div>

            <div className={styles.mobileEarlyVote}>
              <MatchEarlyVoteBlock
                showPrimaryButton={earlyVoteShowPrimary}
                primaryLabel={earlyVoteLabel}
                secondaryLabel={earlyVoteSecondaryLabel}
                isActive={earlyVoteIsActive}
                onPrimaryClick={onEarlyVoteToggle}
                disabled={earlyVoteDisabled}
                eliminated={earlyVoteEliminated}
              />
            </div>
          </div>
        </div>

        {footerExtras ? <div className={styles.footerStack}>{footerExtras}</div> : null}
        </div>
        {footerBar ? <footer className={styles.matchPageFooter}>{footerBar}</footer> : null}
      </>
    );
  }

  return (
    <>
      {hostAside}
      <div className={styles.pageBody} style={{ paddingTop: topInsetPx }}>
      <div className={styles.contentGrid}>
        <div className={styles.leftCol}>
          <div className={`glass ${styles.glassBlock} ${styles.glassBlockCard}`}>
            <MatchModeCard noGlass variant="theme" value={themeCardValue} />
          </div>
          <div className={styles.playerListWrap}>
            <PlayerList
              layout="game"
              players={players}
              currentPlayerId={currentPlayerId}
              onlinePlayers={onlinePlayers}
              isHost={false}
              hideMinPlaceholders
            />
          </div>
          <div className={styles.timerWrap}>
            <MatchHintQuestionBlock gameId={hintGameId} />
          </div>
        </div>

        <div className={styles.rightCol}>
          <div
            className={`${styles.modeCardsRow} ${isSpy ? styles.modeCardsRowSingle : ""} ${isSpy ? styles.modeCardsRowSpy : ""}`}
          >
            {isSpy ? (
              spyBlockLive ? (
                <MatchSpyBlock previewMode={false} {...spyBlockLive} />
              ) : (
                <MatchSpyBlock previewMode />
              )
            ) : (
              <>
                <MatchModeCard variant="location" value={locationCardValue} />
                <MatchModeCard variant="role" value={roleCardValue} />
              </>
            )}
          </div>
          <div className={styles.imagePlaceholderWrap}>
            <div className={styles.imageStackTimer}>
              <MatchGameTimer
                clock={clockDisplay}
                tone={timerTone}
                variant="block"
                paused={timerPaused}
              />
            </div>
            <div className={styles.imageStackPicture}>
              <MatchLocationImage
                key={`d-${locationImageKey}-${isSpy}-${spyCardUrl}`}
                imageKey={locationImageKey}
                isSpy={isSpy}
                spyCardUrl={spyCardUrl || undefined}
              />
            </div>
          </div>
          <div className={styles.earlyVoteWrap}>
            <MatchEarlyVoteBlock
              showPrimaryButton={earlyVoteShowPrimary}
              primaryLabel={earlyVoteLabel}
              secondaryLabel={earlyVoteSecondaryLabel}
              isActive={earlyVoteIsActive}
              onPrimaryClick={onEarlyVoteToggle}
              disabled={earlyVoteDisabled}
              eliminated={earlyVoteEliminated}
            />
          </div>
        </div>
      </div>

      {footerExtras ? <div className={styles.footerStack}>{footerExtras}</div> : null}
      </div>
    </>
  );
}
