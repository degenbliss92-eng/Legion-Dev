// src/hooks/useSwarm.ts
"use client";

import { useEffect, useRef, useState } from "react";

interface ClientData {
  id: string;
  position: [number, number, number];
  color: [number, number, number];
}

export function useSwarm() {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8080");
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === "init") {
        // server sends: { type, id, clients: [[id, position, color], ...] }
        setMyId(msg.id);
        const normalized = msg.clients.map(
          ([id, position, color]: [string, [number, number, number], [number, number, number]]) => ({
            id,
            position,
            color,
          })
        );
        setClients(normalized);
      }

      if (msg.type === "update") {
        const normalized = msg.clients.map(
          ([id, position, color]: [string, [number, number, number], [number, number, number]]) => ({
            id,
            position,
            color,
          })
        );
        setClients(normalized);
      }

      if (msg.type === "remove") {
        setClients((prev) => prev.filter((c) => c.id !== msg.id));
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  return { clients, myId };
}
