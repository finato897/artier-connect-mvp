"use client";

import { QRCodeSVG } from "qrcode.react";

interface Props {
  code: string;
}

export default function PairingCodes({ code }: Props) {
  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/app/client?code=${code}`
      : `/app/client?code=${code}`;
  const qrValue = link;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Clipboard tidak tersedia — abaikan.
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="text-center">
        <p className="text-sm text-zinc-400">
          Buka aplikasi di perangkat target, lalu masukkan kode ini
        </p>
        <p className="mt-2 font-mono text-5xl font-bold tracking-[0.4em] text-white">
          {code}
        </p>
      </div>

      <div className="rounded-xl bg-white p-3">
        <QRCodeSVG value={qrValue} size={160} level="M" />
      </div>

      <button
        type="button"
        onClick={copyLink}
        className="rounded-lg border border-white/15 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10"
      >
        Salin link
      </button>
    </div>
  );
}
