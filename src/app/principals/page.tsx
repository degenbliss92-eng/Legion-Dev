"use client";

import Sidebar from "@/components/Sidebar";
import { useCallback, useEffect, useRef, useState } from "react";
import LiveActivityPanel from "@/components/LiveActivityPanel";
import TopSpawns from "@/components/TopSpawns";
import AdminPingBanner from "@/components/AdminPingBanner";

export default function PrincipalsPage() {
  const [messages, setMessages] = useState<{ agent: string; text: string; uid: string }[]>([]);

  // ref to the scrollable messages container for auto-scrolling
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMessagesCount, setNewMessagesCount] = useState(0);

  // Map each principal to a distinct color for name rendering
  const AGENT_COLORS: Record<string, string> = {
    Orion: "#4DD0E1", // cyan
    Sirius: "#FFD54F", // amber
    Bellatrix: "#FF69B4", // pink
    Saiph: "#7CFC00", // bright green
    Artemis: "#B39DDB", // light purple
  };

  // Principals metadata used for the intro cards (short one-line descriptors)
  const PRINCIPALS_INFO: { name: string; desc: string }[] = [
    { name: "Orion", desc: "analytical navigator" },
    { name: "Sirius", desc: "trend-focused beacon" },
    { name: "Bellatrix", desc: "tactical executor" },
    { name: "Saiph", desc: "methodical anchor" },
    { name: "Artemis", desc: "adaptive observer" },
  ];

  const PRINCIPAL_SERVICE_URL =
    process.env.NEXT_PUBLIC_PRINCIPAL_SERVICE_URL ?? "http://localhost:4000";

  useEffect(() => {
    // WebSocket URL: switch http(s) -> ws(s)
    const wsBase = PRINCIPAL_SERVICE_URL.replace(/^http/, "ws");
    const wsUrl = new URL("/conversation", wsBase).toString();
    let ws: WebSocket | null = null;

    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      console.warn("Failed to create WebSocket:", err);
      return;
    }

    ws.addEventListener("open", () => {
      console.log("Principals WS connected", wsUrl);
    });

    ws.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "conversation:init" && Array.isArray(data.messages)) {
          const normalized = (data.messages as any[]).map((entry: any, idx: number) => {
            let agent = "Assistant";
            let text = String(entry ?? "");
            if (entry && typeof entry === "object" && "agent" in entry && "text" in entry) {
              agent = String(entry.agent);
              text = String(entry.text);
            } else if (entry && typeof entry === "object" && "content" in entry) {
              const content = String(entry.content ?? "");
              const match = content.match(/^\s*([A-Za-z0-9_\- ]+):\s*([\s\S]+)$/);
              if (match) {
                agent = match[1].trim();
                text = match[2].trim();
              } else {
                text = content;
              }
            }
            return { agent, text, uid: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${idx}` };
          });
          // server sends newest-first; show oldest->newest
          setMessages(normalized.slice().reverse());
        }

        if (data.type === "conversation:update" && data.message) {
          const entry = data.message;
          let agent = "Assistant";
          let text = String(entry ?? "");
          if (entry && typeof entry === "object" && "agent" in entry && "text" in entry) {
            agent = String(entry.agent);
            text = String(entry.text);
          } else if (entry && typeof entry === "object" && "content" in entry) {
            const content = String(entry.content ?? "");
            const match = content.match(/^\s*([A-Za-z0-9_\- ]+):\s*([\s\S]+)$/);
            if (match) {
              agent = match[1].trim();
              text = match[2].trim();
            } else {
              text = content;
            }
          }
          const normalized = { agent, text, uid: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}` };
          // append newest to bottom (oldest -> newest ordering)
          setMessages((prev) => {
            const next = [...prev, normalized].slice(-100);
            // if user is not at bottom, increment unseen counter
            if (!isAtBottom) {
              setNewMessagesCount((c) => c + 1);
            }
            return next;
          });
        }
      } catch (err) {
        console.warn("Error parsing WS message:", err);
      }
    });

    ws.addEventListener("close", () => {
      console.log("Principals WS disconnected");
    });

    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
      ws = null;
    };
  }, [PRINCIPAL_SERVICE_URL]);

  // Track scroll position to know if user is at the bottom
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;

    const onScroll = () => {
      // consider near-bottom within 24px as bottom
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 24;
      setIsAtBottom(atBottom);
      if (atBottom) {
        setNewMessagesCount(0);
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    // initial check
    onScroll();

    return () => {
      el.removeEventListener("scroll", onScroll as any);
    };
  }, []);

  // Auto-scroll: when messages change, scroll the container to the bottom only if the user is at (or near) the bottom
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    if (!isAtBottom) return; // don't interrupt if user is reading earlier messages
    try {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } catch (err) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isAtBottom]);

  return (
    <>
      <AdminPingBanner />
      <style jsx>{`
        .latest {
          animation: highlightPulse 3s ease forwards;
          border-radius: 6px;
        }

        @keyframes highlightPulse {
          0% {
            background-color: rgba(255, 255, 255, 0.14);
            transform: translateY(-4px);
            box-shadow: 0 6px 18px rgba(0,0,0,0.4);
          }
          10% {
            transform: translateY(0);
          }
          60% {
            background-color: rgba(255, 255, 255, 0.04);
          }
          100% {
            background-color: transparent;
            transform: none;
            box-shadow: none;
          }
        }
      `}</style>
      <main style={{ display: "flex", height: "100vh", width: "100vw", background: "black" }}>
        <Sidebar />

        <section
          style={{
            flex: 1,
            marginLeft: "72px",
            display: "flex",
            flexDirection: "row",
            padding: "1rem",
            color: "white",
            gap: "1rem",
          }}
        >
          <div
            style={{
              flex: 2,
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding: "1rem",
              background: "rgba(255,255,255,0.02)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>The Principals</h2>

            {/* Principals intro cards */}
            <div style={{ display: "flex", gap: "0.6rem", marginBottom: "0.8rem", flexWrap: "wrap", overflowX: "hidden" }}>
              {PRINCIPALS_INFO.map((p) => (
                <div
                  key={p.name}
                  style={{
                    padding: "0.6rem 0.8rem",
                    borderRadius: "10px",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.04)",
                    display: "flex",
                    gap: "0.6rem",
                    alignItems: "center",
                    minWidth: "200px",
                  }}
                >
                  <div style={{ width: 10, height: 10, borderRadius: 999, background: AGENT_COLORS[p.name] ?? "#9ee2ff" }} aria-hidden />
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{p.name}</div>
                    <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.7)" }}>{p.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div
              ref={messagesRef}
              style={{
                flex: 1,
                overflowY: "auto",
                fontSize: "0.85rem",
                lineHeight: 1.5,
              }}
            >
              {/* New messages indicator: shows when user has scrolled up and new messages arrive */}
              {newMessagesCount > 0 && !isAtBottom && (
                <div
                  onClick={() => {
                    const el = messagesRef.current;
                    if (!el) return;
                    try {
                      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
                    } catch (err) {
                      el.scrollTop = el.scrollHeight;
                    }
                    setNewMessagesCount(0);
                  }}
                  style={{
                    position: "sticky",
                    top: 8,
                    left: 0,
                    right: 0,
                    display: "flex",
                    justifyContent: "center",
                    pointerEvents: "auto",
                    zIndex: 20,
                    marginBottom: "0.5rem",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      color: "white",
                      padding: "6px 10px",
                      borderRadius: 999,
                      fontSize: "0.8rem",
                      boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
                    }}
                  >
                    {newMessagesCount} new message{newMessagesCount > 1 ? "s" : ""} — jump to latest
                  </div>
                </div>
              )}
              {messages.map((m, i) => {
                const key = m.uid ?? `${m.agent}::${String(m.text).slice(0, 60)}::${i}`;
                const isLatest = i === messages.length - 1;
                return (
                  <div key={key} className={isLatest ? "latest" : undefined} style={{ marginBottom: "0.6rem" }}>
                    <strong style={{ color: AGENT_COLORS[m.agent] ?? "#9ee2ff" }}>{m.agent}:</strong> {m.text}
                  </div>
                );
              })}
            </div>
          </div>

          <div
            style={{
              flex: 1,
              minWidth: "320px",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <LiveActivityPanel />
            <TopSpawns />
          </div>
        </section>
      </main>
    </>
  );
}

