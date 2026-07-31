import Link from "next/link";

const FEATURES = [
  {
    title: "Seluruh Layar atau Per Tab",
    desc: "Pilih layar penuh, jendela, atau tab tertentu langsung dari dialog browser.",
    icon: "🖥️",
  },
  {
    title: "Tanpa Install & Tanpa Login",
    desc: "Cukup buka di browser. Server dan client adalah satu aplikasi web yang sama.",
    icon: "🌐",
  },
  {
    title: "Kode 6 Digit",
    desc: "Perangkat sumber mendapat kode sekali pakai. Perangkat target cukup memasukkannya.",
    icon: "🔢",
  },
  {
    title: "WiFi yang Sama",
    desc: "Koneksi peer-to-peer cepat di jaringan lokal Anda. Diperiksa otomatis saat terhubung.",
    icon: "📡",
  },
  {
    title: "Kualitas Bisa Disesuaikan",
    desc: "Preset Otomatis, HD, Seimbang, atau Hemat Data. Ubah bitrate kapan saja.",
    icon: "⚡",
  },
  {
    title: "Zoom & Statistik Live",
    desc: "Perbesar tampilan, layar penuh, serta pantau fps, bitrate, dan resolusi.",
    icon: "📊",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Hero */}
      <section className="flex flex-col items-center gap-6 px-6 py-20 text-center">
        <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Mirroring layar antar perangkat{" "}
          <span className="bg-gradient-to-r from-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">
            tanpa install
          </span>
        </h1>
        <p className="max-w-xl text-lg text-zinc-400">
          Android, iPad, Android TV — cukup buka Artier Connect di dua perangkat yang
          terhubung ke WiFi yang sama. Satu jadi sumber, satu jadi layar.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/app"
            className="rounded-xl bg-indigo-600 px-8 py-3 font-semibold text-white transition hover:bg-indigo-500"
          >
            Buka Aplikasi
          </Link>
          <a
            href="#cara-pakai"
            className="rounded-xl border border-white/15 px-8 py-3 font-semibold text-zinc-300 transition hover:bg-white/10"
          >
            Cara Pakai
          </a>
        </div>
      </section>

      {/* Cara pakai */}
      <section id="cara-pakai" className="px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 text-center text-2xl font-semibold">Cara Pakai</h2>
          <ol className="flex flex-col gap-6">
            {[
              ["Perangkat sumber", "Buka Artier Connect → pilih “Jadi Server” → pilih layar/tab yang dibagikan → dapat kode 6 digit."],
              ["Perangkat target", "Buka Artier Connect → pilih “Jadi Client” → masukkan kode 6 digit → otomatis tersambung."],
              ["Mulai menonton", "Layar perangkat sumber tampil di perangkat target. Atur kualitas, zoom, atau layar penuh sesuai kebutuhan."],
            ].map(([title, desc], i) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 font-bold">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-zinc-400">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Fitur */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-8 text-center text-2xl font-semibold">Fitur</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-5"
              >
                <div className="text-2xl">{f.icon}</div>
                <p className="mt-3 font-semibold">{f.title}</p>
                <p className="mt-1 text-sm text-zinc-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="flex flex-col items-center gap-4 px-6 py-20 text-center">
        <h2 className="max-w-xl text-3xl font-bold">Siap memulai?</h2>
        <Link
          href="/app"
          className="rounded-xl bg-indigo-600 px-8 py-3 font-semibold text-white transition hover:bg-indigo-500"
        >
          Buka Aplikasi
        </Link>
      </section>
    </div>
  );
}
