import type { AvatarId } from '@/lib/avatars';

/**
 * Типы баннеров SplashScreen (матч / Colyseus).
 * system_* и лобби-API удалены — старт и пауза не через сплэш.
 */
export type SplashType =
  | 'game_over_spy_win' // Шпион угадал локацию (будущая механика)
  | 'game_over_spy_win_voting' // Шпион победил (мирные выгнали мирного, шпион остался)
  | 'game_over_civilians_win' // Победа мирных (агентов)
  | 'spy_kill' // Другая механика — пока не подключена
  | 'voting_kicked_civilian'; // Изгнание голосованием

export type SplashColors = {
  back: string;
  front: string;
};

export const SPLASH_CONFIG: Record<
  SplashType,
  { colors: SplashColors; static: boolean; defaultCountdown?: number; countdownLabel?: string }
> = {
  game_over_spy_win: {
    colors: { back: '#1a3314', front: '#326528' },
    static: true,
  },
  game_over_spy_win_voting: {
    colors: { back: '#1a3314', front: '#326528' },
    static: true,
  },
  game_over_civilians_win: {
    colors: { back: '#1a3314', front: '#326528' },
    static: true,
  },
  spy_kill: {
    colors: { back: '#B53A3A', front: '#ED4C4C' },
    static: false,
    defaultCountdown: 10,
    countdownLabel: 'Игра продолжается...',
  },
  voting_kicked_civilian: {
    colors: { back: '#B77918', front: '#F3A221' },
    static: false,
    defaultCountdown: 10,
    countdownLabel: 'Игра продолжается...',
  },
};

export type SplashScreenProps = {
  type: SplashType;
  onClose?: () => void;
  countdownSeconds?: number;
  countdownLabel?: string;
  /** Серверное время окончания таймера (ISO). Приоритет для синхронизации между клиентами. */
  endsAt?: string;
  title?: string;
  subtitle?: string;
  static?: boolean;
  eventAt?: string;
  /** Сдвиг локальных часов относительно сервера (как в голосовании). */
  clockSkewMs?: number;
  /** Только победные сплэши: ведущий завершает матч и возвращает всех в лобби. */
  onVictoryHostEndGame?: () => void;
  victoryEndGameBusy?: boolean;
  players?: Array<{
    id: string;
    nickname: string;
    avatar_id: AvatarId;
    is_spy?: boolean;
    eliminated?: boolean;
  }>;
  spyIds?: string[];
  /** Для game_over_spy_win: конкретный шпион, который угадал локацию. */
  guessedSpyId?: string;
  eliminatedPlayer?: { nickname: string; avatar_id: AvatarId; role?: string | null };
  eliminatedWasSpy?: boolean;
  eliminatedVotePercent?: number;
  /** Сколько шпионов было в ростере при старте матча — варианты текста победы мирных (2–3). */
  initialSpyCount?: number;
  /**
   * Режим лобби «Шпионский хаос»: неизвестно начальное число шпионов — на сплэше изгнания роль скрыта («ЗАСЕКРЕЧЕНО»).
   * При выключенном хаосе с фиксированным числом шпионов показываем ШПИОН / МИРНЫЙ.
   */
  modeSpyChaos?: boolean;
};
