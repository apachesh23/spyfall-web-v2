/**
 * Дублирует `packages/shared/src/colyseus/gameState.ts` — tsx + `@spyfall/shared` ломают класс
 * (не constructor / нет именованного экспорта при `tsx watch src/index.ts`). Next.js берёт shared.
 */
import { defineTypes, MapSchema, Schema } from "@colyseus/schema";

export class MatchPlayerState extends Schema {
  declare id: string;
  declare nickname: string;
}
defineTypes(MatchPlayerState, {
  id: "string",
  nickname: "string",
});

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
