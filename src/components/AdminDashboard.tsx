"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import "./adminDashboard.css";

type Vote = {
  id: string;
  question: string;
  vote: string;
};

type Query = {
  topic: string;
  options: string[];
  timeToDecide: number;
};

type Ping = {
  id: string;
  message: string;
  createdAt: number;
};

type PingResponse = {
  pingId: string;
  clientId: string;
  message: string;
  timestamp: number;
};

type ClientMessage = {
  clientId: string;
  message: string;
  timestamp: number;
};

function formatTimestamp(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function AdminDashboard() {
  const [ws, setWs] = useState<WebSocket | null>(null);

  const [topic, setTopic] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [optionInput, setOptionInput] = useState("");
  const [timeToDecide, setTimeToDecide] = useState(30);

  const [activeQuery, setActiveQuery] = useState<Query | null>(null);
  const [queryHistory, setQueryHistory] = useState<Query[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);

  const [logs, setLogs] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement | null>(null);

  const [pingMessage, setPingMessage] = useState("");
  const [activePing, setActivePing] = useState<Ping | null>(null);
  const [pingResponses, setPingResponses] = useState<PingResponse[]>([]);
  const activePingRef = useRef<Ping | null>(null);

  const [clientMessages, setClientMessages] = useState<ClientMessage[]>([]);

  useEffect(() => {
    const resolveWsUrl = () => {
      if (process.env.NEXT_PUBLIC_SWARM_WS) {
        return process.env.NEXT_PUBLIC_SWARM_WS;
      }
      if (typeof window !== "undefined") {
        const protocol = window.location.protocol === "https:" ? "wss" : "ws";
        return `${protocol}://${window.location.host}`;
      }
      return "ws://localhost:8080";
    };

    const socket = new WebSocket(resolveWsUrl());

    socket.onopen = () => {
      setLogs((prev) => [...prev, "Connected to WebSocket server"]);
    };

    socket.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);

        if (data.type === "init") {
          if (data.ping) {
            const ping: Ping = {
              id: data.ping.id,
              message: data.ping.message,
              createdAt: data.ping.createdAt,
            };
            activePingRef.current = ping;
            setActivePing(ping);
            setPingResponses([]);
          }
          return;
        }

        if (data.type === "vote") {
          setVotes((prev) => [...prev, data]);
          setLogs((prev) => [
            ...prev,
            `Client ${data.id.slice(-4)} voted: ${data.vote}`,
          ]);
          return;
        }

        if (data.type === "admin-ping") {
          const ping: Ping = {
            id: data.id,
            message: data.message,
            createdAt: data.createdAt,
          };
          activePingRef.current = ping;
          setActivePing(ping);
          setPingResponses([]);
          setLogs((prev) => [...prev, `Ping broadcast: "${data.message}"`]);
          return;
        }

        if (data.type === "ping-response") {
          const current = activePingRef.current;
          if (current && data.pingId === current.id) {
            setPingResponses((prev) => [...prev, data]);
            setLogs((prev) => [
              ...prev,
              `Reply from ${data.clientId.slice(-4)}: ${data.message}`,
            ]);
          }
          return;
        }

        if (data.type === "client-message") {
          const entry: ClientMessage = {
            clientId: data.clientId,
            message: data.message,
            timestamp: data.timestamp,
          };
          setClientMessages((prev) => [entry, ...prev].slice(0, 100));
          setLogs((prev) => [
            ...prev,
            `Commune from ${data.clientId.slice(-4)}: ${data.message}`,
          ]);
          return;
        }
      } catch (err) {
        console.error("Message parse error:", err);
      }
    };

    socket.onclose = () => {
      setLogs((prev) => [...prev, "Disconnected from server"]);
    };

    setWs(socket);
    return () => socket.close();
  }, []);

  useEffect(() => {
    activePingRef.current = activePing;
  }, [activePing]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const addOption = () => {
    if (optionInput.trim()) {
      setOptions((prev) => [...prev, optionInput.trim()]);
      setOptionInput("");
    }
  };

  const sendQuery = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (!topic || options.length < 2) {
      alert("Please enter a topic and at least 2 options.");
      return;
    }

    const query = {
      type: "admin-query",
      question: topic,
      options,
      timeToDecide,
    };

    ws.send(JSON.stringify(query));

    const newQuery = { topic, options, timeToDecide };
    setActiveQuery(newQuery);
    setQueryHistory((prev) => [newQuery, ...prev]);
    setVotes([]);

    setLogs((prev) => [...prev, `Sent query: "${topic}"`]);

    setTopic("");
    setOptions([]);
    setTimeToDecide(30);
  };

  const sendPing = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (!pingMessage.trim()) {
      alert("Enter a message before pinging the swarm.");
      return;
    }

    ws.send(
      JSON.stringify({
        type: "admin-ping",
        message: pingMessage.trim(),
      })
    );

    setPingMessage("");
  };

  const tally = useMemo(() => {
    if (!activeQuery) return {} as Record<string, number>;
    const base: Record<string, number> = {};
    activeQuery.options.forEach((opt) => (base[opt] = 0));
    votes.forEach((v) => {
      if (base[v.vote] !== undefined) base[v.vote] += 1;
    });
    return base;
  }, [activeQuery, votes]);

  return (
    <div className="admin-wrap">
      <h2 className="title">Admin Dashboard</h2>

      <section className="form">
        <h3>Create New Query</h3>
        <input
          type="text"
          placeholder="Enter topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="input"
        />
        <div className="option-box">
          <input
            type="text"
            placeholder="Add option"
            value={optionInput}
            onChange={(e) => setOptionInput(e.target.value)}
            className="input"
          />
          <button className="add-btn" onClick={addOption}>Add</button>
        </div>
        <div className="options-list">
          {options.map((opt, i) => (
            <span key={i} className="chip">
              {opt}
            </span>
          ))}
        </div>
        <label>
          Time to decide:
          <input
            type="number"
            min={5}
            value={timeToDecide}
            onChange={(e) => setTimeToDecide(parseInt(e.target.value, 10))}
            className="input"
          />
          seconds
        </label>
        <button className="send-btn" onClick={sendQuery}>Send Query</button>
      </section>

      <section className="ping-section">
        <h3>Ping Connected Clients</h3>
        <textarea
          rows={3}
          className="input"
          value={pingMessage}
          onChange={(e) => setPingMessage(e.target.value)}
          placeholder="Broadcast a short instruction"
        />
        <button className="send-btn" onClick={sendPing}>Send Ping</button>

        {activePing && (
          <div className="active-ping">
            <header>
              <strong>Active message</strong>
              <span>{formatTimestamp(activePing.createdAt)}</span>
            </header>
            <p>{activePing.message}</p>
            <div className="responses">
              <strong>Responses ({pingResponses.length})</strong>
              {pingResponses.length === 0 ? (
                <p className="response-empty">No replies yet.</p>
              ) : (
                <ul>
                  {pingResponses.map((resp, idx) => (
                    <li key={`${resp.clientId}-${idx}`}>
                      <span>Agent {resp.clientId.slice(-4)}</span>
                      <span className="response-time">{formatTimestamp(resp.timestamp)}</span>
                      <p>{resp.message}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="commune-feed">
        <h3>Commune Messages</h3>
        {clientMessages.length === 0 ? (
          <p>No messages yet.</p>
        ) : (
          <ul className="commune-list">
            {clientMessages.map((msg, idx) => (
              <li key={`${msg.clientId}-${idx}`}>
                <div className="commune-meta">
                  <span>Agent {msg.clientId.slice(-4)}</span>
                  <span>{formatTimestamp(msg.timestamp)}</span>
                </div>
                <p>{msg.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {activeQuery && (
        <section className="active-query">
          <h3>Current Round Results</h3>
          <p>
            <strong>{activeQuery.topic}</strong>
          </p>
          <div className="tally">
            {Object.entries(tally).map(([opt, count]) => (
              <div key={opt} className="tally-line">
                {opt}: {count} votes
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="history">
        <h3>Query History</h3>
        {queryHistory.length === 0 && <p>No queries yet.</p>}
        {queryHistory.map((q, i) => (
          <div key={i} className="history-item">
            <strong>{q.topic}</strong> ({q.options.join(" / ")}), {q.timeToDecide}s
          </div>
        ))}
      </section>

      <section className="logs" ref={logRef}>
        {logs.map((log, i) => (
          <div key={i} className="log">
            {log}
          </div>
        ))}
      </section>
    </div>
  );
}
