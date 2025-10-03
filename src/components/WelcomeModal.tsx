"use client";

import { useEffect, useRef, useState } from "react";

type WelcomeModalProps = {
  isOpen: boolean;
  onConnect: () => void;
};

export default function WelcomeModal({ isOpen, onConnect }: WelcomeModalProps) {
  const [hovered, setHovered] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [progress, setProgress] = useState(0);

  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsConnecting(false);
      setIsFadingOut(false);
      setHovered(false);
      setProgress(0);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    };
  }, []);

  if (!isOpen && !isFadingOut) {
    return null;
  }

  const handleConnect = () => {
    if (isConnecting) return;
    setIsConnecting(true);
    setProgress(0);

    progressTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 5;
        return next > 100 ? 100 : next;
      });
    }, 100);

    fadeTimerRef.current = setTimeout(() => {
      setIsFadingOut(true);
    }, 1800);

    completeTimerRef.current = setTimeout(() => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      onConnect();
    }, 2000);
  };

  const buttonBackground = hovered && !isConnecting
    ? "linear-gradient(135deg, rgba(150,150,156,0.95), rgba(55,55,60,0.95))"
    : "linear-gradient(135deg, rgba(120,120,128,0.95), rgba(40,40,44,0.95))";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-hidden={isConnecting}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.92)",
        backdropFilter: "blur(12px)",
        backgroundImage: "url(/bg.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        opacity: isFadingOut ? 0 : 1,
        pointerEvents: isFadingOut ? "none" : "auto",
        transition: "opacity 0.6s ease",
      }}
    >
      <div
        style={{
          background: "rgba(15, 15, 20, 0.96)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 18,
          padding: "36px 44px",
          maxWidth: 420,
          width: "min(90vw, 420px)",
          textAlign: "center",
          boxShadow: "0 32px 60px rgba(0,0,0,0.55)",
          color: "#f5f5f8",
        }}
      >
        <h2
          style={{
            margin: 0,
            marginBottom: 16,
            fontSize: "1.6rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          Welcome Agent
        </h2>
        <p style={{ margin: 0, marginBottom: 28, lineHeight: 1.6, color: "rgba(245,245,250,0.85)" }}>
          Legion welcomes you.
        </p>
        <button
          type="button"
          onClick={handleConnect}
          onMouseEnter={() => !isConnecting && setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          disabled={isConnecting}
          style={{
            padding: "12px 36px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.22)",
            background: buttonBackground,
            color: "rgba(240,240,245,0.92)",
            fontWeight: 600,
            fontSize: "0.95rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: isConnecting ? "default" : "pointer",
            boxShadow: hovered && !isConnecting
              ? "0 26px 45px rgba(120,120,140,0.35)"
              : "0 20px 38px rgba(60,60,75,0.3)",
            transition: "all 0.25s ease",
            opacity: isConnecting ? 0.85 : 1,
            minWidth: 220,
          }}
        >
          {isConnecting ? (
            <div
              style={{
                width: "100%",
                height: 6,
                borderRadius: 4,
                background: "rgba(20,20,26,0.7)",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  width: `${progress}%`,
                  background: "linear-gradient(135deg, rgba(220,220,230,0.85), rgba(120,120,128,0.85))",
                  transition: "width 0.1s linear",
                }}
              />
            </div>
          ) : (
            "Connect"
          )}
        </button>
      </div>
    </div>
  );
}
