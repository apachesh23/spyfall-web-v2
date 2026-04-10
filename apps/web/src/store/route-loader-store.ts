import { create } from 'zustand';

type RouteLoaderState = {
  isVisible: boolean;
  /** Показать глобальный лоадер (накрывает всё приложение). */
  start: () => void;
  /** Спрятать глобальный лоадер. */
  stop: () => void;
};

export const useRouteLoaderStore = create<RouteLoaderState>((set) => ({
  // По умолчанию выключен. Включение: TopBar / лобби→play / MatchScreen useLayoutEffect (F5 на /play).
  isVisible: false,
  start: () => set({ isVisible: true }),
  stop: () => set({ isVisible: false }),
}));

