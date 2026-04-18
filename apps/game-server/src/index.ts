import { createServer } from "node:http";
import express from "express";
import "colyseus";
import { Server } from "@colyseus/core";
import { loadGameServerEnv } from "./loadEnv.js";
import { COLYSEUS_ROOM_NAME } from "./matchContract.js";
import { SpyfallRoom } from "./rooms/SpyfallRoom.js";

loadGameServerEnv();

const port = Number(process.env.PORT ?? 2567);

const app = express();
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "@spyfall/game-server" });
});

const httpServer = createServer(app);
const gameServer = new Server({ server: httpServer });

/** Иначе joinOrCreate цепляется к любой свободной комнате с тем же именем — чужой матч, 0 с, пустые игроки. */
gameServer.define(COLYSEUS_ROOM_NAME, SpyfallRoom).filterBy(["matchSessionId"]);

const LISTEN_ATTEMPTS = 10;
const LISTEN_RETRY_MS = 400;

async function startListening() {
  let lastErr: unknown;
  for (let i = 0; i < LISTEN_ATTEMPTS; i++) {
    try {
      await gameServer.listen(port);
      console.log(`Colyseus listening on http://localhost:${port} (health: /health)`);
      console.log(
        `[game-server] matchmake: room "${COLYSEUS_ROOM_NAME}" uses filterBy(matchSessionId) — смотри логи [SpyfallRoom] onCreate/onJoin`,
      );
      return;
    } catch (err) {
      lastErr = err;
      const code =
        err && typeof err === "object" && "code" in err
          ? (err as NodeJS.ErrnoException).code
          : undefined;
      if (code === "EADDRINUSE" && i < LISTEN_ATTEMPTS - 1) {
        console.warn(
          `[game-server] порт ${port} занят (часто после перезапуска tsx watch). Повтор ${i + 2}/${LISTEN_ATTEMPTS} через ${LISTEN_RETRY_MS} мс…`,
        );
        await new Promise((r) => setTimeout(r, LISTEN_RETRY_MS));
        continue;
      }
      break;
    }
  }
  console.error(
    `[game-server] не удалось занять порт ${port}. Останови другой экземпляр game-server или процесс, держащий порт (например старый node). Ошибка:`,
    lastErr,
  );
  process.exit(1);
}

void startListening();
