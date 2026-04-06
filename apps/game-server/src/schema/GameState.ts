/**
 * Дублирует `packages/shared/src/colyseus/gameState.ts` — tsx + `@spyfall/shared` ломают класс
 * (не constructor / нет именованного экспорта при `tsx watch src/index.ts`). Next.js берёт shared.
 */
import { defineTypes, MapSchema, Schema } from "@colyseus/schema";

export class MatchPlayerState extends Schema {
  declare id: string;
  declare nickname: string;
  declare avatarId: number;
  declare isHost: boolean;
  declare isSpy: boolean;
  declare roleAtLocation: string;
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

export class GameState extends Schema {
  declare phase: string;
  declare matchEndsAt: number;
  declare matchSessionId: string;
  declare locationName: string;
  declare locationImageKey: string;
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
