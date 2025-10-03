"use client";
import { useEffect, useRef, useState } from "react";
import { useSwarm } from "@/context/SwarmProvider";
import "./legionCollective.css";

const METRIC_TERMS = [
  "resonance lattice",
  "signal cascade",
  "coherence field",
  "entropy slope",
  "bandwidth channel",
  "latency envelope",
  "alignment vector",
  "neuroflux stream",
  "momentum arc",
  "feedback spiral",
  "probability mesh",
  "variance loop",
] as const;

const ACTION_TERMS = [
  "stabilizing",
  "amplifying",
  "dampening",
  "triangulating",
  "re-weighting",
  "harmonizing",
  "vectorizing",
  "re-indexing",
  "phase aligning",
  "calibrating",
  "forecasting",
  "synthesizing",
] as const;

const CONTEXT_SHARDS = [
  "oracle deltas",
  "signal-to-noise",
  "agent clusters",
  "consensus bloom",
  "risk surface",
  "governance backlog",
  "liquidity bands",
  "anomaly map",
] as const;

const CRYPTO_TOKENS = ["SOL", "USDC", "RAY", "SRM", "JUP"] as const;
const SAMPLE_MINTS = [
  "So11111111111111111111111111111111111111112",
  "Es9vMFrzaCER6FzF7CqMfQvPpV4V3G4k1cx2Z6wQe1C",
  "4k3Dyjzvzp8e6R2V6PqQvFh5v3w1Z1F4g2v5u7s9sXq",
] as const;

function randomItem<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function randomPercent(min = 20, max = 98) {
  return (min + Math.random() * (max - min)).toFixed(1);
}

function randomMilliseconds(min = 120, max = 540) {
  return Math.floor(min + Math.random() * (max - min));
}

function randomShortAddr() {
  // produce a short mock address like 'a1b2...c3d4'
  const hex = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
  return `${hex.slice(0, 4)}...${hex.slice(-4)}`;
}

function buildLogLine() {
  const pattern = Math.floor(Math.random() * 4);
  switch (pattern) {
    case 0:
      return `${randomItem(ACTION_TERMS)} ${randomItem(METRIC_TERMS)} (${randomPercent()}% coherence)`;
    case 1:
      return `Integrating ${randomItem(CONTEXT_SHARDS)} -> ${randomItem(METRIC_TERMS)}`;
    case 2:
      return `Projecting ${randomItem(METRIC_TERMS)} horizon @ ${randomMilliseconds()}ms latency`;
    case 3:
      return `Rebalancing consensus weights (${randomPercent(35, 100)}% alignment)`;
    default:
      // Crypto-related diagnostic lines
      const cryptoPattern = Math.floor(Math.random() * 5);
      const token = randomItem(CRYPTO_TOKENS);
      const mint = randomItem(SAMPLE_MINTS);
      switch (cryptoPattern) {
        case 0:
          return `Checking transaction history for ${randomShortAddr()} (scanning SPL transfers)`;
        case 1:
          return `Querying Solana Anchor program ${mint} for account deserializations`;
        case 2:
          return `Fetching token balances for ${token} across known holders`;
        case 3:
          return `Polling Jupiter price oracle for ${token} and updating feed`;
        default:
          return `Indexing token holder set for mint ${mint} (snapshot in progress)`;
      }
  }
}

export default function LegionCollective() {
  const { myId, query, votes } = useSwarm();
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [decided, setDecided] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // keep refs for timers so we can clear them early
  const logIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query) return;

    // reset state
    setLogs([`New query: ${query.question}`]);
    setProgress(0);
    setDecided(false);

    const start = Date.now();
    const duration = query.timeToDecide * 1000;

    // log generator
    logIntervalRef.current = setInterval(() => {
      setLogs((prev) => [buildLogLine(), ...prev]);
    }, 2000);

    // progress updater
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.min((elapsed / duration) * 100, 100));
    }, 500);

    // stop everything when time runs out
    stopTimerRef.current = setTimeout(() => {
      if (logIntervalRef.current) clearInterval(logIntervalRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setLogs((prev) => ["Decision window closed.", ...prev]);
      setDecided(true);
      setProgress(100);
    }, duration);

    return () => {
      if (logIntervalRef.current) clearInterval(logIntervalRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    };
  }, [query]);

  // auto-scroll logs
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [logs]);

  // stop logs immediately when agent votes
  useEffect(() => {
    if (!query || !myId || decided) return;

    const myVote = votes.find((v) => v.clientId === myId);
    if (myVote) {
      if (logIntervalRef.current) clearInterval(logIntervalRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);

      setLogs((prev) => [`Decision made: ${myVote.vote}`, ...prev]);
      setDecided(true);
      setProgress(100);
    }
  }, [votes, query, myId, decided]);

  // compute consensus
  let myVote = null;
  if (query && myId) {
    myVote = votes.find((v) => v.clientId === myId)?.vote ?? null;
  }

  let consensus = 0;
  if (query && myVote) {
    const total = votes.filter((v) => v.question === query.question).length;
    const same = votes.filter((v) => v.vote === myVote).length;
    consensus = total > 0 ? Math.round((same / total) * 100) : 0;
  }

  const consensusColor = consensus >= 66 ? "lime" : consensus >= 33 ? "orange" : "red";

  return (
    <section className="collective-wrap">
      <header className="collective-head">
        <h3>Legion Collective</h3>
      </header>

      {query ? (
        <>
          <div className="query-block">
            <div className="question">{query.question}</div>
            <div className="options">
              {query.options.map((opt) => (
                <span key={opt} className="chip">{opt}</span>
              ))}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="progress-bar">
            <div className="fill" style={{ width: `${progress}%` }} />
          </div>
        </>
      ) : (
        <div className="empty">No active query</div>
      )}

      <div ref={scrollRef} className="logs">
        {logs.map((log, i) => (
          <div key={i} className="log-line">{log}</div>
        ))}
      </div>

      {myVote && (
        <div className="decision">
          <span className="vote">Decision: {myVote}</span>
          <span className="consensus" style={{ color: consensusColor }}>
            {consensus}% consensus
          </span>
        </div>
      )}
    </section>
  );
}
