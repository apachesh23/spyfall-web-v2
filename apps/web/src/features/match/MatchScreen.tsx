"use client";

import { Client, type Room } from "colyseus.js";
import Link from "next/link";
import { useEffect, useState } from "react";
import { COLYSEUS_ROOM_NAME, WS_CLIENT_MESSAGE } from "@spyfall/shared";

type MatchScreenProps = {
  sessionId: string;
  colyseusUrl: string;
};

export function MatchScreen({ sessionId, colyseusUrl }: MatchScreenProps) {
  const [status, setStatus] = useState<"idle" | "connecting" | "ok" | "error">(
    "idle",
  );
  const [pong, setPong] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    const client = new Client(colyseusUrl);
    let room: Room | undefined;

    const run = async () => {
      setStatus("connecting");
      try {
        room = await client.joinOrCreate(COLYSEUS_ROOM_NAME);
        if (disposed) {
          await room.leave();
          return;
        }
        setStatus("ok");
        room.onMessage("pong", (payload) => {
          setPong(JSON.stringify(payload));
        });
        room.send(WS_CLIENT_MESSAGE.ping, { t: Date.now() });
      } catch {
        if (!disposed) setStatus("error");
      }
    };

    void run();

    return () => {
      disposed = true;
      void room?.leave();
    };
  }, [colyseusUrl]);

  return (
    <div className="shell shell--wide">
      <Link href="/" className="link-muted">
        ← На главную
      </Link>
      <div>
        <h1 className="title-page">Матч</h1>
        <p className="lead">
          Session id (заглушка):{" "}
          <span className="mono-inline">{sessionId}</span>
        </p>
      </div>
      <div className="card card--panel">
        <p className="card__title">Colyseus</p>
        <p className="card__row">
          URL: <span className="card__mono">{colyseusUrl}</span>
        </p>
        <p className="card__row">
          Статус:{" "}
          <span className="card__mono">
            {status === "idle" && "ожидание"}
            {status === "connecting" && "подключение…"}
            {status === "ok" && "комната открыта"}
            {status === "error" && "ошибка (сервер выключен?)"}
          </span>
        </p>
        {pong ? <p className="pong-line">pong: {pong}</p> : null}
      </div>
    </div>
  );
}
