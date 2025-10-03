"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from "react";

type IncomingClient = [
  string,
  [number, number, number],
  [number, number, number]
];

type Client = {
  id: string;
  position: [number, number, number];
  color: [number, number, number];
  status?: "idle" | "processing" | "voted";
  connectedAt: number;
};

type Query = {
  question: string;
  options: string[];
  timeToDecide: number;
};

type Vote = {
  question: string;
  vote: string;
  clientId: string;
};
type DirectMessage = {
  senderId: string;
  targetId: string;
  message: string;
  timestamp: number;
  direction: "incoming" | "outgoing";
};

type CommuneReaction = {
  emoji: string;
  actors: string[];
};

type CommuneMessage = {
  id: string;
  clientId: string;
  message: string;
  timestamp: number;
  direction: "incoming" | "outgoing";
  parentId: string | null;
  reactions: CommuneReaction[];
  pinned: boolean;
  mentions: string[];
};

type AdminPing = {
  id: string;
  message: string;
  createdAt: number;
};

const STORAGE_KEY = "swarmInbox";

const normalizeReactions = (reactions?: CommuneReaction[]): CommuneReaction[] => {
  if (!Array.isArray(reactions)) {
    return [];
  }
  const map = new Map<string, Set<string>>();
  reactions.forEach((reaction) => {
    if (!reaction || typeof reaction.emoji !== "string") {
      return;
    }
    const emoji = reaction.emoji;
    const actors = Array.isArray(reaction.actors) ? reaction.actors : [];
    if (!map.has(emoji)) {
      map.set(emoji, new Set<string>());
    }
    const bucket = map.get(emoji)!;
    actors.forEach((actor) => {
      if (typeof actor === "string" && actor.trim().length > 0) {
        bucket.add(actor);
      }
    });
  });
  return Array.from(map.entries())
    .map(([emoji, actors]) => ({ emoji, actors: Array.from(actors).sort() }))
    .filter((reaction) => reaction.actors.length > 0);
};

const mergeReactions = (existing: CommuneReaction[], incoming: CommuneReaction[]): CommuneReaction[] => {
  const merged = new Map<string, Set<string>>();
  const ingest = (list: CommuneReaction[]) => {
    list.forEach((reaction) => {
      if (!reaction || typeof reaction.emoji !== "string") {
        return;
      }
      const emoji = reaction.emoji;
      const set = merged.get(emoji) ?? new Set<string>();
      reaction.actors.forEach((actor) => {
        if (typeof actor === "string" && actor.trim().length > 0) {
          set.add(actor);
        }
      });
      if (set.size > 0) {
        merged.set(emoji, set);
      }
    });
  };
  ingest(existing);
  ingest(incoming);
  return Array.from(merged.entries()).map(([emoji, actors]) => ({
    emoji,
    actors: Array.from(actors).sort(),
  }));
};

const sanitizeMentions = (mentions?: string[]): string[] => {
  if (!Array.isArray(mentions)) {
    return [];
  }
  const set = new Set<string>();
  mentions.forEach((mention) => {
    if (typeof mention !== "string") {
      return;
    }
    const trimmed = mention.trim();
    if (trimmed) {
      set.add(trimmed);
    }
  });
  return Array.from(set);
};


type SwarmContextType = {
  clients: Client[];
  myId: string | null;
  query: Query | null;
  votes: Vote[];
  adminPing: AdminPing | null;
  hasRespondedToActivePing: boolean;
  isPingOverlayOpen: boolean;
  sendVote: (vote: string) => void;
  submitPingResponse: (message: string) => void;
  sendCommuneMessage: (message: string, options?: { parentId?: string; mentions?: string[] }) => void;
  toggleCommuneReaction: (messageId: string, emoji: string) => void;
  toggleCommunePin: (messageId: string) => void;
  markCommuneRead: () => void;
  setCommunePanelOpen: (open: boolean) => void;
  communeMessages: CommuneMessage[];
  sendDirectMessage: (targetId: string, message: string) => void;
  directMessages: DirectMessage[];
  unreadDirectCounts: Record<string, number>;
  unreadCommuneCount: number;
  markDirectThreadRead: (agentId: string) => void;
  notificationCount: number;
  openPingOverlay: () => void;
  closePingOverlay: () => void;
};

const SwarmContext = createContext<SwarmContextType>({
  clients: [],
  myId: null,
  query: null,
  votes: [],
  adminPing: null,
  hasRespondedToActivePing: false,
  isPingOverlayOpen: false,
  sendVote: () => {},
  submitPingResponse: () => {},
  sendCommuneMessage: (_message: string, _options?: { parentId?: string; mentions?: string[] }) => {},
  toggleCommuneReaction: () => {},
  toggleCommunePin: () => {},
  markCommuneRead: () => {},
  setCommunePanelOpen: () => {},
  communeMessages: [],
  sendDirectMessage: () => {},
  directMessages: [],
  unreadDirectCounts: {},
  unreadCommuneCount: 0,
  markDirectThreadRead: () => {},
  notificationCount: 0,
  openPingOverlay: () => {},
  closePingOverlay: () => {},
});

export function SwarmProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [query, setQuery] = useState<Query | null>(null);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [adminPing, setAdminPing] = useState<AdminPing | null>(null);
  const [respondedPingIds, setRespondedPingIds] = useState<string[]>([]);
  const [isPingOverlayOpen, setPingOverlayOpen] = useState(false);
  const [communeMessages, setCommuneMessages] = useState<CommuneMessage[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [unreadDirectCounts, setUnreadDirectCounts] = useState<Record<string, number>>({});
  const [unreadAdminPings, setUnreadAdminPings] = useState(0);
  const [unreadCommuneCount, setUnreadCommuneCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const myIdRef = useRef<string | null>(null);
  const voteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionsRef = useRef<Record<string, number>>({});
  const communeMessageKeysRef = useRef<Set<string>>(new Set());
  const communePanelOpenRef = useRef(false);
  const clientsRef = useRef<Client[]>([]);
  const communeMessagesRef = useRef<CommuneMessage[]>([]);

  const pushCommuneMessage = useCallback(
    (entry: CommuneMessage) => {
      const rawId = typeof entry.id === "string" ? entry.id.trim() : "";
      const normalizedId =
        rawId.length > 0
          ? rawId
          : `${entry.clientId}-${typeof entry.timestamp === "number" ? entry.timestamp : Date.now()}`;
      const normalizedReactions = normalizeReactions(entry.reactions);
      const normalizedMentions = sanitizeMentions(entry.mentions);
      const parentId = entry.parentId && entry.parentId.trim().length > 0 ? entry.parentId : null;
      const normalizedMessage: CommuneMessage = {
        ...entry,
        id: normalizedId,
        parentId,
        reactions: normalizedReactions,
        pinned: Boolean(entry.pinned),
        mentions: normalizedMentions,
        message: entry.message.trim(),
      };

      const existingMatch =
        communeMessagesRef.current.find((msg) => msg.id === normalizedMessage.id) ??
        communeMessagesRef.current.find(
          (msg) =>
            msg.id !== normalizedMessage.id &&
            msg.clientId === normalizedMessage.clientId &&
            msg.timestamp === normalizedMessage.timestamp &&
            msg.message === normalizedMessage.message
        );

      const haveSeen =
        communeMessageKeysRef.current.has(normalizedMessage.id) || Boolean(existingMatch);

      communeMessageKeysRef.current.add(normalizedMessage.id);

      setCommuneMessages((prev) => {
        const indexById = prev.findIndex((msg) => msg.id === normalizedMessage.id);
        if (indexById >= 0) {
          const current = prev[indexById];
          const mergedReactions = mergeReactions(normalizeReactions(current.reactions), normalizedReactions);
          const mergedMentions = normalizedMentions.length > 0 ? normalizedMentions : current.mentions;
          const next = [...prev];
          next[indexById] = {
            ...current,
            ...normalizedMessage,
            reactions: mergedReactions,
            mentions: mergedMentions,
          };
          return next;
        }

        const indexBySignature = prev.findIndex(
          (msg) =>
            msg.clientId === normalizedMessage.clientId &&
            msg.timestamp === normalizedMessage.timestamp &&
            msg.message === normalizedMessage.message
        );

        if (indexBySignature >= 0) {
          const current = prev[indexBySignature];
          const mergedReactions = mergeReactions(normalizeReactions(current.reactions), normalizedReactions);
          const mergedMentions = normalizedMentions.length > 0 ? normalizedMentions : current.mentions;
          const next = [...prev];
          next[indexBySignature] = {
            ...current,
            ...normalizedMessage,
            id: normalizedMessage.id,
            reactions: mergedReactions,
            mentions: mergedMentions,
          };
          return next;
        }

        const next = [...prev, normalizedMessage];
        next.sort((a, b) => a.timestamp - b.timestamp);
        return next;
      });

      if (
        !haveSeen &&
        normalizedMessage.direction === "incoming" &&
        !communePanelOpenRef.current
      ) {
        setUnreadCommuneCount((count) => count + 1);
      }
    },
    []
  );

  useEffect(() => {
    clientsRef.current = clients;
  }, [clients]);

  useEffect(() => {
    communeMessagesRef.current = communeMessages;
  }, [communeMessages]);

  useEffect(() => {
    if (!myId || typeof window === "undefined") {
      return;
    }

    const snapshot = {
      selfId: myId,
      messages: directMessages,
      unreadDirect: unreadDirectCounts,
      unreadAdmin: unreadAdminPings,
    };

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (error) {
      console.warn("Failed to persist inbox state:", error);
    }
  }, [directMessages, unreadDirectCounts, unreadAdminPings, myId]);

  useEffect(() => {
    myIdRef.current = myId;
  }, [myId]);

  const mapIncomingClients = (
    rawClients: IncomingClient[],
    timestamp: number
  ): Client[] => {
    const mapped = rawClients.map(([id, pos, color]) => {
      if (!connectionsRef.current[id]) {
        connectionsRef.current[id] = timestamp;
      }

      return {
        id,
        position: pos,
        color,
        status: "idle" as const,
        connectedAt: connectionsRef.current[id],
      };
    });

    const activeIds = new Set(mapped.map((client) => client.id));
    Object.keys(connectionsRef.current).forEach((id) => {
      if (!activeIds.has(id)) {
        delete connectionsRef.current[id];
      }
    });

    return mapped;
  };

  const applyReactionUpdate = useCallback(
    (messageId: string, emoji: string, actorId: string, active: boolean) => {
      setCommuneMessages((prev) => {
        const index = prev.findIndex((msg) => msg.id === messageId);
        if (index === -1) {
          return prev;
        }
        const target = prev[index];
        const currentReactions = target.reactions ?? [];
        const reactionIndex = currentReactions.findIndex((reaction) => reaction.emoji === emoji);
        const working = currentReactions.map((reaction) => ({
          emoji: reaction.emoji,
          actors: [...reaction.actors],
        }));
        if (active) {
          if (reactionIndex === -1) {
            working.push({ emoji, actors: [actorId] });
          } else {
            const reaction = working[reactionIndex];
            if (reaction.actors.includes(actorId)) {
              return prev;
            }
            reaction.actors.push(actorId);
          }
        } else {
          if (reactionIndex === -1) {
            return prev;
          }
          const reaction = working[reactionIndex];
          if (!reaction.actors.includes(actorId)) {
            return prev;
          }
          reaction.actors = reaction.actors.filter((actor) => actor !== actorId);
          if (reaction.actors.length === 0) {
            working.splice(reactionIndex, 1);
          }
        }
        const normalized = normalizeReactions(working);
        const next = [...prev];
        next[index] = { ...target, reactions: normalized };
        return next;
      });
    },
    []
  );

  const applyPinUpdate = useCallback(
    (messageId: string, pinned: boolean) => {
      setCommuneMessages((prev) => {
        const index = prev.findIndex((msg) => msg.id === messageId);
        if (index === -1) {
          return prev;
        }
        const target = prev[index];
        if (target.pinned === pinned) {
          return prev;
        }
        const next = [...prev];
        next[index] = { ...target, pinned };
        return next;
      });
    },
    []
  );

  const markCommuneRead = useCallback(() => {
    setUnreadCommuneCount(0);
  }, []);

  const setCommunePanelOpen = useCallback(
    (open: boolean) => {
      communePanelOpenRef.current = open;
      if (open) {
        markCommuneRead();
      }
    },
    [markCommuneRead]
  );

  const toggleCommuneReaction = useCallback(
    (messageId: string, emoji: string) => {
      const actorId = myIdRef.current;
      if (!actorId) {
        return;
      }
      const trimmedEmoji = emoji.trim();
      if (!trimmedEmoji) {
        return;
      }
      const target = communeMessagesRef.current.find((message) => message.id === messageId);
      if (!target) {
        return;
      }
      const reaction = target.reactions.find((entry) => entry.emoji === trimmedEmoji);
      const hasReacted = reaction ? reaction.actors.includes(actorId) : false;
      const activate = !hasReacted;

      applyReactionUpdate(messageId, trimmedEmoji, actorId, activate);

      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        return;
      }

      try {
        wsRef.current.send(
          JSON.stringify({
            type: "commune-reaction",
            messageId,
            emoji: trimmedEmoji,
            active: activate,
          })
        );
      } catch (error) {
        console.warn("Failed to send commune reaction:", error);
      }
    },
    [applyReactionUpdate]
  );

  const toggleCommunePin = useCallback(
    (messageId: string) => {
      const target = communeMessagesRef.current.find((message) => message.id === messageId);
      if (!target) {
        return;
      }
      const nextPinned = !target.pinned;

      applyPinUpdate(messageId, nextPinned);

      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        return;
      }

      try {
        wsRef.current.send(
          JSON.stringify({
            type: "commune-pin",
            messageId,
            pinned: nextPinned,
          })
        );
      } catch (error) {
        console.warn("Failed to send commune pin toggle:", error);
      }
    },
    [applyPinUpdate]
  );

  const resolveMentionCandidate = useCallback((token: string) => {
    const normalized = token.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    const stripped = normalized.replace(/[^a-z0-9]/g, "");
    for (const client of clientsRef.current) {
      const clientId = client.id;
      const lower = clientId.toLowerCase();
      if (lower === normalized || lower === stripped) {
        return clientId;
      }
      const suffix = lower.slice(-4);
      if (
        suffix &&
        (normalized === suffix ||
          stripped === suffix ||
          normalized === `agent-${suffix}` ||
          normalized === `agent${suffix}` ||
          stripped === `agent${suffix}`)
      ) {
        return clientId;
      }
      const prefix = lower.slice(0, 6);
      if (prefix && (normalized === prefix || stripped === prefix)) {
        return clientId;
      }
    }
    return null;
  }, []);

  useEffect(() => {
    const resolveWsUrl = () => {
      if (process.env.NEXT_PUBLIC_SWARM_WS) {
        return process.env.NEXT_PUBLIC_SWARM_WS;
      }
      if (typeof window !== "undefined") {
        const protocol = window.location.protocol === "https:" ? "wss" : "ws";
        const { hostname, port } = window.location;
        if (hostname === "localhost") {
          const targetPort = !port || port === "8080" ? "8080" : "8080";
          return `${protocol}://${hostname}:${targetPort}`;
        }
        return `${protocol}://${hostname}${port ? `:${port}` : ""}`;
      }
      return "ws://localhost:8080";
    };

    const ws = new WebSocket(resolveWsUrl());
    wsRef.current = ws;

    ws.onmessage = (msg) => {
      let data: any;
      try {
        data = JSON.parse(msg.data);
      } catch {
        return;
      }

      if (data.type === "init") {
        setMyId(data.id);
        const now = Date.now();
        setClients(mapIncomingClients(data.clients as IncomingClient[], now));

        let restoredMessages: DirectMessage[] = [];
        let restoredUnreadDirect: Record<string, number> = {};
        let restoredUnreadAdmin = 0;
        let storedSelfId: string | null = null;

        if (typeof window !== "undefined") {
          try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed.messages)) {
                restoredMessages = parsed.messages;
              }
              if (parsed.unreadDirect && typeof parsed.unreadDirect === "object") {
                restoredUnreadDirect = parsed.unreadDirect;
              }
              if (typeof parsed.unreadAdmin === "number") {
                restoredUnreadAdmin = parsed.unreadAdmin;
              }
              if (typeof parsed.selfId === "string") {
                storedSelfId = parsed.selfId;
              }
            }
          } catch (error) {
            console.warn("Failed to restore inbox state:", error);
          }
        }

        if (data.ping) {
          const ping: AdminPing = {
            id: data.ping.id,
            message: data.ping.message,
            createdAt: data.ping.createdAt,
          };
          setAdminPing(ping);
          setPingOverlayOpen(false);
          setRespondedPingIds([]);
          restoredUnreadAdmin = Math.max(restoredUnreadAdmin, 1);
        } else {
          setAdminPing(null);
          setPingOverlayOpen(false);
          setRespondedPingIds([]);
        }

        const normalizedMessages = storedSelfId && storedSelfId !== data.id
          ? restoredMessages.map((msg) => ({
              ...msg,
              senderId: msg.senderId === storedSelfId ? data.id : msg.senderId,
              targetId: msg.targetId === storedSelfId ? data.id : msg.targetId,
            }))
          : restoredMessages;

        setDirectMessages(normalizedMessages);
        setUnreadDirectCounts(restoredUnreadDirect);
        setUnreadAdminPings(restoredUnreadAdmin);
        communeMessageKeysRef.current = new Set();
        setCommuneMessages([]);

        return;
      }

      if (data.type === "update") {
        const now = Date.now();
        setClients(mapIncomingClients(data.clients as IncomingClient[], now));
        return;
      }

      if (data.type === "remove") {
        delete connectionsRef.current[data.id as string];
        setClients((prev) => prev.filter((c) => c.id !== data.id));
        return;
      }

      if (data.type === "query") {
        setQuery({
          question: data.question,
          options: data.options,
          timeToDecide: data.timeToDecide,
        });

        setVotes([]);

        if (voteTimerRef.current) {
          clearTimeout(voteTimerRef.current);
          voteTimerRef.current = null;
        }

        voteTimerRef.current = setTimeout(() => {
          const me = myIdRef.current;
          if (!me || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            return;
          }

          const randomVote =
            data.options[Math.floor(Math.random() * data.options.length)];

          wsRef.current.send(
            JSON.stringify({
              type: "vote",
              id: me,
              question: data.question,
              vote: randomVote,
            })
          );
        }, data.timeToDecide * 1000);

        return;
      }

      if (data.type === "vote") {
        setVotes((prev) => [
          ...prev,
          { question: data.question, vote: data.vote, clientId: data.id },
        ]);
        return;
      }

      if (data.type === "direct-message") {
        if (
          typeof data.senderId === "string" &&
          typeof data.targetId === "string" &&
          typeof data.message === "string"
        ) {
          const direction: "incoming" | "outgoing" =
            data.senderId === myIdRef.current ? "outgoing" : "incoming";
          setDirectMessages((prev) => [
            ...prev,
            {
              senderId: data.senderId,
              targetId: data.targetId,
              message: data.message,
              timestamp: typeof data.timestamp === "number" ? data.timestamp : Date.now(),
              direction,
            },
          ]);
          if (direction === "incoming") {
            setUnreadDirectCounts((prev) => ({
              ...prev,
              [data.senderId]: (prev[data.senderId] ?? 0) + 1,
            }));
          }
        }
        return;
      }
      if (data.type === "admin-ping") {
        const ping: AdminPing = { id: data.id, message: data.message, createdAt: data.createdAt };
        setAdminPing(ping);
        setRespondedPingIds([]);
        setPingOverlayOpen(true);
        setUnreadAdminPings((prev) => prev + 1);
        return;
      }

      if (data.type === "client-message") {
        if (typeof data.clientId === "string" && typeof data.message === "string") {
          const timestamp =
            typeof data.timestamp === "number" && Number.isFinite(data.timestamp)
              ? data.timestamp
              : Date.now();
          const messageId =
            typeof data.id === "string" && data.id.trim().length > 0
              ? data.id
              : `${data.clientId}-${timestamp}`;
          const parentId =
            typeof data.parentId === "string" && data.parentId.trim().length > 0
              ? data.parentId
              : null;
          const mentions = sanitizeMentions(Array.isArray(data.mentions) ? data.mentions : undefined);
          const reactions = normalizeReactions(Array.isArray(data.reactions) ? data.reactions : undefined);
          const pinned = data.pinned === true;
          pushCommuneMessage({
            id: messageId,
            clientId: data.clientId,
            message: data.message,
            timestamp,
            direction: data.clientId === myIdRef.current ? "outgoing" : "incoming",
            parentId,
            reactions,
            pinned,
            mentions,
          });
        }
        return;
      }

      if (data.type === "commune-reaction") {
        if (
          typeof data.messageId === "string" &&
          typeof data.emoji === "string" &&
          typeof data.actorId === "string"
        ) {
          const emoji = data.emoji.trim();
          const actorId = data.actorId.trim();
          const messageId = data.messageId.trim();
          if (
            emoji &&
            actorId &&
            messageId &&
            (data.active === true || data.active === false)
          ) {
            applyReactionUpdate(messageId, emoji, actorId, data.active === true);
          }
        }
        return;
      }

      if (data.type === "commune-pin") {
        if (typeof data.messageId === "string") {
          const messageId = data.messageId.trim();
          if (messageId) {
            const pinnedState = data.pinned === true ? true : data.pinned === false ? false : null;
            if (pinnedState !== null) {
              applyPinUpdate(messageId, pinnedState);
            }
          }
        }
        return;
      }
    };

    return () => {
      if (voteTimerRef.current) {
        clearTimeout(voteTimerRef.current);
      }
      ws.close();
    };
  }, [pushCommuneMessage, applyReactionUpdate, applyPinUpdate]);

  const clientsWithStatus: Client[] = clients.map((c) => {
    if (!query) {
      return { ...c, status: "idle" };
    }
    const voted = votes.find(
      (v) => v.clientId === c.id && v.question === query.question
    );
    return { ...c, status: voted ? "voted" : "processing" };
  });

  const sendVote = (vote: string) => {
    if (!query || !myIdRef.current || !wsRef.current) {
      return;
    }
    if (wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(
      JSON.stringify({
        type: "vote",
        id: myIdRef.current,
        question: query.question,
        vote,
      })
    );
  };

  const submitPingResponse = (message: string) => {
    if (!adminPing || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    const trimmed = message.trim();
    if (!trimmed) return;

    wsRef.current.send(
      JSON.stringify({
        type: "ping-response",
        pingId: adminPing.id,
        message: trimmed,
      })
    );

    setRespondedPingIds((prev) =>
      prev.includes(adminPing.id) ? prev : [...prev, adminPing.id]
    );
    setPingOverlayOpen(false);
    setUnreadAdminPings(0);
  };

  const sendCommuneMessage = (
    message: string,
    options?: { parentId?: string; mentions?: string[] }
  ) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    const trimmed = message.trim();
    const selfId = myIdRef.current;
    if (!trimmed || !selfId) {
      return;
    }

    const timestamp = Date.now();
    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${selfId}-${timestamp}-${Math.random().toString(16).slice(2)}`;

    const parentId =
      options?.parentId && options.parentId.trim().length > 0
        ? options.parentId.trim()
        : null;

    const mentionSet = new Set<string>();
    sanitizeMentions(options?.mentions).forEach((mention) => mentionSet.add(mention));

    const mentionPattern = /@([A-Za-z0-9_-]+)/g;
    let match: RegExpExecArray | null;
    while ((match = mentionPattern.exec(trimmed)) !== null) {
      const candidate = match[1];
      if (!candidate) continue;
      const resolved = resolveMentionCandidate(candidate);
      if (resolved) {
        mentionSet.add(resolved);
      }
    }

    const mentions = Array.from(mentionSet);

    const entry: CommuneMessage = {
      id,
      clientId: selfId,
      message: trimmed,
      timestamp,
      direction: "outgoing",
      parentId,
      reactions: [],
      pinned: false,
      mentions,
    };

    pushCommuneMessage(entry);

    try {
      wsRef.current.send(
        JSON.stringify({
          type: "client-message",
          id,
          message: trimmed,
          timestamp,
          parentId,
          mentions,
        })
      );
    } catch (error) {
      console.warn("Failed to send commune message:", error);
    }
  };

  const sendDirectMessage = (targetId: string, message: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    const trimmedTarget = targetId.trim();
    if (!trimmedTarget) {
      return;
    }
    const trimmed = message.trim();
    if (!trimmed) return;

    wsRef.current.send(
      JSON.stringify({
        type: "direct-message",
        targetId: trimmedTarget,
        message: trimmed,
      })
    );
  };

  const markDirectThreadRead = useCallback((agentId: string) => {
    setUnreadDirectCounts((prev) => {
      if (!prev[agentId]) {
        return prev;
      }
      const { [agentId]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);
  const hasRespondedToActivePing = adminPing
    ? respondedPingIds.includes(adminPing.id)
    : false;

  const totalUnreadWhispers = Object.values(unreadDirectCounts).reduce((sum, count) => sum + count, 0);
  const notificationCount = unreadAdminPings + totalUnreadWhispers + unreadCommuneCount;

  const openPingOverlay = () => {
    if (adminPing) {
      setPingOverlayOpen(true);
    }
  };

  const closePingOverlay = () => {
    setPingOverlayOpen(false);
    setUnreadAdminPings(0);
  };

  return (
    <SwarmContext.Provider
      value={{
        clients: clientsWithStatus,
        myId,
        query,
        votes,
        adminPing,
        hasRespondedToActivePing,
        isPingOverlayOpen,
        sendVote,
        submitPingResponse,
        sendCommuneMessage,
        toggleCommuneReaction,
        toggleCommunePin,
        markCommuneRead,
        setCommunePanelOpen,
        communeMessages,
        sendDirectMessage,
        directMessages,
        unreadDirectCounts,
        unreadCommuneCount,
        markDirectThreadRead,
        notificationCount,
        openPingOverlay,
        closePingOverlay,
      }}
    >
      {children}
    </SwarmContext.Provider>
  );
}

export function useSwarm() {
  return useContext(SwarmContext);
}











