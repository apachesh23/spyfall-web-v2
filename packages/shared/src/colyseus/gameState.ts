/**
 * Клиент (Next) и матчмейкинг. Сервер: дубль в `apps/game-server/src/schema/GameState.ts` — tsx не тянет workspace.
 */
import { defineTypes, MapSchema, Schema } from "@colyseus/schema";

/** Игрок в матче (состояние комнаты Colyseus). */
export class MatchPlayerState extends Schema {
  declare id: string;
  declare nickname: string;
  declare avatarId: number;
  declare isHost: boolean;
  declare isSpy: boolean;
  /** Роль на локации (мирный); у шпиона пусто. */
  declare roleAtLocation: string;
  /** Карточка шпиона (/locations/spyN.webp); у мирных пусто. */
  declare spyCardUrl: string;
}
defineTypes(MatchPlayerState, {
  id: "string",
  nickname: "string",
  avatarId: "number",
  isHost: "boolean",
  isSpy: "boolean",
  roleAtLocation: "string",
  spyCardUrl: "string",
});

/** Корень состояния SpyfallRoom — одна копия для game-server и web (join третьим аргументом). */
export class GameState extends Schema {
  declare phase: string;
  declare matchEndsAt: number;
  declare matchSessionId: string;
  /** Локация для мирных (шпион на клиенте не показывает). */
  declare locationName: string;
  /** Ключ картинки из БД (`image_key`) — клиент строит URL. */
  declare locationImageKey: string;
  /** Выбранная тема локации (если modeTheme). */
  declare themeText: string;
  declare modeTheme: boolean;
  declare modeRole: boolean;
  declare players: MapSchema<MatchPlayerState>;

  constructor() {
    super();
    this.players = new MapSchema<MatchPlayerState>();
  }
}
defineTypes(GameState, {
  phase: "string",
  matchEndsAt: "number",
  matchSessionId: "string",
  locationName: "string",
  locationImageKey: "string",
  themeText: "string",
  modeTheme: "boolean",
  modeRole: "boolean",
  players: { map: MatchPlayerState },
});
