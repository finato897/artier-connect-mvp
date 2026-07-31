"use client";

import type { StreamStats } from "@/lib/webrtc";

interface Props {
  stats: StreamStats;
  visible: boolean;
}

export default function StatsOverlay({ stats, visible }: Props) {
  if (!visible) return null;

  const res = stats.width && stats.height ? `${stats.width}×${stats.height}` : "—";

  return (
    <div className="pointer-events-none absolute top-3 left-3 rounded-lg bg-black/60 px-3 py-2 font-mono text-xs text-emerald-300 backdrop-blur-sm">
      <div>{stats.fps} fps</div>
      <div>{stats.bitrateKbps ? `${Math.round(stats.bitrateKbps)} kbps` : "— kbps"}</div>
      <div>{res}</div>
    </div>
  );
}
