"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";

type VotingSplashProps = {
  title: string;
  countdownLabel: string;
  countdownSeconds: number;
  eventAt: string;
  onClose: () => void;
  colors: { front: string; back: string };
};

function remainingSec(eventAt: string, totalSec: number): number {
  const elapsed = Math.floor((Date.now() - new Date(eventAt).getTime()) / 1000);
  const r = totalSec - (elapsed < 0 ? 0 : elapsed);
  return r > 0 ? r : 0;
}

export function VotingSplash({
  title,
  countdownLabel,
  countdownSeconds,
  eventAt,
  onClose,
  colors,
}: VotingSplashProps) {
  const [sec, setSec] = useState(() =>
    remainingSec(eventAt, countdownSeconds),
  );

  useEffect(() => {
    const t = setInterval(() => {
      setSec(remainingSec(eventAt, countdownSeconds));
    }, 500);
    return () => clearInterval(t);
  }, [eventAt, countdownSeconds]);

  const handleClose = useCallback(() => {
    if (sec > 0) return;
    onClose();
  }, [sec, onClose]);

  return (
    <motion.div
      className="voting-splash-root"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.75)",
      }}
    >
      <div
        style={{
          padding: "2rem 2.5rem",
          borderRadius: "0.75rem",
          background: `linear-gradient(145deg, ${colors.back}, ${colors.front})`,
          color: "#fff",
          textAlign: "center",
          fontFamily: "var(--font-tektur), Tektur, monospace",
          minWidth: "min(90vw, 360px)",
        }}
      >
        <h2 style={{ margin: "0 0 1rem", fontSize: "clamp(1.25rem, 4vw, 1.75rem)" }}>
          {title}
        </h2>
        <p style={{ margin: "0 0 0.5rem", opacity: 0.95 }}>{countdownLabel}</p>
        <p style={{ margin: "0 0 1.25rem", fontSize: "2.5rem", fontWeight: 700 }}>{sec}</p>
        <button
          type="button"
          onClick={handleClose}
          disabled={sec > 0}
          style={{
            padding: "0.5rem 1.25rem",
            borderRadius: "0.5rem",
            border: "1px solid rgba(255,255,255,0.4)",
            background: sec > 0 ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.15)",
            color: "#fff",
            cursor: sec > 0 ? "not-allowed" : "pointer",
          }}
        >
          Закрыть
        </button>
      </div>
    </motion.div>
  );
}
