import { createServer } from "node:http";
import express from "express";
import { Server } from "colyseus";
import { COLYSEUS_ROOM_NAME } from "@spyfall/shared";
import { SpyfallRoom } from "./rooms/SpyfallRoom.js";

const port = Number(process.env.PORT ?? 2567);

const app = express();
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "@spyfall/game-server" });
});

const httpServer = createServer(app);
const gameServer = new Server({ server: httpServer });

gameServer.define(COLYSEUS_ROOM_NAME, SpyfallRoom);

void gameServer.listen(port).then(() => {
  console.log(`Colyseus listening on http://localhost:${port} (health: /health)`);
});
