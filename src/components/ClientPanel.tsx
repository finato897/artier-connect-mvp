"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import StatsOverlay from "./StatsOverlay";
import {
  apiJoin,
  apiGetRoom,
  apiPutRoom,
  apiPushIce,
  apiDrainIce,
  apiConnected,
  getPublicIp,
} from "@/lib/signal";
import { createPeer } from "@/lib/webrtc";

type Status = "idle" | "joining" | "pairing" | "streaming" | "error";

export default function ClientPanel() {
  const searchParams = useSearchParams();
  const prefill = searchParams.get("code") ?? "";

  const [input, setInput] = useState(prefill);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState({ fps: 0, bitrateKbps: 0, width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stopPollingRef = useRef<(() => void) | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const runningRef = useRef(false);

  const cleanupPeer = useCallback(() => {
    stopPollingRef.current?.();
    stopPollingRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
  }, []);

  const setPhase = (s: Status, msg = "") => {
    setStatus(s);
    setError(msg);
  };

  // Cleanup saat unmount.
  useEffect(() => {
    return () => {
      runningRef.current = false;
      cleanupRef.current?.();
    };
  }, []);

  const join = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setPhase("joining");

    const publicIp = await getPublicIp();
    const res = await apiJoin(input.trim(), publicIp ?? undefined);
    if (!res.ok || !res.roomId) {
      runningRef.current = false;
      setPhase("error", res.error ?? "Gagal terhubung");
      return;
    }
    const rid = res.roomId;

    setPhase("pairing");
    const peer = createPeer();
    peerRef.current = peer;

    peer.onicecandidate = ({ candidate }) => {
      if (candidate) void apiPushIce(rid, "client", candidate);
    };
    peer.ontrack = (e) => {
      if (videoRef.current && e.streams[0]) {
        videoRef.current.srcObject = e.streams[0];
        setStatus("streaming");
        void apiConnected(rid, "client");
      }
    };
    peer.oniceconnectionstatechange = () => {
      if (peer.iceConnectionState === "failed") {
        setPhase("error", "Koneksi gagal — coba lagi");
      }
    };

    cleanupRef.current = cleanupPeer;

    // Polling: tunggu offer dari server, jawab, drain ICE.
    const stop = (() => {
      let done = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const loop = async () => {
        if (done || !runningRef.current) return;
        const room = await apiGetRoom(rid);
        if (room?.offer && peer.signalingState === "stable") {
          await peer.setRemoteDescription(JSON.parse(room.offer));
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          await apiPutRoom(rid, { answer: JSON.stringify(answer) });
        }
        const candidates = await apiDrainIce(rid, "server");
        for (const c of candidates) {
          if (c && (c as RTCIceCandidateInit).candidate)
            await peer.addIceCandidate(c as RTCIceCandidateInit);
        }
        if (peer.connectionState === "connected" || peer.iceConnectionState === "connected") {
          stopPolling();
          return;
        }
        timer = setTimeout(loop, 800);
      };
      const stopPolling = () => {
        done = true;
        if (timer) clearTimeout(timer);
      };
      loop();
      return stopPolling;
    })();
    stopPollingRef.current = stop;
  }, [input, cleanupPeer]);

  // Stats loop ketika streaming (inbound-rtp).
  useEffect(() => {
    if (status !== "streaming") return;
    let raf = 0;
    let lastTs = 0;
    let lastBytes = 0;
    const tick = async () => {
      const peer = peerRef.current;
      if (peer) {
        const s = await peer.getStats();
        let bytes = 0;
        let fps = 0;
        let w = 0;
        let h = 0;
        s.forEach((x) => {
          const r = x as RTCStats & {
            type: string;
            kind?: string;
            bytesReceived?: number;
            framesPerSecond?: number;
            frameWidth?: number;
            frameHeight?: number;
          };
          if (r.type === "inbound-rtp" && r.kind === "video") {
            if (r.bytesReceived) bytes = r.bytesReceived;
            if (r.framesPerSecond) fps = Math.round(r.framesPerSecond);
            if (r.frameWidth) w = r.frameWidth;
            if (r.frameHeight) h = r.frameHeight;
          }
        });
        const now = performance.now();
        const bitrate = lastTs
          ? ((bytes - lastBytes) * 8) / ((now - lastTs) / 1000) / 1000
          : 0;
        lastTs = now;
        lastBytes = bytes;
        setStats((prev) => ({
          fps: fps || prev.fps,
          width: w || prev.width,
          height: h || prev.height,
          bitrateKbps: bitrate > 0 ? bitrate : prev.bitrateKbps,
        }));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status]);

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const stopAll = () => {
    runningRef.current = false;
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setPhase("idle");
    setInput(prefill);
  };

  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-3">
        <h2 className="text-2xl font-semibold text-white">Jadi Client</h2>
        <p className="text-center text-sm text-zinc-400">
          Masukkan kode 6 digit dari perangkat yang membagikan layar.
        </p>
      </div>

      {status === "idle" && (
        <div className="flex flex-col items-center gap-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            className="w-56 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] text-white placeholder-zinc-600 outline-none focus:border-indigo-400"
          />
          <button
            type="button"
            onClick={() => void join()}
            disabled={input.length !== 6}
            className="rounded-xl bg-indigo-600 px-8 py-3 font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Hubungkan
          </button>
        </div>
      )}

      {status === "joining" && (
        <p className="text-sm text-zinc-400">Menghubungkan…</p>
      )}

      {status === "pairing" && (
        <p className="text-sm text-zinc-400">Menunggu perangkat sumber…</p>
      )}

      {status === "streaming" && (
        <div className="flex w-full flex-col gap-4">
          <div
            className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-xl border border-white/10 bg-black"
            style={{ cursor: zoom > 1 ? "grab" : "default" }}
          >
            <video
              ref={videoRef}
              className="h-auto w-full transition-transform duration-150"
              style={{ transform: `scale(${zoom})` }}
              autoPlay
              playsInline
              controls={false}
            />
            <StatsOverlay stats={stats} visible={showStats} />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-white/10"
            >
              Zoom −
            </button>
            <span className="px-2 text-sm text-zinc-400">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-white/10"
            >
              Zoom +
            </button>
            <button
              type="button"
              onClick={() => setShowStats((v) => !v)}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-white/10"
            >
              {showStats ? "Sembunyikan stats" : "Tampilkan stats"}
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-white/10"
            >
              {isFullscreen ? "Keluar layar penuh" : "Layar penuh"}
            </button>
          </div>

          <button
            type="button"
            onClick={stopAll}
            className="mx-auto rounded-xl border border-red-400/40 px-6 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/10"
          >
            Putuskan
          </button>
        </div>
      )}

      {status === "error" && (
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
          <p className="rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-300">{error}</p>
          <button
            type="button"
            onClick={stopAll}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10"
          >
            Kembali
          </button>
        </div>
      )}
    </div>
  );
}
