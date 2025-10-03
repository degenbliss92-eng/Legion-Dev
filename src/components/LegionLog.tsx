"use client";
import { useRef } from "react";
import "./legionlog.css"; // import external CSS

type LegionLogProps = {
  title?: string;
  height?: number;
  clients?: { id: string; color: [number, number, number] }[];
};

export default function LegionLog({
  title = "Active Agents",
  height = 420,
  clients = [],
}: LegionLogProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  return (
    <section className="legion-wrap" style={{ height }}>
      <div className="ring" aria-hidden />
      <div className="accents" aria-hidden>
        <span />
        <span />
        <span />
        <span />
      </div>

      <header className="head">
        <h3>{title}</h3>
        <div className="right">
          <span className="badge" title="Active client connections">
            {clients.length}
          </span>
        </div>
      </header>

      <div className="meta">
        <div className="sub">Live swarm presence</div>
       
      </div>

      <div className="divider" />

      {/* List of clients */}
      <div ref={scrollRef} className="panel">
        {clients.length > 0 ? (
          <ul className="entries">
            {clients.map((c) => (
              <li key={c.id} className="agent-row">
                <span
                  className="agent-color"
                  style={{
                    backgroundColor: `rgb(${c.color[0] * 255}, ${c.color[1] * 255}, ${c.color[2] * 255})`,
                  }}
                />
                <span className="agent-id">Agent {c.id.slice(-4)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="entries" style={{ color: "var(--text-dim)" }}>
            No agents connected.
          </div>
        )}
      </div>

      <div className="scanline" aria-hidden />
    </section>
  );
}
