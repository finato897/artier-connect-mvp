import Link from "next/link";

export default function AppHub() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-20">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Perangkat ini mau jadi apa?</h1>
        <p className="mt-2 text-zinc-400">
          Satu aplikasi untuk dua peran. Pastikan kedua perangkat di WiFi yang sama.
        </p>
      </div>

      <div className="grid w-full max-w-2xl gap-4 sm:grid-cols-2">
        <Link
          href="/app/server"
          className="group flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-8 transition hover:border-indigo-400/50 hover:bg-white/10"
        >
          <span className="text-4xl">📤</span>
          <span className="text-xl font-semibold group-hover:text-indigo-300">
            Jadi Server
          </span>
          <span className="text-center text-sm text-zinc-400">
            Perangkat ini membagikan layar ke perangkat lain.
          </span>
        </Link>

        <Link
          href="/app/client"
          className="group flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-8 transition hover:border-indigo-400/50 hover:bg-white/10"
        >
          <span className="text-4xl">📺</span>
          <span className="text-xl font-semibold group-hover:text-indigo-300">
            Jadi Client
          </span>
          <span className="text-center text-sm text-zinc-400">
            Perangkat ini menampilkan layar dari perangkat sumber.
          </span>
        </Link>
      </div>
    </div>
  );
}
