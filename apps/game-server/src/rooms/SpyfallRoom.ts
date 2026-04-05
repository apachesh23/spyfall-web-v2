import { Client, Room } from "colyseus";
import { WS_CLIENT_MESSAGE } from "@spyfall/shared";

export class SpyfallRoom extends Room {
  override onCreate() {
    this.onMessage(WS_CLIENT_MESSAGE.ping, (client: Client, payload: { t?: number }) => {
      client.send("pong", { t: payload?.t ?? 0, serverTime: Date.now() });
    });
  }
}
