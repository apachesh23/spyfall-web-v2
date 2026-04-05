"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { AgentCarousel } from "./agent-carousel/AgentCarousel";
import { EntryInput } from "./EntryInput";
import { PrimaryButton } from "@/shared/components/ui";
import { DEFAULT_AVATAR_ID } from "@/lib/avatars";
import { playUI } from "@/lib/sound";
import type { PlayerInput } from "@/types";
import styles from "../entry.module.css";
import { useRouteLoaderStore } from "@/store/route-loader-store";
import {
  peekStashedRoomPlayer,
  clearStashedRoomPlayer,
} from "@/lib/roomIdentityRecovery";

type InviteRoomFormProps = {
  urlCode: string;
};

export function InviteRoomForm({ urlCode: rawCode }: InviteRoomFormProps) {
  const isPlaceholderCode = rawCode === "null";
  const sanitizeRoomCode = (value: string) => value.replace(/\D/g, "").slice(0, 6);
  const initialCode = isPlaceholderCode ? "" : sanitizeRoomCode(rawCode);

  const router = useRouter();
  const stopGlobalLoader = useRouteLoaderStore((s) => s.stop);
  const [roomCode, setRoomCode] = useState(initialCode);
  const [form, setForm] = useState<PlayerInput>({
    nickname: "",
    avatar_id: DEFAULT_AVATAR_ID,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [nameError, setNameError] = useState(false);
  const [roomCodeError, setRoomCodeError] = useState(false);
  const [nameShakeTick, setNameShakeTick] = useState(0);
  const [roomCodeShakeTick, setRoomCodeShakeTick] = useState(0);
  const [checking, setChecking] = useState(true);

  async function checkExistingPlayer(currentCode: string) {
    let playerId = localStorage.getItem(`player_${currentCode}`);
    if (!playerId) {
      const stashed = peekStashedRoomPlayer(currentCode);
      if (stashed) playerId = stashed;
    }

    if (playerId) {
      const { data: player } = await supabase
        .from("players")
        .select("id, room_id")
        .eq("id", playerId)
        .single();

      if (player) {
        localStorage.setItem(`player_${currentCode}`, playerId);
        clearStashedRoomPlayer(currentCode);
        router.push(`/lobby/${currentCode}`);
        return;
      }
      localStorage.removeItem(`player_${currentCode}`);
      clearStashedRoomPlayer(currentCode);
    }
    setChecking(false);
  }

  useEffect(() => {
    setRoomCode(initialCode);
  }, [initialCode]);

  useEffect(() => {
    if (isPlaceholderCode || !initialCode) {
      setChecking(false);
      return;
    }
    void checkExistingPlayer(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- только при смене кода из URL
  }, [isPlaceholderCode, initialCode]);

  useEffect(() => {
    if (checking) return;
    const t = setTimeout(() => {
      stopGlobalLoader();
    }, 800);
    return () => clearTimeout(t);
  }, [checking, stopGlobalLoader]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const codeToUse = sanitizeRoomCode(roomCode.trim());
    if (!codeToUse) {
      playUI("wrong");
      setRoomCodeError(true);
      setRoomCodeShakeTick((v) => v + 1);
      return;
    }
    if (!form.nickname.trim()) {
      playUI("wrong");
      setNameError(true);
      setNameShakeTick((v) => v + 1);
      return;
    }
    setRoomCodeError(false);
    setNameError(false);
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: codeToUse,
          nickname: form.nickname.trim(),
          avatarId: form.avatar_id,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success && data.playerId) {
        localStorage.setItem(`player_${codeToUse}`, data.playerId);
        router.push(`/lobby/${data.roomCode}`);
      } else {
        setError(data.error || "Ошибка присоединения");
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError("Ошибка соединения");
      setLoading(false);
    }
  }

  if (checking) {
    return <p className={styles.checkingText}>Проверка...</p>;
  }

  return (
    <form onSubmit={handleSubmit} className={styles.formWrapper}>
      <div className={styles.topBlock}>
        <AgentCarousel
          selectedId={form.avatar_id}
          onSelect={(id) => setForm((p) => ({ ...p, avatar_id: id }))}
        />
      </div>

      <div className={styles.fieldRow}>
        <EntryInput
          layout="name"
          value={form.nickname}
          onChange={(nickname) => {
            setForm((p) => ({ ...p, nickname }));
            setNameError(false);
          }}
          placeholder="Ваше имя"
          maxLength={20}
          disabled={loading}
          error={nameError}
          shakeTrigger={nameShakeTick}
        />
      </div>

      <div className={styles.fieldRow}>
        <EntryInput
          layout="code"
          value={roomCode}
          onChange={(v) => {
            setRoomCode(sanitizeRoomCode(v));
            setRoomCodeError(false);
          }}
          placeholder="Код комнаты"
          maxLength={6}
          disabled={loading}
          error={roomCodeError}
          shakeTrigger={roomCodeShakeTick}
        />
      </div>

      {error ? (
        <div className={styles.errorBox}>
          <p className={styles.errorText}>{error}</p>
        </div>
      ) : null}

      <PrimaryButton
        type="submit"
        disabled={loading}
        loading={loading}
        lottieIcon="/lottie/key.json"
        soundClick="click"
        soundHover="hover"
      >
        {loading ? "Присоединяемся..." : "ПРИСОЕДИНИТЬСЯ"}
      </PrimaryButton>
    </form>
  );
}
