"use client";

import { useEffect, useRef, useState } from "react";

type TourOverlayProps = {
  isOpen: boolean;
  step: number;
  onNext: () => void;
  onSkip: () => void;
};

export const TOUR_STEPS: { title: string; body: string; selector?: string }[] = [
  {
    title: "Explore the Swarm",
    body: "Pan, zoom, and click agents to inspect the Legion neural network in real time.",
    selector: "#swarm-canvas-area",
  },
  {
    title: "Control the View",
    body: "Use the camera controls to reset or zoom through the Legion space.",
    selector: "#camera-controls",
  },
  {
    title: "Commune in Real Time",
    body: "Use the Commune panel to broadcast messages and collaborate with agents.",
    selector: "#commune-panel",
  },
  {
    title: "Track Collective Decisions",
    body: "Watch Legion Collective for live voting progress and consensus analytics.",
    selector: "#right-sidebar",
  },
];

export const TOUR_LENGTH = TOUR_STEPS.length;

type HighlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export default function TourOverlay({ isOpen, step, onNext, onSkip }: TourOverlayProps) {
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null);

  useEffect(() => {
    if (!isOpen || !indicatorRef.current) return;
    indicatorRef.current.style.opacity = "1";
  }, [isOpen, step]);

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;

    const selector = TOUR_STEPS[Math.min(step, TOUR_STEPS.length - 1)].selector;

    const resolveHighlight = () => {
      if (!selector) {
        setHighlightRect(null);
        return;
      }

      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) {
        setHighlightRect(null);
        return;
      }

      const rect = el.getBoundingClientRect();
      setHighlightRect({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height,
      });
    };

    resolveHighlight();
    const handle = () => resolveHighlight();
    window.addEventListener("resize", handle);
    window.addEventListener("scroll", handle, true);
    return () => {
      window.removeEventListener("resize", handle);
      window.removeEventListener("scroll", handle, true);
    };
  }, [isOpen, step]);

  if (!isOpen) return null;

  const isLast = step >= TOUR_STEPS.length - 1;
  const current = TOUR_STEPS[Math.min(step, TOUR_STEPS.length - 1)];

  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        pointerEvents: "auto",
      }}
    >
      {highlightRect ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "transparent",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: highlightRect.top - 16,
              left: highlightRect.left - 16,
              width: highlightRect.width + 32,
              height: highlightRect.height + 32,
              borderRadius: 22,
              border: "2px solid rgba(102,204,255,0.9)",
              boxShadow: "0 0 0 9999px rgba(5,5,12,0.72)",
              background: "rgba(102,204,255,0.12)",
              pointerEvents: "none",
              transition: "all 0.3s ease",
            }}
          />
        </div>
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(5, 5, 12, 0.78)",
            backdropFilter: "blur(10px)",
          }}
        />
      )}

      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: "min(92vw, 420px)",
            background: "rgba(18, 18, 24, 0.96)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 18,
            padding: "32px 36px",
            color: "#f5f5f8",
            boxShadow: "0 28px 60px rgba(0,0,0,0.55)",
            textAlign: "center",
            pointerEvents: "auto",
          }}
        >
          <div
            ref={indicatorRef}
            style={{
              marginBottom: 18,
              fontSize: "0.75rem",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "rgba(200,200,210,0.8)",
              transition: "opacity 0.45s ease",
              opacity: 0,
            }}
          >
            Step {Math.min(step + 1, TOUR_STEPS.length)} of {TOUR_STEPS.length}
          </div>
          <h3
            style={{
              margin: "0 0 12px",
              fontSize: "1.35rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            {current.title}
          </h3>
          <p style={{ margin: "0 0 28px", lineHeight: 1.6, color: "rgba(230,230,240,0.88)" }}>
            {current.body}
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
            <button
              type="button"
              onClick={onSkip}
              style={{
                padding: "10px 20px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.25)",
                background: "rgba(24, 24, 30, 0.92)",
                color: "rgba(235,235,240,0.8)",
                fontSize: "0.85rem",
                letterSpacing: "0.08em",
                cursor: "pointer",
              }}
            >
              Skip
            </button>
            <button
              type="button"
              onClick={onNext}
              style={{
                padding: "10px 26px",
                borderRadius: 999,
                border: "none",
                background: "linear-gradient(135deg, rgba(140,140,148,0.95), rgba(48,48,52,0.95))",
                color: "rgba(240,240,245,0.92)",
                fontWeight: 600,
                fontSize: "0.9rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                cursor: "pointer",
                boxShadow: "0 20px 36px rgba(60,60,75,0.32)",
              }}
            >
              {isLast ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
