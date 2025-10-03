"use client";
import { useSwarm } from "@/context/SwarmProvider";
import "./neuralCollective.css";

export default function NeuralCollective() {
  const { query, votes } = useSwarm();

  return (
    <section className="neural-wrap">
      <header className="neural-head">
        <h3>Neural Collective</h3>
      </header>

      {query ? (
        <div className="vote-table-wrap">
          <table className="vote-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Vote</th>
              </tr>
            </thead>
            <tbody>
              {votes
                .filter((v) => v.question === query.question)
                .map((v, i) => (
                  <tr key={i}>
                    <td>Agent {v.clientId.slice(-4)}</td>
                    <td>{v.vote}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">No active votes</div>
      )}
    </section>
  );
}
