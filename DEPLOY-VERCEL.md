# Deploy ke Vercel

Aplikasi ini adalah TanStack Start (SSR + server functions), jadi host harus menjalankan server — bukan hanya file statis. Build memakai Nitro, yang otomatis memilih preset sesuai platform. Target Vercel sudah dipin di `vite.config.ts` (aktif saat `VERCEL=1`, yang selalu diset oleh Vercel).

## Jalankan Vercel secara lokal

Gunakan Node.js **22+**. Dari PowerShell di folder project:

```powershell
npm ci
npm install --global vercel
vercel login
vercel link
vercel env pull .env.local
vercel dev
```

Pilih project dan environment **Development** saat diminta. `vercel dev` menjalankan aplikasi melalui Vercel CLI di `http://localhost:3000`; `.env.local` diabaikan Git oleh `.gitignore`. Jika environment lokal belum disetel di dashboard, isi variabel yang dibutuhkan di Vercel Project Settings terlebih dahulu. Untuk memeriksa output build Vercel tanpa membuat deployment, jalankan `vercel build`. Perintah `vercel` membuat Preview Deployment; `vercel --prod` menerbitkan Production Deployment.

Untuk `npm run dev` langsung, taruh server secret di `.env` atau `.env.local`, lalu restart Vite. `.env.example` hanya template dan tidak dibaca aplikasi; jangan isi dengan key sungguhan.

## 1. Hubungkan repository

Hubungkan repository GitHub langsung dari Vercel, atau deploy menggunakan Vercel CLI dari salinan lokal repository.

## 2. Impor project di Vercel

1. Buka vercel.com → **Add New → Project** → pilih repo.
2. Framework preset: biarkan **Other** (atau auto-detect). Build command: `npm run build`. Node.js version: **22**.
3. Output directory: tidak perlu diisi.

## 3. Environment variables

Set di Vercel (Project → Settings → Environment Variables):

| Nama | Keterangan |
|---|---|
| `VITE_SUPABASE_URL` | URL backend Supabase aktif (dipakai browser, saat build) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key backend Supabase aktif (dipakai browser, saat build) |
| `SUPABASE_URL` | URL backend Supabase yang sama (dipakai server functions) |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key backend yang sama (dipakai server functions) |
| `TMDB_API_KEY` | Opsional; jika diisi, selalu mengalahkan key admin (server secret) |
| `SUPABASE_SERVICE_ROLE_KEY` | Hanya untuk backend Supabase yang kamu kelola; dibutuhkan operasi privileged dan fallback key admin |
| `TMDB_SYNC_CRON_SECRET` | Opsional; bearer secret untuk endpoint sinkronisasi katalog terjadwal |

Contoh nama variabel ada di `.env.example`. Gunakan URL dan key dari project Supabase mandiri yang aktif; jangan gunakan kredensial dari backend lama.

**Penting:** `SUPABASE_SERVICE_ROLE_KEY` hanya boleh menjadi server environment variable (jangan gunakan prefix `VITE_`). Public TMDB requests tetap menampilkan data saat key ini tidak ada, tetapi penyimpanan `media_catalog` dilewati dan memberi warning server. Operasi admin/privileged, signed URL Storage, dan catalog sync tetap memerlukan service-role access.

Jika `.env` pernah masuk commit atau dibagikan, menambahkan aturan ignore tidak menghapus riwayatnya: cek repo dan rotasi credential privat yang terdampak. Jangan mengirim nilai secret lewat chat.

## TMDB key melalui admin

Alternatifnya, admin dapat menyimpan TMDB key dari **Admin → Appearance & SEO → TMDB API key**. Jalankan isi [migrasi SQL](./supabase/migrations/20261120135300_tmdb_api_key_admin.sql) satu kali di Supabase SQL Editor pada backend target sebelum memakai fitur ini (repo ini tidak menyertakan riwayat migrasi database sebelumnya). Nilai tersimpan tidak pernah dikirim kembali ke browser; jika `TMDB_API_KEY` di environment tersedia, nilainya selalu menang.

Fallback admin untuk request TMDB publik memerlukan `SUPABASE_SERVICE_ROLE_KEY` pada server. Jika tidak tersedia, gunakan `TMDB_API_KEY` environment. Atur service-role key hanya sebagai environment server rahasia.

## Watch Party terjadwal dan kapasitas

Untuk backend yang sudah memiliki tabel dan RPC Watch Party, jalankan [migrasi Watch Party](./supabase/migrations/20261120135400_watch_party_schedule_capacity.sql) satu kali di Supabase SQL Editor setelah schema Watch Party awal tersedia. Repo ini tidak menyertakan migrasi baseline database, jadi file ini bukan migrasi untuk database kosong. Fitur ini mengizinkan peserta masuk sebelum waktu mulai dan menunggu; kapasitas 2–50 menghitung anggota aktif dalam 120 detik terakhir, termasuk host.

## Favorites dan koleksi pribadi

Untuk menyimpan Favorites dan koleksi per akun, jalankan [migrasi Favorites dan Collections](./supabase/migrations/20261120143000_user_favorites_collections.sql) satu kali di Supabase SQL Editor setelah schema dasar Supabase tersedia. Tabel menggunakan RLS sehingga pengguna hanya dapat membaca dan mengubah data miliknya.

## 4. Update redirect sign-in

Setelah dapat URL Vercel (mis. `goldflix.vercel.app`), tambahkan URL itu ke daftar redirect yang diizinkan oleh konfigurasi autentikasi backend, lalu tes sign in / sign out di URL Vercel.

## 5. Verifikasi

- Buka halaman dalam (mis. `/movies`) langsung dan refresh — tidak boleh 404.
- Sign in dan sign out.
- Buka halaman yang di-render server dan picu satu server function.

Push ke branch yang dipakai Vercel otomatis memicu deploy baru.
