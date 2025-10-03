"use client";

import { Fragment, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import {
  AtSign,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Pin,
  Reply,
  Send,
  SmilePlus,
} from "lucide-react";
import { useSwarm } from "@/context/SwarmProvider";

type CommuneMessage = ReturnType<typeof useSwarm>["communeMessages"][number];
type Client = ReturnType<typeof useSwarm>["clients"][number];

type GroupChatProps = {
  forceOpen?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
};

const MAX_ROOT_THREADS = 60;
const REACTION_OPTIONS = [
  { id: "thumbs-up", glyph: String.fromCodePoint(0x1f44d), label: "Thumbs up" },
  { id: "fire", glyph: String.fromCodePoint(0x1f525), label: "Fire" },
  { id: "robot", glyph: String.fromCodePoint(0x1f916), label: "Robot" },
  { id: "brain", glyph: String.fromCodePoint(0x1f9e0), label: "Brain" },
  { id: "rocket", glyph: String.fromCodePoint(0x1f680), label: "Rocket" },
  { id: "idea", glyph: String.fromCodePoint(0x1f4a1), label: "Light bulb" },
];

function formatTimestamp(timestamp: number) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatAgentLabel(clientId: string, myId: string | null) {
  if (clientId === myId) {
    return "You";
  }
  const suffix = clientId.slice(-4);
  return `Agent ${suffix}`;
}

function rgbFromColor(client: Client | undefined) {
  if (!client) {
    return "rgba(255,255,255,0.35)";
  }
  const [r, g, b] = client.color;
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}

function renderMessageText(text: string, mentionColor: string, emphasize: boolean) {
  const mentionRegex = /(@[A-Za-z0-9_-]+)/g;
  const parts = text.split(mentionRegex);
  return parts.map((part, index) => {
    if (mentionRegex.test(part)) {
      mentionRegex.lastIndex = 0;
      return (
        <span
          key={`mention-${index}`}
          style={{
            color: mentionColor,
            fontWeight: emphasize ? 600 : 500,
          }}
        >
          {part}
        </span>
      );
    }
    return <Fragment key={`text-${index}`}>{part}</Fragment>;
  });
}

export default function GroupChat({ forceOpen = false, onCollapsedChange }: GroupChatProps) {
  const {
    clients,
    myId,
    communeMessages,
    sendCommuneMessage,
    toggleCommuneReaction,
    toggleCommunePin,
    markCommuneRead,
    setCommunePanelOpen,
    unreadCommuneCount,
  } = useSwarm();

  const [draft, setDraft] = useState("");
  const [collapsed, setCollapsed] = useState(true);
  const [replyTo, setReplyTo] = useState<CommuneMessage | null>(null);
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false);
  const [activeReactionTarget, setActiveReactionTarget] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [mentionMap, setMentionMap] = useState<Record<string, string>>({});

  const listRef = useRef<HTMLDivElement | null>(null);
  const pendingFocusRef = useRef<string | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (forceOpen) {
      setCollapsed(false);
    }
  }, [forceOpen]);

  useEffect(() => {
    onCollapsedChange?.(collapsed);
    setCommunePanelOpen(!collapsed);
    if (!collapsed) {
      markCommuneRead();
    }
    if (collapsed) {
      setActiveReactionTarget(null);
      setMentionPickerOpen(false);
    }
  }, [collapsed, markCommuneRead, onCollapsedChange, setCommunePanelOpen]);

  useEffect(() => {
    if (!collapsed) {
      const container = listRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [collapsed, communeMessages]);

  useEffect(() => {
    if (!collapsed && pendingFocusRef.current) {
      const targetId = pendingFocusRef.current;
      pendingFocusRef.current = null;
      const timeout = window.setTimeout(() => {
        scrollMessageIntoView(targetId);
      }, 140);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [collapsed]);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  const clientMap = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);

  const messageMap = useMemo(() => {
    const map = new Map<string, CommuneMessage>();
    communeMessages.forEach((message) => {
      map.set(message.id, message);
    });
    return map;
  }, [communeMessages]);

  const messagesByParent = useMemo(() => {
    const map = new Map<string | null, CommuneMessage[]>();
    communeMessages.forEach((message) => {
      const key = message.parentId ?? null;
      const array = map.get(key);
      if (array) {
        array.push(message);
      } else {
        map.set(key, [message]);
      }
    });
    map.forEach((entries) => entries.sort((a, b) => a.timestamp - b.timestamp));
    return map;
  }, [communeMessages]);

  const rootMessages = useMemo(() => {
    const roots = messagesByParent.get(null) ?? [];
    if (roots.length <= MAX_ROOT_THREADS) {
      return roots;
    }
    return roots.slice(-MAX_ROOT_THREADS);
  }, [messagesByParent]);

  const pinnedMessages = useMemo(() => {
    return communeMessages
      .filter((message) => message.pinned)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [communeMessages]);

  const mentionableAgents = useMemo(
    () => clients.filter((client) => client.id !== myId),
    [clients, myId]
  );

  const handleDraftChange = (value: string) => {
    setDraft(value);
    setMentionMap((prev) => {
      const nextEntries = Object.entries(prev).filter(([label]) => value.includes(label));
      if (nextEntries.length === Object.keys(prev).length) {
        return prev;
      }
      return nextEntries.reduce<Record<string, string>>((acc, [label, id]) => {
        acc[label] = id;
        return acc;
      }, {});
    });
  };

  const handleInsertMention = (client: Client) => {
    const suffix = client.id.slice(-4);
    const label = `@Agent-${suffix}`;
    const needsSpace = draft && !/\s$/.test(draft);
    const nextDraft = needsSpace ? `${draft} ${label} ` : `${draft}${label} `;
    setDraft(nextDraft);
    setMentionMap((prev) => ({ ...prev, [label]: client.id }));
    setMentionPickerOpen(false);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) {
      return;
    }
    const explicitMentions = Array.from(new Set(Object.values(mentionMap)));
    sendCommuneMessage(trimmed, { parentId: replyTo?.id, mentions: explicitMentions });
    setDraft("");
    setReplyTo(null);
    setMentionMap({});
    setActiveReactionTarget(null);
    markCommuneRead();
  };

  const handleReply = (message: CommuneMessage) => {
    setReplyTo(message);
    if (collapsed) {
      setCollapsed(false);
    }
  };

  const handleToggleReactionMenu = (messageId: string) => {
    setActiveReactionTarget((current) => (current === messageId ? null : messageId));
  };

  const handleReactionSelect = (messageId: string, emoji: string) => {
    toggleCommuneReaction(messageId, emoji);
    setActiveReactionTarget(null);
  };

  const scrollMessageIntoView = (messageId: string) => {
    const container = listRef.current;
    const target = document.getElementById(`commune-msg-${messageId}`);
    if (!container || !target) {
      return;
    }
    container.scrollTo({ top: target.offsetTop - 20, behavior: "smooth" });
    setHighlightedMessageId(messageId);
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedMessageId((current) => (current === messageId ? null : current));
    }, 2200);
  };

  const requestFocusMessage = (messageId: string) => {
    if (collapsed) {
      pendingFocusRef.current = messageId;
      setCollapsed(false);
      return;
    }
    scrollMessageIntoView(messageId);
  };

  const renderMessage = (message: CommuneMessage, depth = 0): ReactElement => {
    const replies = messagesByParent.get(message.id) ?? [];
    const isSelf = message.clientId === myId;
    const agent = clientMap.get(message.clientId);
    const accent = rgbFromColor(agent);
    const label = formatAgentLabel(message.clientId, myId);
    const isMentioned = Boolean(myId && message.mentions.includes(myId));
    const reactions = message.reactions ?? [];
    const repliesCount = replies.length;
    const isHighlighted = highlightedMessageId === message.id;
    const parentMessage = message.parentId ? messageMap.get(message.parentId) ?? null : null;
    const parentPreview = parentMessage?.message
      ? parentMessage.message.length > 80
        ? `${parentMessage.message.slice(0, 77)}...`
        : parentMessage.message
      : null;
    const parentLabel = parentMessage ? formatAgentLabel(parentMessage.clientId, myId) : null;

    return (
      <div key={message.id} style={{ marginBottom: repliesCount > 0 ? 14 : 10 }}>
        <div
          id={`commune-msg-${message.id}`}
          style={{
            position: "relative",
            marginLeft: depth > 0 ? depth * 16 : 0,
          }}
        >
          {depth > 0 && (
            <span
              style={{
                position: "absolute",
                left: -10,
                top: 22,
                width: 2,
                bottom: -8,
                background: "rgba(255,255,255,0.08)",
              }}
            />
          )}
          <article
            style={{
              position: "relative",
              padding: "10px 12px",
              borderRadius: 10,
              background: isSelf ? "rgba(255,255,255,0.08)" : "rgba(32,32,38,0.72)",
              border: isHighlighted
                ? "1px solid rgba(118, 195, 255, 0.8)"
                : "1px solid rgba(255,255,255,0.07)",
              boxShadow: isMentioned
                ? "0 0 0 1px rgba(118,195,255,0.18), 0 10px 20px rgba(0,0,0,0.32)"
                : "0 8px 18px rgba(0,0,0,0.28)",
              transition: "box-shadow 160ms ease",
            }}
          >
            {activeReactionTarget === message.id && (
              <div
                style={{
                  position: "absolute",
                  top: -32,
                  right: 10,
                  display: "flex",
                  gap: 4,
                  padding: "4px 6px",
                  borderRadius: 999,
                  background: "rgba(15,15,22,0.94)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  boxShadow: "0 12px 22px rgba(0,0,0,0.38)",
                  zIndex: 12,
                }}
              >
                {REACTION_OPTIONS.map((option) => {
                  const glyph = option.glyph;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleReactionSelect(message.id, glyph)}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        fontSize: "1rem",
                      }}
                      aria-label={`React with ${option.label}`}
                    >
                      {glyph}
                    </button>
                  );
                })}
              </div>
            )}

            <header
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                marginBottom: 4,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    display: "inline-flex",
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: accent,
                    boxShadow: `0 0 8px ${accent}`,
                  }}
                />
                <span
                  style={{
                    fontSize: "0.74rem",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "rgba(230,230,235,0.82)",
                    fontWeight: 600,
                  }}
                >
                  {label}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {message.pinned && (
                  <Pin size={14} style={{ color: "#fdd66c" }} aria-label="Pinned message" />
                )}
                <time
                  dateTime={new Date(message.timestamp).toISOString()}
                  style={{ fontSize: "0.7rem", color: "rgba(200,200,210,0.68)" }}
                >
                  {formatTimestamp(message.timestamp)}
                </time>
              </div>
            </header>

            {parentMessage && (
              <button
                type="button"
                onClick={() => requestFocusMessage(parentMessage.id)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 6,
                  width: "100%",
                  marginBottom: 10,
                  padding: "10px 14px 10px 16px",
                  borderRadius: 10,
                  border: "1px solid rgba(120,180,255,0.22)",
                  background: "rgba(32,36,48,0.9)",
                  color: "rgba(220,230,255,0.9)",
                  cursor: "pointer",
                  textAlign: "left",
                  borderLeft: "3px solid rgba(120,180,255,0.55)",
                }}
              >
                <span
                  style={{
                    fontSize: "0.66rem",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "rgba(210,230,255,0.82)",
                    fontWeight: 600,
                  }}
                >
                  Replying to {parentLabel ?? "prior transmission"}
                </span>
                {parentPreview && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      width: "100%",
                      marginTop: 4,
                      padding: "8px 12px",
                      borderRadius: 8,
                      background: "rgba(22,26,36,0.92)",
                      borderLeft: "3px solid rgba(120,180,255,0.55)",
                      color: "rgba(225,235,255,0.9)",
                      fontSize: "0.75rem",
                      lineHeight: 1.4,
                      fontStyle: "italic",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    <span style={{ color: "rgba(140,190,255,0.95)", fontSize: "0.85rem", lineHeight: 1 }}>&ldquo;</span>
                    <span style={{ flex: 1 }}>{parentPreview}</span>
                    <span style={{ color: "rgba(140,190,255,0.95)", fontSize: "0.85rem", lineHeight: 1 }}>&rdquo;</span>
                  </div>
                )}
              </button>
            )}

            <div
              style={{
                fontSize: "0.82rem",
                lineHeight: 1.35,
                color: "rgba(242,242,248,0.92)",
                wordBreak: "break-word",
                whiteSpace: "pre-wrap",
              }}
            >
              {renderMessageText(message.message, "#9ecbff", isMentioned)}
            </div>

            <footer
              style={{
                marginTop: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {reactions.map((reaction) => {
                  const actors = reaction.actors ?? [];
                  const hasReacted = myId ? actors.includes(myId) : false;
                  return (
                    <button
                      key={`${message.id}-${reaction.emoji}`}
                      type="button"
                      onClick={() => toggleCommuneReaction(message.id, reaction.emoji)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "2px 6px",
                        borderRadius: 999,
                        border: hasReacted
                          ? "1px solid rgba(158,203,255,0.7)"
                          : "1px solid rgba(255,255,255,0.12)",
                        background: hasReacted ? "rgba(158,203,255,0.12)" : "rgba(28,28,34,0.7)",
                        color: "rgba(240,240,245,0.82)",
                        cursor: "pointer",
                        fontSize: "0.74rem",
                      }}
                      aria-label={`Toggle ${reaction.emoji} reaction`}
                    >
                      <span style={{ fontSize: "1rem" }}>{reaction.emoji}</span>
                      <span>{actors.length}</span>
                    </button>
                  );
                })}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => handleReply(message)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "3px 7px",
                    fontSize: "0.68rem",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(24,24,30,0.65)",
                    color: "rgba(235,235,240,0.82)",
                    cursor: "pointer",
                  }}
                >
                  <Reply size={14} /> Reply
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleReactionMenu(message.id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "3px 7px",
                    fontSize: "0.68rem",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(24,24,30,0.65)",
                    color: "rgba(235,235,240,0.82)",
                    cursor: "pointer",
                  }}
                >
                  <SmilePlus size={14} /> React
                </button>
                <button
                  type="button"
                  onClick={() => toggleCommunePin(message.id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: 5,
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: message.pinned ? "rgba(253,214,108,0.18)" : "rgba(24,24,30,0.65)",
                    color: message.pinned ? "#fdd66c" : "rgba(235,235,240,0.82)",
                    cursor: "pointer",
                  }}
                  aria-label={message.pinned ? "Unpin message" : "Pin message"}
                >
                  <Pin size={14} />
                </button>
              </div>
            </footer>
          </article>
        </div>

        {repliesCount > 0 && (
          <div style={{ marginTop: 8, marginLeft: depth === 0 ? 10 : 0 }}>
            {replies.map((reply) => renderMessage(reply, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderPinnedMessages = (): ReactElement | null => {
    if (pinnedMessages.length === 0) {
      return null;
    }
    return (
      <section
        style={{
          marginBottom: 16,
          padding: "10px 12px",
          borderRadius: 10,
          background: "rgba(18,18,26,0.82)",
          border: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 10,
            color: "rgba(235,235,240,0.82)",
            fontSize: "0.74rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          <Pin size={14} /> Anchored transmissions
        </header>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 180, overflowY: "auto" }}>
          {pinnedMessages.map((message) => {
            const label = formatAgentLabel(message.clientId, myId);
            return (
              <button
                key={`pinned-${message.id}`}
                type="button"
                onClick={() => requestFocusMessage(message.id)}
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.07)",
                  background: "rgba(26,26,32,0.72)",
                  color: "rgba(235,235,240,0.88)",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  lineHeight: 1.35,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 600 }}>{label}</span>
                  <time
                    dateTime={new Date(message.timestamp).toISOString()}
                    style={{ fontSize: "0.7rem", color: "rgba(200,200,210,0.65)" }}
                  >
                    {formatTimestamp(message.timestamp)}
                  </time>
                </div>
                <div style={{ color: "rgba(235,235,240,0.78)", wordBreak: "break-word" }}>
                  {message.message.length > 120
                    ? `${message.message.slice(0, 117)}...`
                    : message.message}
                </div>
              </button>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <aside
      aria-label="Commune collaboration hub"
      style={{
        position: "absolute",
        left: 112,
        bottom: 24,
        zIndex: 22,
        width: 340,
        height: collapsed ? 64 : 380,
        display: "flex",
        flexDirection: "column",
        background: "#1f1f1f",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 14,
        boxShadow: "0 16px 38px rgba(0,0,0,0.5)",
        overflow: "hidden",
        backdropFilter: "blur(20px)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderBottom: collapsed ? "none" : "1px solid rgba(255,255,255,0.06)",
          color: "rgba(235,235,240,0.84)",
          fontSize: "0.8rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <MessageCircle size={16} /> Commune
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {collapsed && unreadCommuneCount > 0 && (
            <span
              style={{
                minWidth: 22,
                padding: "2px 8px",
                borderRadius: 999,
                background: "#ff7a7a",
                color: "#0e0e12",
                fontSize: "0.7rem",
                fontWeight: 700,
                textAlign: "center",
              }}
            >
              {unreadCommuneCount > 99 ? "99+" : unreadCommuneCount}
            </span>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 9px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(32,32,40,0.68)",
              color: "rgba(235,235,240,0.92)",
              cursor: "pointer",
              fontSize: "0.7rem",
            }}
            aria-label={collapsed ? "Expand commune panel" : "Collapse commune panel"}
          >
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            {collapsed ? "Open" : "Hide"}
          </button>
        </div>
      </header>

      <div
        ref={listRef}
        style={{
          flex: collapsed ? 0 : 1,
          overflowY: collapsed ? "hidden" : "auto",
          padding: collapsed ? 0 : "16px 18px",
          display: collapsed ? "none" : "flex",
          flexDirection: "column",
          gap: 12,
          minHeight: 0,
        }}
      >
        {renderPinnedMessages()}

        {rootMessages.length === 0 ? (
          <div style={{ color: "rgba(210,210,220,0.6)", fontSize: "0.84rem" }}>
            The channel is quiet. Start a new transmission below.
          </div>
        ) : (
          rootMessages.map((message) => renderMessage(message))
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          display: collapsed ? "none" : "flex",
          flexDirection: "column",
          gap: 10,
          padding: "12px 16px 16px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "#1f1f1f",
          position: "relative",
        }}
      >
        {replyTo && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 10px",
              borderRadius: 10,
              background: "rgba(120,180,255,0.12)",
              border: "1px solid rgba(120,180,255,0.28)",
              fontSize: "0.76rem",
              color: "rgba(210,230,255,0.9)",
            }}
          >
            <span>
              Replying to <strong>{formatAgentLabel(replyTo.clientId, myId)}</strong>
            </span>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              style={{
                border: "none",
                background: "transparent",
                color: "rgba(210,230,255,0.8)",
                cursor: "pointer",
                fontSize: "0.7rem",
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {mentionPickerOpen && (
          <div
            style={{
              position: "absolute",
              bottom: 72,
              right: 68,
              width: 220,
              maxHeight: 220,
              overflowY: "auto",
              background: "rgba(12,12,18,0.96)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 10,
              boxShadow: "0 18px 36px rgba(0,0,0,0.45)",
              padding: 8,
              zIndex: 15,
            }}
          >
            {mentionableAgents.length === 0 ? (
              <div style={{ color: "rgba(210,210,220,0.6)", fontSize: "0.8rem" }}>
                No other agents connected.
              </div>
            ) : (
              mentionableAgents.map((client) => {
                const accent = rgbFromColor(client);
                return (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => handleInsertMention(client)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 8px",
                      borderRadius: 8,
                      border: "none",
                      background: "transparent",
                      color: "rgba(235,235,240,0.88)",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                    }}
                  >
                    <span>{formatAgentLabel(client.id, myId)}</span>
                    <span
                      style={{
                        display: "inline-flex",
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: accent,
                      }}
                    />
                  </button>
                );
              })
            )}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="text"
            placeholder="Broadcast to the commune"
            value={draft}
            onChange={(event) => handleDraftChange(event.target.value)}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "#2a2a2a",
              color: "rgba(235,235,240,0.95)",
              fontSize: "0.86rem",
            }}
          />
          <button
            type="button"
            onClick={() => setMentionPickerOpen((prev) => !prev)}
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.14)",
              background: mentionPickerOpen ? "rgba(120,180,255,0.2)" : "rgba(32,32,40,0.72)",
              color: "rgba(235,235,240,0.88)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
            aria-label="Mention an agent"
          >
            <AtSign size={18} />
          </button>
          <button
            type="submit"
            disabled={!draft.trim()}
            style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.18)",
              background: draft.trim() ? "rgba(118,195,255,0.25)" : "rgba(60,60,70,0.25)",
              color: draft.trim() ? "#e8f4ff" : "rgba(200,200,210,0.5)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: draft.trim() ? "pointer" : "default",
              transition: "background 120ms ease",
            }}
            aria-label="Send message"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </aside>
  );
}

