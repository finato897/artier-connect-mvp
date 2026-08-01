"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PairingCodes from "./PairingCodes";
import {
  apiCreate,
  apiGetRoom,
  apiPutRoom,
  apiPushIce,
  apiDrainIce,
  apiConnected,
  apiLeave,
  getPublicIp,
} from "@/lib/signal";
import {
  createPeer,
  applyPresetToSender,
  trackConstraints,
  type QualityPreset,
} from "@/lib/webrtc";

type Status =
  | "idle"
  | "creating"
  | "waiting"
  | "capturing"
  | "pairing"
  | "streaming"
  | "error";

export default function ServerPanel() {
  const [status, setStatus] = useState<Status>("idle");
  const [code, setCode] = useState("");
  const [roomId, setRoomId] = useState("");
  const [error, setError] = useState("");
  const [preset, setPreset] = useState<QualityPreset>("auto");
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState({ fps: 0, bitrateKbps: 0, width: 0, height: 0 });

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const senderRef = useRef<RTCRtpSender | null>(null);
  const captureUnsafeRef = useRef(false);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const stopPollingRef = useRef<(() => void) | null>(null);
  const stoppedRef = useRef(false);
  const roomIdRef = useRef("");

  const cleanupPeer = useCallback(() => {
    stopPollingRef.current?.();
    stopPollingRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    senderRef.current = null;
  }, []);

  // Cleanup saat unmount + keluar aplikasi → hapus sesi.
  useEffect(() => {
    const leave = () => {
      stoppedRef.current = true;
      cleanupPeer();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      // Keluar browser/tab: hapus room agar kode tidak hidup selamanya.
      if (roomIdRef.current) void apiLeave(roomIdRef.current);
    };
    const unload = () => {
      if (roomIdRef.current) {
        // sendBeacon lebih andal saat unload daripada fetch.
        try {
          navigator.sendBeacon?.(
            "/api/leave",
            new Blob([JSON.stringify({ roomId: roomIdRef.current })], {
              type: "application/json",
            })
          );
        } catch {
          void apiLeave(roomIdRef.current);
        }
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => {
      window.removeEventListener("beforeunload", unload);
      leave();
    };
  }, [cleanupPeer]);

  const setRoomIdBoth = (v: string) => {
    roomIdRef.current = v;
    setRoomId(v);
  };

  const setPhase = (s: Status, msg = "") => {
    setStatus(s);
    setError(msg);
  };

  const beginStreaming = useCallback(
    async (rid: string) => {
      setPhase("capturing");
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: trackConstraints(preset),
          audio: true,
        });
        streamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const peer = createPeer();
        peerRef.current = peer;
        stream.getTracks().forEach((t) => peer.addTrack(t, stream));
        senderRef.current = peer.getSenders().find((s) => s.track?.kind === "video") ?? null;

        peer.onicecandidate = ({ candidate }) => {
          if (candidate) void apiPushIce(rid, "server", candidate);
        };
        peer.oniceconnectionstatechange = () => {
          const st = peer.iceConnectionState;
          if (st === "connected" || st === "completed") {
            void apiConnected(rid, "server");
            setPhase("streaming");
          } else if (st === "failed") {
            setPhase("error", "Koneksi gagal — coba lagi");
          }
        };
        // Jika user stop share (track ended), tutup sesi.
        stream.getVideoTracks()[0]?.addEventListener("ended", () => {
          cleanupPeer();
          streamRef.current?.getTracks().forEach((t) => t.stop());
          setPhase("idle");
        });

        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        await apiPutRoom(rid, { offer: JSON.stringify(offer) });

        // Polling jawaban + ICE drain.
        setPhase("pairing");
        let answered = false;
        const stop = (() => {
          let done = false;
          let timer: ReturnType<typeof setTimeout> | null = null;
          const loop = async () => {
            if (done || stoppedRef.current || !peerRef.current) return;
            const room = await apiGetRoom(rid);
            if (room?.answer && !answered) {
              answered = true;
              await peer.setRemoteDescription(JSON.parse(room.answer));
              if (room.state === "connected") {
                stopPolling();
                setPhase("streaming");
                return;
              }
            }
            const candidates = await apiDrainIce(rid, "client");
            for (const c of candidates) {
              if (c && (c as RTCIceCandidateInit).candidate)
                await peer.addIceCandidate(c as RTCIceCandidateInit);
            }
            if (peer.iceConnectionState === "connected") {
              stopPolling();
              setPhase("streaming");
              return;
            }
            timer = setTimeout(loop, 800);
          };
          const stopPolling = () => {
            done = true;
            if (timer) clearTimeout(timer);
          };
          void loop();
          return stopPolling;
        })();
        stopPollingRef.current = stop;
      } catch (e) {
        setPhase("error", "Gagal membagikan layar: " + String(e));
      }
    },
    [cleanupPeer, preset]
  );

  const start = useCallback(async () => {
    setPhase("creating");
    const publicIp = await getPublicIp();
    const created = await apiCreate(publicIp ?? undefined);
    if (!created.ok || !created.code || !created.roomId) {
      setPhase("error", created.error ?? "Gagal membuat sesi");
      return;
    }
    const rid = created.roomId;
    setCode(created.code);
    setRoomIdBoth(rid);
    setPhase("waiting");

    // Polling: tunggu client join, lalu mulai capture & signaling.
    const stop = (() => {
      let done = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      // Kode 404 dianggap sesi benar-benar berakhir; error lain (network/cold
      // start) ditahan beberapa kali agar serverless yang warming tidak
      // langsung memutus sesi.
      let consecutiveMisses = 0;
      const loop = async () => {
        if (done || stoppedRef.current) return;
        const res = await fetch(`/api/room?roomId=${encodeURIComponent(rid)}`);
        if (!res.ok) {
          if (res.status === 404) {
            setPhase("error", "Sesi berakhir");
            return;
          }
          consecutiveMisses++;
          if (consecutiveMisses >= 5) {
            setPhase("error", "Gagal terhubung ke server sesi");
            return;
          }
          timer = setTimeout(loop, 1000);
          return;
        }
        consecutiveMisses = 0;
        const room = await res.json();
        if (room.joined && !captureUnsafeRef.current) {
          captureUnsafeRef.current = true;
          stopPolling();
          beginStreaming(rid);
          return;
        }
        if (room.state === "closed") {
          setPhase("error", "Sesi ditutup");
          return;
        }
        timer = setTimeout(loop, 800);
      };
      const stopPolling = () => {
        done = true;
        if (timer) clearTimeout(timer);
      };
      void loop();
      return stopPolling;
    })();
    stopPollingRef.current = stop;
  }, [beginStreaming]);

  // Loop stats ketika streaming (sisi server membaca outbound-rtp).
  useEffect(() => {
    if (status !== "streaming") return;
    let raf = 0;
    let lastTs = 0;
    let lastBytes = 0;
    const tick = async () => {
      const peer = peerRef.current;
      if (peer && (showStats || true)) {
        const s = await peer.getStats();
        let bytes = 0;
        s.forEach((x) => {
          const r = x as RTCStats & { type: string; kind?: string; bytesSent?: number };
          if (r.type === "outbound-rtp" && r.kind === "video" && r.bytesSent) bytes = r.bytesSent;
        });
        const now = performance.now();
        const bitrate = lastTs
          ? ((bytes - lastBytes) * 8) / ((now - lastTs) / 1000) / 1000
          : 0;
        lastTs = now;
        lastBytes = bytes;
        setStats((prev) => ({
          ...prev,
          bitrateKbps: bitrate > 0 ? bitrate : prev.bitrateKbps,
        }));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status, showStats]);

  const changePreset = async (p: QualityPreset) => {
    setPreset(p);
    await applyPresetToSender(senderRef.current ?? undefined, p);
  };

  const stopAll = () => {
    stoppedRef.current = false;
    cleanupPeer();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCode("");
    setRoomIdBoth("");
    setPhase("idle");
  };

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col items-center gap-3">
        <h2 className="text-2xl font-semibold text-white">Jadi Server</h2>
        <p className="text-center text-sm text-zinc-400">
          Bagikan layar perangkat ini. Perangkat target akan menampilkannya.
        </p>
      </div>

      {status === "idle" && (
        <button
          type="button"
          onClick={start}
          className="mx-auto rounded-xl bg-indigo-600 px-8 py-3 font-semibold text-white transition hover:bg-indigo-500"
        >
          Mulai Bagikan
        </button>
      )}

      {status === "creating" && (
        <p className="text-center text-sm text-zinc-400">Membuat sesi…</p>
      )}

      {(status === "waiting" || status === "capturing" || status === "pairing") && code && roomId && (
        <div className="flex flex-col items-center gap-6">
          <PairingCodes code={code} />
          <p className="text-center text-sm text-zinc-400">
            {status === "waiting" && "Menunggu perangkat target terhubung…"}
            {status === "capturing" && "Pilih layar/tab untuk dibagikan…"}
            {status === "pairing" && "Menghubungkan…"}
          </p>
        </div>
      )}

      {status === "streaming" && (
        <div className="flex flex-col gap-4">
          <div className="relative mx-auto w-full max-w-xl overflow-hidden rounded-xl border border-white/10 bg-black">
            <video
              ref={localVideoRef}
              className="h-auto w-full"
              autoPlay
              muted
              playsInline
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {(["auto", "hd", "balanced", "data"] as QualityPreset[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => void changePreset(p)}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  preset === p
                    ? "bg-indigo-600 text-white"
                    : "border border-white/15 text-zinc-300 hover:bg-white/10"
                }`}
              >
                {p === "auto" ? "Otomatis" : p === "hd" ? "HD" : p === "balanced" ? "Seimbang" : "Hemat Data"}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowStats((v) => !v)}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-white/10"
            >
              {showStats ? "Sembunyikan stats" : "Tampilkan stats"}
            </button>
          </div>

          {showStats && (
            <p className="text-center font-mono text-xs text-emerald-300">
              {stats.fps} fps · {stats.bitrateKbps ? `${Math.round(stats.bitrateKbps)} kbps` : "— kbps"} ·{" "}
              {stats.width}×{stats.height}
            </p>
          )}

          <button
            type="button"
            onClick={stopAll}
            className="mx-auto rounded-xl border border-red-400/40 px-6 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/10"
          >
            Hentikan
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
