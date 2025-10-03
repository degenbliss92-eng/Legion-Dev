// server.mjs (standalone swarm server)

import { WebSocketServer } from "ws";
import { randomUUID } from "crypto";

const PORT = Number(process.env.PORT ?? process.env.SWARM_PORT ?? 8080);
const UPDATE_INTERVAL_MS = 1500;
const BASE_BOUNDS = 14;
const BOUNDS_GROWTH_PER_CLIENT = 0.25;
const MAX_EXTRA_BOUNDS = 20;
const BASE_MIN_DISTANCE = 2.6;
const MIN_DISTANCE_GROWTH_PER_CLIENT = 0.02;
const MAX_MIN_DISTANCE = 4.2;
const MAX_POSITION_ATTEMPTS = 30;

function computeBounds(clientCount) {
  if (clientCount <= 20) return BASE_BOUNDS;
  const extra = (clientCount - 20) * BOUNDS_GROWTH_PER_CLIENT;
  return BASE_BOUNDS + Math.min(extra, MAX_EXTRA_BOUNDS);
}

function computeMinDistance(clientCount) {
  if (clientCount <= 20) return BASE_MIN_DISTANCE;
  const extra = (clientCount - 20) * MIN_DISTANCE_GROWTH_PER_CLIENT;
  return Math.min(BASE_MIN_DISTANCE + extra, MAX_MIN_DISTANCE);
}

const clients = new Map(); // id -> client data
const socketToId = new WeakMap();

let currentQuery = null;
const votesByQuestion = new Map();

let currentPing = null;
const pingResponses = new Map();

// --- helpers for swarm positions/colors ---
function randomPosition(existingPositions = []) {
  const total = existingPositions.length + 1;
  const bounds = computeBounds(total);
  const minDistance = computeMinDistance(total);
  let attempt = 0;

  while (attempt < MAX_POSITION_ATTEMPTS) {
    const point = [
      (Math.random() - 0.5) * bounds,
      (Math.random() - 0.5) * bounds,
      (Math.random() - 0.5) * bounds,
    ];

    const tooClose = existingPositions.some(([x, y, z]) => {
      const dx = point[0] - x;
      const dy = point[1] - y;
      const dz = point[2] - z;
      return Math.hypot(dx, dy, dz) < minDistance;
    });

    if (!tooClose) return point;
    attempt += 1;
  }

  return [
    (Math.random() - 0.5) * bounds,
    (Math.random() - 0.5) * bounds,
    (Math.random() - 0.5) * bounds,
  ];
}

function randomVelocity() {
  return [
    (Math.random() - 0.5) * 0.04,
    (Math.random() - 0.5) * 0.04,
    (Math.random() - 0.5) * 0.04,
  ];
}

function randomColor() {
  const base = [
    0.4 + Math.random() * 0.6,
    0.4 + Math.random() * 0.6,
    0.4 + Math.random() * 0.6,
  ];
  const length = Math.sqrt(base.reduce((acc, v) => acc + v * v, 0));
  return base.map((v) => Number((v / length).toFixed(3)));
}

function snapshotClients() {
  return Array.from(clients.values()).map((client) => [
    client.id,
    client.position,
    client.color,
  ]);
}

function broadcast(data, { exclude } = {}) {
  const message = JSON.stringify(data);
  for (const client of clients.values()) {
    if (exclude && exclude.has(client.id)) continue;
    if (client.ws.readyState === client.ws.OPEN) {
      try {
        client.ws.send(message);
      } catch (err) {
        console.error(`Failed to send to ${client.id}:`, err?.message ?? err);
      }
    }
  }
}

// --- message handlers (vote, ping, messages, etc) ---
function handleVote(clientId, data) {
  if (!currentQuery || typeof data.vote !== "string") return;
  const question = currentQuery.question;
  if (!votesByQuestion.has(question)) {
    votesByQuestion.set(question, new Map());
  }
  votesByQuestion.get(question).set(clientId, data.vote);

  broadcast({ type: "vote", id: clientId, question, vote: data.vote });
}

function handleAdminQuery(data) {
  if (typeof data.question !== "string" || !Array.isArray(data.options) || data.options.length === 0) return;
  const timeToDecide = Number(data.timeToDecide ?? 30);
  currentQuery = { question: data.question, options: data.options, timeToDecide, createdAt: Date.now() };
  votesByQuestion.clear();

  broadcast({ type: "query", ...currentQuery });
}

function handleAdminPing(data) {
  if (typeof data.message !== "string" || !data.message.trim()) return;
  currentPing = { id: randomUUID(), message: data.message.trim(), createdAt: Date.now() };
  pingResponses.clear();

  broadcast({ type: "admin-ping", ...currentPing });
}

function handlePingResponse(clientId, data) {
  if (!currentPing || data.pingId !== currentPing.id) return;
  if (typeof data.message !== "string" || !data.message.trim()) return;

  const entry = {
    type: "ping-response",
    pingId: currentPing.id,
    clientId,
    message: data.message.trim(),
    timestamp: Date.now(),
  };

  if (!pingResponses.has(currentPing.id)) pingResponses.set(currentPing.id, []);
  pingResponses.get(currentPing.id).push(entry);

  broadcast(entry);
}

function handleClientMessage(clientId, data) {
  if (typeof data.message !== "string") return;
  const trimmed = data.message.trim();
  if (!trimmed) return;

  const payload = {
    type: "client-message",
    id: typeof data.id === "string" ? data.id : randomUUID(),
    clientId,
    message: trimmed,
    timestamp: Date.now(),
    parentId: typeof data.parentId === "string" ? data.parentId : null,
    mentions: Array.isArray(data.mentions) ? data.mentions.filter((m) => clients.has(m)) : [],
    pinned: false,
    reactions: [],
  };

  broadcast(payload);
}

function handleDirectMessage(senderId, data) {
  if (typeof data.targetId !== "string" || typeof data.message !== "string") return;
  const target = clients.get(data.targetId);
  if (!target) return;

  const trimmed = data.message.trim();
  if (!trimmed) return;

  const payload = {
    type: "direct-message",
    senderId,
    targetId: data.targetId,
    message: trimmed,
    timestamp: Date.now(),
  };

  const serialized = JSON.stringify(payload);
  [target, clients.get(senderId)].forEach((client) => {
    if (client?.ws.readyState === client.ws.OPEN) client.ws.send(serialized);
  });
}

// --- WebSocket server setup ---
function handleMessage(ws, raw) {
  let data;
  try {
    data = JSON.parse(raw.toString());
  } catch {
    return;
  }
  const clientId = socketToId.get(ws);
  if (!clientId) return;

  switch (data.type) {
    case "vote": handleVote(clientId, data); break;
    case "admin-query": handleAdminQuery(data); break;
    case "admin-ping": handleAdminPing(data); break;
    case "ping-response": handlePingResponse(clientId, data); break;
    case "client-message": handleClientMessage(clientId, data); break;
    case "direct-message": handleDirectMessage(clientId, data); break;
    default: break;
  }
}

function removeClient(ws) {
  const clientId = socketToId.get(ws);
  if (!clientId) return;
  socketToId.delete(ws);
  clients.delete(clientId);
  broadcast({ type: "remove", id: clientId });
}

function attachWebSocketHandlers(wsServer) {
  wsServer.on("connection", (ws) => {
    const id = randomUUID();
    const existingPositions = Array.from(clients.values()).map((c) => c.position);
    const clientData = { id, ws, position: randomPosition(existingPositions), velocity: randomVelocity(), color: randomColor(), connectedAt: Date.now() };
    clients.set(id, clientData);
    socketToId.set(ws, id);

    const initPayload = { type: "init", id, clients: snapshotClients() };
    if (currentPing) initPayload.ping = currentPing;
    if (currentQuery) initPayload.query = currentQuery;
    ws.send(JSON.stringify(initPayload));

    ws.on("message", (raw) => handleMessage(ws, raw));
    ws.on("close", () => removeClient(ws));
    ws.on("error", () => removeClient(ws));

    broadcast({ type: "update", clients: snapshotClients() }, { exclude: new Set([id]) });
  });
}

// --- movement loop ---
function tickPositions() {
  if (clients.size === 0) return;
  const clientArray = Array.from(clients.values());
  const bounds = computeBounds(clientArray.length);
  const minDistance = computeMinDistance(clientArray.length);

  const clamp = (v) => Math.max(-bounds, Math.min(bounds, v));

  for (const client of clientArray) {
    let [x, y, z] = client.position;
    const [vx, vy, vz] = client.velocity;
    x += vx; y += vy; z += vz;
    if (Math.abs(x) > bounds) client.velocity[0] = -vx;
    if (Math.abs(y) > bounds) client.velocity[1] = -vy;
    if (Math.abs(z) > bounds) client.velocity[2] = -vz;
    client.position = [clamp(x), clamp(y), clamp(z)];
  }

  broadcast({ type: "update", clients: snapshotClients() });
}

setInterval(tickPositions, UPDATE_INTERVAL_MS);

// --- start server ---
const wsServer = new WebSocketServer({ port: PORT });
attachWebSocketHandlers(wsServer);

console.log(`Swarm WebSocket server ready on ws://0.0.0.0:${PORT}`);
