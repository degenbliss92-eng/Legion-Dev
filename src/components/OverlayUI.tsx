"use client";

import { Dispatch, SetStateAction } from "react";

interface OverlayUIProps {
  follow: boolean;
  setFollow: Dispatch<SetStateAction<boolean>>;
  setResetTrigger: Dispatch<SetStateAction<number>>;
  setZoomOutTrigger: Dispatch<SetStateAction<number>>;
}

export default function OverlayUI({
  follow,
  setFollow,
  setResetTrigger,
  setZoomOutTrigger,
}: OverlayUIProps) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => setFollow((prev) => !prev)}
        className="px-3 py-1 bg-gray-800 text-white rounded shadow"
      >
        {follow ? "Free Fly" : "Follow"}
      </button>

      <button
        onClick={() => setResetTrigger((t) => t + 1)}
        className="px-3 py-1 bg-blue-600 text-white rounded shadow"
      >
        Reset Camera
      </button>

      <button
        onClick={() => setZoomOutTrigger((t) => t + 1)}
        className="px-3 py-1 bg-purple-600 text-white rounded shadow"
      >
        Zoom Out
      </button>
    </div>
  );
}
