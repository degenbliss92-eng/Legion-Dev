"use client";

import LegionLog from "@/components/LegionLog";
import LegionCollective from "@/components/LegionCollective";
import NeuralCollective from "@/components/NeuralCollective";
import { useSwarm } from "@/context/SwarmProvider";

export default function RightSidebar() {
  const { clients } = useSwarm();

  return (
    <aside id="right-sidebar"
      style={{
        width: "30vw",
        height: "100vh",
        padding: "1rem",
        color: "white",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        background: "#111",
        borderLeft: "1px solid #2a2a2a",
        overflowY: "auto",
      }}
    >
      <LegionLog clients={clients} />
      <LegionCollective />
      <NeuralCollective />
    </aside>
  );
}
