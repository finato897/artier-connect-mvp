// Helper WebRTC bersama untuk sisi server (sender) dan client (receiver).

export const STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

export type QualityPreset = "auto" | "hd" | "balanced" | "data";

export interface PresetConfig {
  label: string;
  /** undefined = biarkan browser memilih (auto) */
  maxBitrate?: number;
  /** frameRate maksimum pada constraints awal */
  frameRate?: number;
  width?: { ideal: number };
  height?: { ideal: number };
}

export const PRESETS: Record<QualityPreset, PresetConfig> = {
  auto: { label: "Otomatis", maxBitrate: undefined, frameRate: 30 },
  hd: {
    label: "HD",
    maxBitrate: 4_000_000,
    frameRate: 30,
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
  balanced: {
    label: "Seimbang",
    maxBitrate: 2_500_000,
    frameRate: 30,
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
  data: {
    label: "Hemat Data",
    maxBitrate: 800_000,
    frameRate: 15,
    width: { ideal: 640 },
    height: { ideal: 480 },
  },
};

export function createPeer(opts?: RTCConfiguration): RTCPeerConnection {
  return new RTCPeerConnection({
    iceServers: STUN_SERVERS,
    ...opts,
  });
}

/** Terapkan preset kualitas pada sender video (bitrate + FPS live). */
export async function applyPresetToSender(
  sender: RTCRtpSender | undefined,
  preset: QualityPreset
): Promise<void> {
  if (!sender) return;
  const params = sender.getParameters();
  const cfg = PRESETS[preset];
  if (params.encodings && params.encodings.length) {
    params.encodings[0].maxBitrate = cfg.maxBitrate;
    if (cfg.frameRate) params.encodings[0].maxFramerate = cfg.frameRate;
  }
  try {
    await sender.setParameters(params);
  } catch {
    // Set parameters bisa gagal saat stream tidak aktif — abaikan.
  }
}

export function trackConstraints(
  preset: QualityPreset
): MediaTrackConstraints {
  const cfg = PRESETS[preset];
  const c: MediaTrackConstraints = {};
  if (cfg.width) c.width = cfg.width;
  if (cfg.height) c.height = cfg.height;
  if (cfg.frameRate) c.frameRate = cfg.frameRate;
  return c;
}

export interface StreamStats {
  fps: number;
  bitrateKbps: number;
  width: number;
  height: number;
}

// Tipe struktural untuk baris stats video (inbound/outbound RTP).
type VideoRtpStats = RTCStats & {
  kind?: string;
  framesPerSecond?: number;
  frameWidth?: number;
  frameHeight?: number;
  bytesReceived?: number;
  bytesSent?: number;
};

/** Baca stats dari peer (dipanggil berkala). */
export async function collectStats(
  peer: RTCPeerConnection
): Promise<Omit<StreamStats, "bitrateKbps">> {
  const stats = await peer.getStats();
  const out: StreamStats = { fps: 0, bitrateKbps: 0, width: 0, height: 0 };

  stats.forEach((s) => {
    const r = s as VideoRtpStats;
    if (
      (r.type === "inbound-rtp" || r.type === "outbound-rtp") &&
      r.kind === "video"
    ) {
      if (r.framesPerSecond) out.fps = Math.round(r.framesPerSecond);
      if (r.frameWidth) out.width = r.frameWidth;
      if (r.frameHeight) out.height = r.frameHeight;
    }
  });

  return out;
}

/** Hitung bitrate dari dua snapshot (delta byte / delta waktu). */
export function bitrateBetween(
  prevBytes: number,
  prevTs: number,
  curBytes: number,
  curTs: number
): number {
  const dt = (curTs - prevTs) / 1000;
  if (dt <= 0) return 0;
  return Math.max(0, ((curBytes - prevBytes) * 8) / dt / 1000);
}
