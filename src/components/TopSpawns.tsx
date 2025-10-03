"use client";

import { useEffect, useMemo, useState } from "react";
import { useSwarm } from "@/context/SwarmProvider";

const REFRESH_INTERVAL_MS = 1000;
const TOP_COUNT = 8;

type LeaderItem = {
  id: string;
  voteCount: number;
  activeMs: number;
  color: [number, number, number];
};

function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "just connected";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const segments: string[] = [];
  if (hours) segments.push(`${hours}h`);
  if (minutes) segments.push(`${minutes}m`);
  if (!hours && !minutes) segments.push(`${seconds}s`);
  return segments.join(" ");
}

export default function TopSpawns() {
  const { clients, votes } = useSwarm();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  const leaderboard = useMemo<LeaderItem[]>(() => {
    if (!clients.length) return [];

    const voteCounts = votes.reduce<Record<string, number>>((acc, vote) => {
      acc[vote.clientId] = (acc[vote.clientId] ?? 0) + 1;
      return acc;
    }, {});

    return clients
      .map((client) => ({
        id: client.id,
        voteCount: voteCounts[client.id] ?? 0,
        activeMs: Math.max(0, now - (client.connectedAt ?? now)),
        color: client.color,
      }))
      .sort((a, b) => {
        if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
        return b.activeMs - a.activeMs;
      })
      .slice(0, TOP_COUNT);
  }, [clients, votes, now]);

  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "12px",
        padding: "1rem",
        background: "rgba(255,255,255,0.02)",
        color: "white",
        minHeight: 0,
      }}
    >
      <header style={{ marginBottom: "0.75rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>Top Spawns</h2>
        <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", margin: 0 }}>
          Most engaged agents by vote participation
        </p>
      </header>

      {leaderboard.length === 0 ? (
        <div style={{ color: "rgba(255,255,255,0.6)" }}>No active spawns yet.</div>
      ) : (
        <ol
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gap: "0.65rem",
            overflowY: "auto",
          }}
        >
          {leaderboard.map((item, index) => {
            const color = `rgb(${Math.round(item.color[0] * 255)}, ${Math.round(
              item.color[1] * 255
            )}, ${Math.round(item.color[2] * 255)})`;

            return (
              <li
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "10px",
                  padding: "0.6rem 0.75rem",
                  background: "rgba(0,0,0,0.18)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: color,
                      color: "black",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }}
                  >
                    {index + 1}
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontWeight: 600 }}>Agent {item.id.slice(-4)}</span>
                    <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.65)" }}>
                      {`${item.voteCount} vote${item.voteCount === 1 ? "" : "s"}`}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: "right", fontSize: "0.75rem", color: "rgba(255,255,255,0.7)" }}>
                  Active {formatDuration(item.activeMs)}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
