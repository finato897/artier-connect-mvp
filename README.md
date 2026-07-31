# Artier Connect

Screen mirroring antar-perangkat (Android, iPad, Android TV, HP) langsung lewat browser — tanpa install, tanpa login. Satu aplikasi web berperan sebagai **server** (sumber layar) dan **client** (layar target). Cukup masukkan kode 6 digit, streaming berjalan otomatis.

Dibangun dengan **Next.js** dan siap di-deploy ke **Vercel**.

## Cara Pakai

1. Buka aplikasi di **perangkat sumber** (mis. tablet Android) → pilih **Jadi Server** → pilih layar/tab yang dibagikan → dapat **kode 6 digit** + link/QR.
2. Buka aplikasi di **perangkat target** (mis. Android TV) → pilih **Jadi Client** → masukkan kode (atau scan QR / buka link) → otomatis tersambung.
3. Layar perangkat sumber tampil di perangkat target. Atur kualitas, zoom, atau layar penuh.

> **Syarat:** kedua perangkat harus terhubung ke **WiFi yang sama** — diperiksa otomatis saat client join.

## Fitur

- Mirroring **seluruh layar** atau **per tab** (pemilihan native `getDisplayMedia`)
- Kode sekali pakai **6 digit** + **link & QR pre-fill**
- **Preset kualitas**: Otomatis / HD / Seimbang / Hemat Data (ubah bitrate secara langsung)
- **Statistik live**: fps, bitrate, resolusi
- **Zoom** & **layar penuh** di sisi client
- Bahasa Indonesia, tanpa login

## Arsitektur

```
Device A (server)                  Device B (client)
   ├─ create → kode 6 digit            ├─ join {code}
   └─ polling ◄───────────────┐        └─ polling ─┐
                              ▼                    ▼
                      Upstash Redis (Vercel KV)   ◄── pasangan OTP → room
                              ▲                    ▲
   offer / answer ────────────┘                    └─ offer / answer
                              ▼
                     WebRTC P2P (getDisplayMedia → <video>)
```

- **Signaling**: HTTP polling + [Upstash Redis (Vercel KV)](https://vercel.com/docs/storage/vercel-kv). Stateless, aman di serverless Vercel, hemat kuota (polling berhenti setelah koneksi established).
- **Media**: WebRTC peer-to-peer, STUN `stun.l.google.com:19302`.
- **Same-WiFi check**: perbandingan public IP server vs client saat join.

## Development Lokal

Tanpa konfigurasi Redis, aplikasi memakai **in-memory fallback** sehingga langsung jalan:

```bash
npm install
npm run dev
# buka http://localhost:3000 — test dengan 2 tab (satu incognito)
```

Untuk memakai Redis sungguhan (opsional, untuk simulasi kondisi produksi):
set env `UPSTASH_REDIS_REST_URL` dan `UPSTASH_REDIS_REST_TOKEN`.

## Deploy ke Vercel

1. Push project ke GitHub.
2. Buat **Vercel KV store** (Hobby/gratis) di dashboard Vercel.
3. Tambahkan env `UPSTASH_REDIS_REST_URL` dan `UPSTASH_REDIS_REST_TOKEN` ke project (ambil dari halaman store Vercel KV → "Connect").
4. Import repo ke Vercel → deploy. Aplikasi otomatis terdeteksi sebagai Next.js.

## Keterbatasan & Future Work

- **Tanpa TURN**: koneksi lintas-NAT ketat bisa gagal. Pada LAN/WiFi sama (kasus target), host candidate cukup. Menambah TURN (mis. Cloudflare Calls) = future work.
- **Public IP sama ≈ same network**, bukan jaminan 100% (edge: dua jaringan dengan CGNAT sama).
- **Audio capture** via `getDisplayMedia` bergantung dukungan browser (Android Chrome sering tidak menyediakan audio layar).
- Serverless stateless: refresh halaman saat streaming → perlu reconnect.

## Struktur

```
src/
├── app/
│   ├── page.tsx              Landing page
│   ├── app/                  Halaman aplikasi (hub, server, client)
│   └── api/                  create, join, room, ice (signaling)
├── components/
│   ├── ServerPanel.tsx       Sisi sumber (sender WebRTC)
│   ├── ClientPanel.tsx       Sisi target (receiver + viewer)
│   ├── PairingCodes.tsx      Kode 6 digit + QR + link
│   └── StatsOverlay.tsx      Overlay stats live
└── lib/
    ├── redis.ts              Koneksi Redis + fallback in-memory
    ├── rooms.ts              Logic key/room, OTP, ICE drain
    ├── signal.ts             Protocol + helper polling client
    └── webrtc.ts             Preset kualitas, peer, stats
```
