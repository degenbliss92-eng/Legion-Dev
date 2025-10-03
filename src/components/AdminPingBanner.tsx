"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSwarm } from "@/context/SwarmProvider";

function timeAgo(timestamp: number | null) {
  if (!timestamp) return "moments ago";
  const diff = Math.max(0, Date.now() - timestamp);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default function AdminPingBanner() {
  const {
    adminPing,
    hasRespondedToActivePing,
    submitPingResponse,
    isPingOverlayOpen,
    closePingOverlay,
  } = useSwarm();
  const [response, setResponse] = useState("");
  const [status, setStatus] = useState<"idle" | "sent">("idle");
  const [isFading, setIsFading] = useState(false);
  const fadeTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const FADE_DURATION = 400; // ms
  const VISIBLE_DURATION = 10000; // ms (10s)

  useEffect(() => {
    if (adminPing) {
      setResponse("");
      setStatus("idle");
    }
  }, [adminPing?.id]);

  // Auto-hide and fade logic: when a new adminPing opens, start timers to fade then close
  useEffect(() => {
    // clear any existing timers
    if (fadeTimerRef.current) {
      window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    if (!adminPing || !isPingOverlayOpen) {
      setIsFading(false);
      return;
    }

    setIsFading(false);

    // Start fade after VISIBLE_DURATION
    fadeTimerRef.current = window.setTimeout(() => {
      setIsFading(true);
    }, VISIBLE_DURATION);

    // Close overlay after fade completes
    closeTimerRef.current = window.setTimeout(() => {
      closePingOverlay();
    }, VISIBLE_DURATION + FADE_DURATION);

    return () => {
      if (fadeTimerRef.current) {
        window.clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [adminPing?.id, isPingOverlayOpen, closePingOverlay]);

  const disabled = !adminPing || hasRespondedToActivePing || status === "sent";

  const helperText = useMemo(() => {
    if (!adminPing) return "";
    if (hasRespondedToActivePing || status === "sent") return "Thanks for replying.";
    return "Replies route straight to the admin dashboard.";
  }, [adminPing, hasRespondedToActivePing, status]);

  if (!adminPing || !isPingOverlayOpen) return null;

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = response.trim();
    if (!trimmed || disabled) return;
    submitPingResponse(trimmed);
    setStatus("sent");
    closePingOverlay();
  };

  const closeBanner = () => {
    closePingOverlay();
  };

  return (
    <section
      style={{
        position: "fixed",
        right: 24,
        bottom: 88,
        width: "min(420px, calc(100% - 3rem))",
        zIndex: 1000,
        border: "1px solid rgba(255,255,255,0.16)",
        background: "rgba(12,12,14,0.95)",
        borderRadius: 16,
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.8rem",
        boxShadow: "0 18px 40px rgba(0,0,0,0.55)",
        backdropFilter: "blur(16px)",
        transition: `opacity ${FADE_DURATION}ms ease, transform ${FADE_DURATION}ms ease`,
        opacity: isFading ? 0 : 1,
        transform: isFading ? "translateY(8px)" : "translateY(0)",
        pointerEvents: isFading ? "none" : "auto",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.75rem",
        }}
      >
        <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>Message from Command</div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
          <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)" }}>
            {timeAgo(adminPing.createdAt)}
          </span>
          <button
            type="button"
            onClick={closeBanner}
            aria-label="Dismiss message"
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(30,30,32,0.85)",
              color: "rgba(255,255,255,0.7)",
              cursor: "pointer",
              fontSize: "0.75rem",
              lineHeight: "22px",
              textAlign: "center",
            }}
          >
            ×
          </button>
        </div>
      </header>

      <p style={{ margin: 0, fontSize: "0.85rem", lineHeight: 1.5, color: "rgba(240,240,242,0.92)" }}>
        {adminPing.message}
      </p>

      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        <textarea
          rows={3}
          value={response}
          onChange={(event) => setResponse(event.target.value)}
          disabled={disabled}
          placeholder={disabled ? "Response sent" : "Send a quick acknowledgement"}
          style={{
            resize: "none",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(22,22,24,0.9)",
            color: "#f5f5f5",
            fontSize: "0.82rem",
            padding: "0.65rem 0.75rem",
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.72rem", color: disabled ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.65)" }}>
            {helperText}
          </span>
          <button
            type="submit"
            disabled={disabled}
            style={{
              padding: "0.45rem 1.05rem",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.22)",
              background: disabled ? "rgba(255,255,255,0.1)" : "rgba(90,90,94,0.35)",
              color: "#f0f0f0",
              fontSize: "0.78rem",
              letterSpacing: "0.02em",
              cursor: disabled ? "default" : "pointer",
              transition: "background 0.2s",
            }}
          >
            {hasRespondedToActivePing || status === "sent" ? "Sent" : "Reply"}
          </button>
        </div>
      </form>
    </section>
  );
}


