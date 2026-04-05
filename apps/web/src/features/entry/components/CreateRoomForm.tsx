"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AgentCarousel } from "./agent-carousel/AgentCarousel";
import { EntryInput } from "./EntryInput";
import { PrimaryButton } from "@/shared/components/ui";
import { DEFAULT_AVATAR_ID } from "@/lib/avatars";
import { playUI } from "@/lib/sound";
import type { PlayerInput } from "@/types";
import styles from "../entry.module.css";
import { useRouteLoaderStore } from "@/store/route-loader-store";

export function CreateRoomForm() {
  const router = useRouter();
  const [form, setForm] = useState<PlayerInput>({
    nickname: "",
    avatar_id: DEFAULT_AVATAR_ID,
  });
  const [isCreating, setIsCreating] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [nameShakeTick, setNameShakeTick] = useState(0);
  const stopGlobalLoader = useRouteLoaderStore((s) => s.stop);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.nickname.trim()) {
      playUI("wrong");
      setNameError(true);
      setNameShakeTick((v) => v + 1);
      return;
    }
    setNameError(false);

    setIsCreating(true);

    try {
      const response = await fetch("/api/rooms/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: form.nickname.trim(),
          avatarId: form.avatar_id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Ошибка создания комнаты");
        setIsCreating(false);
        return;
      }

      localStorage.setItem(`player_${data.roomCode}`, data.playerId);
      router.push(`/lobby/${data.roomCode}`);
    } catch (error) {
      console.error(error);
      alert("Ошибка создания комнаты");
      setIsCreating(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      stopGlobalLoader();
    }, 800);
    return () => clearTimeout(t);
  }, [stopGlobalLoader]);

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
          disabled={isCreating}
          error={nameError}
          shakeTrigger={nameShakeTick}
        />
      </div>

      <PrimaryButton
        type="submit"
        disabled={isCreating}
        loading={isCreating}
        lottieIcon="/lottie/gamepad.json"
        soundClick="click"
        soundHover="hover"
      >
        {isCreating ? "Создаём..." : "СОЗДАТЬ КОМНАТУ"}
      </PrimaryButton>
    </form>
  );
}
