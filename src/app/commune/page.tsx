"use client";

import Sidebar from "@/components/Sidebar";
import { useSwarm } from "@/context/SwarmProvider";
import { useEffect, useMemo, useState } from "react";

function formatAgentLabel(id: string, isSelf: boolean) {
  const suffix = id.slice(-4);
  return isSelf ? `You (${suffix})` : `Agent ${suffix}`;
}

function rgbFromColor(color: [number, number, number] | undefined) {
  if (!color) return "rgba(255,255,255,0.65)";
  return `rgb(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(
    color[2] * 255
  )})`;
}

function ThreadModal({
  agentLabel,
  colorAccent,
  messages,
  draft,
  status,
  onDraftChange,
  onSend,
  onClose,
}: {
  agentLabel: string;
  colorAccent: string;
  messages: {
    senderId: string;
    targetId: string;
    timestamp: number;
    message: string;
    direction: "incoming" | "outgoing";
  }[];
  draft: string;
  status: "idle" | "sent" | "error";
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 2000,
        padding: "2rem",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(520px, 100%)",
          maxHeight: "90vh",
          background: "rgba(14,14,18,0.92)",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 28px 60px rgba(0,0,0,0.45)",
          display: "flex",
          flexDirection: "column",
          padding: "1.5rem",
          gap: "1.2rem",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "0.8rem",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 600 }}>{agentLabel}</h2>
            <p style={{ margin: "0.35rem 0 0", fontSize: "0.85rem", color: "rgba(255,255,255,0.65)" }}>
              Whisper channel. Only this agent receives your transmission.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(30,30,32,0.5)",
              color: "rgba(255,255,255,0.75)",
              borderRadius: "50%",
              width: 32,
              height: 32,
              cursor: "pointer",
            }}
            aria-label="Close thread"
          >
            ×
          </button>
        </header>

        <div
          style={{
            flex: 1,
            minHeight: 220,
            maxHeight: 360,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "0.6rem",
            paddingRight: "0.4rem",
          }}
        >
          {messages.length === 0 ? (
            <div style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.85rem" }}>
              No whispers exchanged yet. Start the thread below.
            </div>
          ) : (
            messages.map((entry) => (
              <div
                key={`${entry.timestamp}-${entry.senderId}`}
                style={{
                  alignSelf: entry.direction === "outgoing" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  background:
                    entry.direction === "outgoing"
                      ? "rgba(120,180,255,0.18)"
                      : "rgba(255,255,255,0.08)",
                  border: `1px solid ${
                    entry.direction === "outgoing" ? "rgba(120,180,255,0.35)" : "rgba(255,255,255,0.12)"
                  }`,
                  borderRadius: 12,
                  padding: "0.55rem 0.7rem",
                  fontSize: "0.82rem",
                  color: "rgba(255,255,255,0.9)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: 4,
                    fontSize: "0.7rem",
                    color: "rgba(255,255,255,0.6)",
                  }}
                >
                  <span>{entry.direction === "outgoing" ? "You" : agentLabel}</span>
                  <span>
                    {new Date(entry.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div>{entry.message}</div>
              </div>
            ))
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
          <textarea
            rows={3}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder={`Send a whisper to ${agentLabel}`}
            style={{
              resize: "none",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(18,18,24,0.95)",
              color: "#f5f5f5",
              padding: "0.65rem 0.75rem",
              fontSize: "0.85rem",
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span
              style={{
                fontSize: "0.75rem",
                color:
                  status === "error" ? "#ff9e9e" : status === "sent" ? colorAccent : "rgba(255,255,255,0.6)",
              }}
            >
              {status === "sent"
                ? "Whisper dispatched"
                : status === "error"
                ? "Compose a message first"
                : "Encrypted channel"}
            </span>
            <button
              type="button"
              onClick={onSend}
              style={{
                padding: "0.45rem 1.1rem",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(120,180,255,0.25)",
                color: "#d3e3ff",
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Send Whisper
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentGrid() {
  const {
    clients,
    myId,
    directMessages,
    sendDirectMessage,
    unreadDirectCounts,
    markDirectThreadRead,
  } = useSwarm();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, "idle" | "sent" | "error">>({});
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);

  const agentLookup = useMemo(() => {
    const map: Record<string, (typeof clients)[number]> = {};
    clients.forEach((client) => {
      map[client.id] = client;
    });
    return map;
  }, [clients]);

  const messagesByAgent = useMemo(() => {
    if (!myId) return {} as Record<string, typeof directMessages>;
    return directMessages.reduce<Record<string, typeof directMessages>>((acc, message) => {
      if (message.senderId !== myId && message.targetId !== myId) {
        return acc;
      }
      const otherId = message.senderId === myId ? message.targetId : message.senderId;
      acc[otherId] = [...(acc[otherId] ?? []), message];
      return acc;
    }, {});
  }, [directMessages, myId]);

  useEffect(() => {
    if (activeAgentId) {
      markDirectThreadRead(activeAgentId);
    }
  }, [directMessages, activeAgentId, markDirectThreadRead]);

  const handleOpenThread = (agentId: string) => {
    if (agentId === myId) return;
    setActiveAgentId(agentId);
    markDirectThreadRead(agentId);
  };

  const handleCloseThread = () => {
    setActiveAgentId(null);
  };

  const handleChange = (id: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [id]: value }));
    if (statuses[id] === "error") {
      setStatuses((prev) => ({ ...prev, [id]: "idle" }));
    }
  };

  const markStatus = (id: string, value: "idle" | "sent" | "error") => {
    setStatuses((prev) => ({ ...prev, [id]: value }));
    if (value === "sent") {
      setTimeout(() => {
        setStatuses((prev) => (prev[id] === "sent" ? { ...prev, [id]: "idle" } : prev));
      }, 2000);
    }
  };

  const handleSend = (id: string) => {
    const draft = drafts[id] ?? "";
    const trimmed = draft.trim();
    if (!trimmed) {
      markStatus(id, "error");
      return;
    }
    sendDirectMessage(id, trimmed);
    setDrafts((prev) => ({ ...prev, [id]: "" }));
    markStatus(id, "sent");
  };

  if (!myId) {
    return (
      <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem" }}>
        Establishing secure channel…
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem" }}>
        No active agents appear in the lattice yet.
      </div>
    );
  }

  const activeMessages = activeAgentId
    ? (messagesByAgent[activeAgentId] ?? []).sort((a, b) => a.timestamp - b.timestamp)
    : [];
  const activeDraft = activeAgentId ? drafts[activeAgentId] ?? "" : "";
  const activeStatus = activeAgentId ? statuses[activeAgentId] ?? "idle" : "idle";
  const activeAccent = rgbFromColor(agentLookup[activeAgentId ?? ""]?.color);
  const activeLabel = activeAgentId
    ? formatAgentLabel(activeAgentId, activeAgentId === myId)
    : "";

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", width: "100%" }}>
        <header style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 600 }}>Legion Relay</h1>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "rgba(255,255,255,0.6)" }}>
            Whisper to individual operatives. Double-check identifiers before transmitting.
          </p>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: "1.1rem",
            width: "100%",
          }}
        >
          {clients.map((client) => {
            const isSelf = client.id === myId;
            const accent = rgbFromColor(client.color);
            const unread = unreadDirectCounts[client.id] ?? 0;
            const cardMessages = messagesByAgent[client.id] ?? [];

            return (
              <div
                key={client.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 16,
                  padding: "1.1rem",
                  background: "rgba(12,12,18,0.72)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.9rem",
                  boxShadow: "0 18px 30px rgba(0,0,0,0.35)",
                  position: "relative",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                      {formatAgentLabel(client.id, isSelf)}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.55)" }}>
                      Status: {client.status ?? "idle"}
                    </div>
                  </div>
                  <span
                    style={{
                      display: "inline-block",
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      background: accent,
                    }}
                  />
                </div>

                <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.55)" }}>
                  {cardMessages.length === 0
                    ? "No private whispers yet."
                    : `${cardMessages.length} whisper${cardMessages.length === 1 ? "" : "s"} exchanged.`}
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenThread(client.id)}
                  disabled={isSelf}
                  style={{
                    padding: "0.45rem 0.8rem",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: isSelf ? "rgba(255,255,255,0.06)" : "rgba(120,180,255,0.18)",
                    color: isSelf ? "rgba(255,255,255,0.45)" : "#cfe1ff",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: isSelf ? "default" : "pointer",
                  }}
                >
                  {isSelf ? "Your station" : "View thread"}
                </button>

                {unread > 0 && !isSelf && (
                  <span
                    style={{
                      position: "absolute",
                      top: 12,
                      right: 12,
                      background: accent,
                      color: "#0c0c11",
                      borderRadius: 999,
                      padding: "0.1rem 0.5rem",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                    }}
                  >
                    {unread}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {activeAgentId && activeAgentId !== myId && (
        <ThreadModal
          agentLabel={activeLabel}
          colorAccent={activeAccent}
          messages={activeMessages}
          draft={activeDraft}
          status={activeStatus}
          onDraftChange={(value) => handleChange(activeAgentId, value)}
          onSend={() => handleSend(activeAgentId)}
          onClose={handleCloseThread}
        />
      )}
    </>
  );
}

export default function CommunePage() {
  return (
    <main style={{ display: "flex", height: "100vh", width: "100vw", background: "black" }}>
      <Sidebar />
      <section
        style={{
          flex: 1,
          marginLeft: "72px",
          padding: "2rem 3rem",
          color: "white",
          overflowY: "auto",
        }}
      >
        <AgentGrid />
      </section>
    </main>
  );
}
