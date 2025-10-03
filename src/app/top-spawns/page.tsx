"use client";

import Sidebar from "@/components/Sidebar";
import TopSpawns from "@/components/TopSpawns";
import LiveActivityPanel from "@/components/LiveActivityPanel";
import AdminPingBanner from "@/components/AdminPingBanner";

export default function TopSpawnsPage() {
  return (
    <>
      <AdminPingBanner />
      <main style={{ display: "flex", height: "100vh", width: "100vw", background: "black" }}>
        <Sidebar />

        <section
          style={{
            flex: 1,
            marginLeft: "72px",
            display: "flex",
            flexDirection: "column",
            padding: "1rem",
            color: "white",
            gap: "1rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h1 style={{ fontSize: "1.2rem", fontWeight: 600 }}>Top Spawns</h1>
            <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.65)" }}>
              Live leaderboard of swarm engagement
            </span>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              flex: 1,
              minHeight: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                flex: 1,
                gap: "1rem",
                minHeight: 0,
              }}
            >
              <div style={{ flex: 2, minWidth: 0 }}>
                <TopSpawns />
              </div>
              <div style={{ flex: 1, minWidth: "320px" }}>
                <LiveActivityPanel />
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

