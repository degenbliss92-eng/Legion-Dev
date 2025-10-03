"use client";

import { useCallback, useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import SwarmCanvas from "@/components/SwarmCanvas";
import RightSidebar from "@/components/RightSidebar";
import WelcomeModal from "@/components/WelcomeModal";
import TourOverlay, { TOUR_LENGTH } from "@/components/TourOverlay";
import GroupChat from "@/components/GroupChat";
import AdminPingBanner from "@/components/AdminPingBanner";

type DashboardProps = {
  showWelcome: boolean;
  onConnect: () => void;
};

function Dashboard({ showWelcome, onConnect }: DashboardProps) {
  return (
    <div style={{ position: "relative" }}>
      <WelcomeModal isOpen={showWelcome} onConnect={onConnect} />
      <main
        style={{
          display: showWelcome ? "none" : "flex",
          height: "100vh",
          width: "100vw",
          background: "black",
        }}
      >
        {/* Sidebar (left) */}
        <Sidebar />

        {/* Center: Swarm Canvas */}
        <section id="swarm-canvas-area" style={{ width: "70vw", height: "100vh" }}>
          <SwarmCanvas />
        </section>

        {/* Commune Panel */}
        <GroupChat forceOpen={false} onCollapsedChange={() => {}} />

        {/* Right: Legion panels */}
        <RightSidebar />
      </main>
    </div>
  );
}

export default function Page() {
  const [showWelcome, setShowWelcome] = useState<boolean | null>(null);
  const [tourCompleted, setTourCompleted] = useState<boolean | null>(null);
  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const welcomeDismissed = window.localStorage.getItem("legion-welcome-dismissed") === "true";
    const tourDone = window.localStorage.getItem("legion-tour-complete") === "true";
    setShowWelcome(welcomeDismissed ? false : true);
    setTourCompleted(tourDone);
  }, []);

  const finishTour = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("legion-tour-complete", "true");
    }
    setShowTour(false);
    setTourCompleted(true);
  }, []);

  const handleConnect = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("legion-welcome-dismissed", "true");
    }
    setShowWelcome(false);
    setTourStep(0);
    setShowTour(true);
    setTourCompleted(false);
  }, []);

  const handleTourNext = useCallback(() => {
    setTourStep((prev) => {
      if (prev >= TOUR_LENGTH - 1) {
        finishTour();
        return prev;
      }
      return prev + 1;
    });
  }, [finishTour]);

  const handleTourSkip = useCallback(() => {
    finishTour();
  }, [finishTour]);

  const modalVisible = showWelcome === null ? true : showWelcome;

  useEffect(() => {
    // When the welcome modal has been dismissed, start the tour only if it hasn't been completed
    if (showWelcome === false) {
      if (!tourCompleted) {
        setTourStep(0);
        setShowTour(true);
        setTourCompleted(false);
      }
    }
  }, [showWelcome, tourCompleted]);

  return (
    <>
      <TourOverlay
        isOpen={showTour}
        step={Math.min(tourStep, TOUR_LENGTH - 1)}
        onNext={handleTourNext}
        onSkip={handleTourSkip}
      />
      <Dashboard showWelcome={modalVisible} onConnect={handleConnect} />
      {/* Admin ping banner (bottom-right) */}
      <AdminPingBanner />
    </>
  );
}
