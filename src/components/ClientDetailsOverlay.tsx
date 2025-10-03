"use client";

import { useEffect, useMemo, useState } from "react";

type ClientDetailsOverlayProps = {
  client: {
    id: string;
    position: [number, number, number];
    color: [number, number, number];
    status?: "idle" | "processing" | "voted";
    connectedAt: number;
  };
  votes: Array<{
    question: string;
    vote: string;
    clientId: string;
  }>;
  query: {
    question: string;
    options: string[];
    timeToDecide: number;
  } | null;
  onClose: () => void;
};

function to255(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value * 255)));
}

function colorToHex(color: [number, number, number]): string {
  return `#${color.map((component) => to255(component).toString(16).padStart(2, "0")).join("")}`;
}

function colorToRgba(color: [number, number, number], alpha: number): string {
  const [r, g, b] = color.map((component) => to255(component));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes || hours) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(" ");
}

export default function ClientDetailsOverlay({ client, votes, query, onClose }: ClientDetailsOverlayProps) {
  const [connectedFor, setConnectedFor] = useState(() => formatDuration(Date.now() - client.connectedAt));

  useEffect(() => {
    const timer = setInterval(() => {
      setConnectedFor(formatDuration(Date.now() - client.connectedAt));
    }, 1000);

    return () => clearInterval(timer);
  }, [client.connectedAt]);

  const colorHex = useMemo(() => colorToHex(client.color), [client.color]);
  const tintSoft = useMemo(() => colorToRgba(client.color, 0.18), [client.color]);
  const tintStrong = useMemo(() => colorToRgba(client.color, 0.32), [client.color]);
  const tintHighlight = useMemo(() => colorToRgba(client.color, 0.45), [client.color]);

  const clientVotes = useMemo(
    () => votes.filter((vote) => vote.clientId === client.id).slice(-5).reverse(),
    [votes, client.id]
  );

  const positionLabel = useMemo(() => {
    if (!client.position) return "Unknown";
    const [x, y, z] = client.position.map((value) => value.toFixed(2));
    return `${x}, ${y}, ${z}`;
  }, [client.position]);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 24,
        right: 24,
        zIndex: 30,
        minWidth: 280,
        maxWidth: 360,
        padding: "18px 20px 20px",
        borderRadius: 18,
        border: `1px solid ${tintStrong}`,
        background: `linear-gradient(135deg, ${tintSoft}, rgba(15, 15, 15, 0.88))`,
        boxShadow: `0 18px 48px rgba(0,0,0,0.45), inset 0 1px 0 ${tintStrong}`,
        backdropFilter: "blur(16px) saturate(160%)",
        WebkitBackdropFilter: "blur(16px) saturate(160%)",
        color: "#f4f4f4",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: "0.75rem", letterSpacing: "0.12em", opacity: 0.62, textTransform: "uppercase" }}>
            Client
          </div>
          <div style={{ fontSize: "1.05rem", fontWeight: 600, letterSpacing: "0.04em" }}>
            Agent {client.id.slice(-4)}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            border: `1px solid ${tintStrong}`,
            borderRadius: 12,
            padding: "6px 12px",
            background: tintSoft,
            color: "inherit",
            cursor: "pointer",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            transition: "background 0.2s ease, border-color 0.2s ease",
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.background = tintHighlight;
            event.currentTarget.style.borderColor = tintHighlight;
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = tintSoft;
            event.currentTarget.style.borderColor = tintStrong;
          }}
        >
          Close
        </button>
      </header>

      <div style={{ display: "grid", rowGap: 10, fontSize: "0.85rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span style={{ opacity: 0.7 }}>Status</span>
          <span style={{ fontWeight: 600 }}>{client.status ?? "idle"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span style={{ opacity: 0.7 }}>Connected</span>
          <span style={{ fontWeight: 600 }}>{connectedFor}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <span style={{ opacity: 0.7 }}>Color</span>
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: 600 }}>{colorHex.toUpperCase()}</span>
            <span
              aria-hidden
              style={{
                display: "inline-block",
                width: 14,
                height: 14,
                borderRadius: "50%",
                border: `1px solid ${tintStrong}`,
                background: colorHex,
              }}
            />
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span style={{ opacity: 0.7 }}>Position</span>
          <span style={{ fontWeight: 600 }}>{positionLabel}</span>
        </div>
        {query && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ opacity: 0.7 }}>Active query</span>
            <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>{query.question}</span>
          </div>
        )}
      </div>

      <div>
        <div style={{ fontSize: "0.72rem", letterSpacing: "0.14em", opacity: 0.62, marginBottom: 8, textTransform: "uppercase" }}>
          Recent Votes
        </div>
        {clientVotes.length ? (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", rowGap: 8 }}>
            {clientVotes.map((vote, index) => (
              <li
                key={`${vote.question}-${index}`}
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: `1px solid ${tintStrong}`,
                  background: `linear-gradient(135deg, ${tintSoft}, rgba(255,255,255,0.02))`,
                  boxShadow: `inset 0 1px 0 ${tintStrong}`,
                }}
              >
                <div style={{ fontSize: "0.78rem", opacity: 0.72, marginBottom: 4 }}>{vote.question}</div>
                <div style={{ fontSize: "0.92rem", fontWeight: 600 }}>Vote: {vote.vote}</div>
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ fontSize: "0.82rem", opacity: 0.65 }}>
            No recorded votes for this agent yet.
          </div>
        )}
      </div>
    </div>
  );
}
