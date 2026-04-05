/**
 * Клиент (Next) и матчмейкинг. Сервер: дубль в `apps/game-server/src/schema/GameState.ts` — tsx не тянет workspace.
 */
import { defineTypes, MapSchema, Schema } from "@colyseus/schema";

/** Игрок в матче (состояние комнаты Colyseus). */
export class MatchPlayerState extends Schema {
  declare id: string;
  declare nickname: string;
}
defineTypes(MatchPlayerState, {
  id: "string",
  nickname: "string",
});

/** Корень состояния SpyfallRoom — одна копия для game-server и web (join третьим аргументом). */
export class GameState extends Schema {
  declare phase: string;
  declare matchEndsAt: number;
  declare matchSessionId: string;
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
  players: { map: MatchPlayerState },
});
