"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const REFRESH_INTERVAL_MS = 30_000;
const PRINCIPAL_SERVICE_URL = process.env.NEXT_PUBLIC_PRINCIPAL_SERVICE_URL ?? "http://localhost:4000";

function shortAddress(address?: string | null) {
  if (!address) return "unknown";
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function formatTimestamp(timestamp: number | null) {
  if (!timestamp) return "just now";
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

type ActivityItem = {
  signature: string;
  timestamp: number | null;
  summary: string;
  direction: "in" | "out" | "neutral";
  amount: number | null;
  symbol: string | null;
  rawType: string;
  from: string | null;
  to: string | null;
};

type ApiResponse = {
  address?: string;
  items?: ActivityItem[];
  error?: string;
  detail?: string;
  cached?: boolean;
  stale?: boolean;
  fetchedAt?: number;
};

export default function LiveActivityPanel() {
  const [address, setAddress] = useState<string | null>(null);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const requestUrl = new URL("/helius/transactions", PRINCIPAL_SERVICE_URL);
      const response = await fetch(requestUrl.toString(), {
        cache: "no-store",
        mode: "cors",
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as ApiResponse;
      setAddress(payload.address ?? null);
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setStale(Boolean(payload.stale));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setStale(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
    const interval = setInterval(fetchActivities, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchActivities]);

  const headingSubtext = useMemo(() => {
    if (error) return "Unable to load recent transactions";
    if (loading && !items.length) return "Loading recent transactions...";
    if (!items.length) return "No recent activity detected";
    const base = `Monitoring ${shortAddress(address)}`;
    return stale ? `${base} (cached)` : base;
  }, [address, error, items.length, loading, stale]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "12px",
        padding: "1rem",
        background: "rgba(255,255,255,0.02)",
        color: "white",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <header style={{ marginBottom: "0.8rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>Live Activity</h2>
          <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.6)", margin: 0 }}>{headingSubtext}</p>
        </div>
        <button
          onClick={fetchActivities}
          disabled={loading}
          style={{
            padding: "0.35rem 0.75rem",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.25)",
            background: "rgba(255,255,255,0.08)",
            color: "white",
            cursor: loading ? "default" : "pointer",
            fontSize: "0.75rem",
          }}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          fontSize: "0.8rem",
          lineHeight: 1.4,
          display: "grid",
          gap: "0.65rem",
        }}
      >
        {error ? (
          <div style={{ color: "#ff9e9e" }}>{error}</div>
        ) : items.length === 0 ? (
          <div style={{ color: "rgba(255,255,255,0.6)" }}>Waiting for the next transaction...</div>
        ) : (
          items.map((item) => {
            const tone =
              item.direction === "in" ? "#9effa2" : item.direction === "out" ? "#ff9e9e" : "#9ecaff";
            return (
              <div
                key={item.signature}
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "10px",
                  padding: "0.65rem",
                  background: "rgba(0,0,0,0.2)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                  <span style={{ color: tone, fontWeight: 600 }}>{item.summary}</span>
                  <span style={{ color: "rgba(255,255,255,0.5)" }}>{formatTimestamp(item.timestamp)}</span>
                </div>
                <div style={{ color: "rgba(255,255,255,0.65)", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <span>{item.rawType}</span>
                  {item.from && item.to && (
                    <span>
                      {`${item.from} -> ${item.to}`}
                    </span>
                  )}
                  <span>Sig: {shortAddress(item.signature)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}


