# Panduan Instalasi Layar Emas

Panduan ini mencakup instalasi lokal, Vercel, cPanel, VPS, aaPanel, dan konfigurasi Supabase.

> **Penting:** aplikasi ini menggunakan TanStack Start dengan SSR dan server functions. Aplikasi bukan situs statis; hosting harus dapat menjalankan server Node.js. Gunakan Node.js **22 atau lebih baru**.

## Daftar isi

- [1. Persiapan Supabase](#1-persiapan-supabase)
- [2. Environment variables](#2-environment-variables)
- [3. Menjalankan di komputer lokal](#3-menjalankan-di-komputer-lokal)
- [4. Deploy ke Vercel](#4-deploy-ke-vercel)
- [5. Deploy ke cPanel](#5-deploy-ke-cpanel)
- [6. Deploy ke VPS](#6-deploy-ke-vps)
- [7. Deploy ke aaPanel](#7-deploy-ke-aapanel)
- [8. Checklist setelah deploy](#8-checklist-setelah-deploy)
- [9. Troubleshooting](#9-troubleshooting)

## 1. Persiapan Supabase

### 1.1 Pilih backend

Aplikasi harus tersambung ke satu project Supabase mandiri yang sama untuk browser dan server.

Repository ini menyertakan baseline SQL untuk project Supabase **baru**: tabel inti, enum, RPC, trigger, RLS, dan bucket Storage. Jika kamu ingin database bersih, buat project Supabase baru dan terapkan rangkaian migrasi dari awal. Jangan jalankan baseline pada project yang sudah berisi schema/data; migrasi baseline bukan perintah reset dan tidak menghapus data.

### 1.2 Ambil URL dan API keys

Di Supabase Dashboard, buka **Project Settings → API** atau **API Keys**:

1. Salin **Project URL**.
2. Salin **Publishable key** (`sb_publishable_...`) atau anon key lama jika project masih menggunakannya.
3. Jika backend kamu kelola sendiri dan fitur privileged dibutuhkan, ambil **Secret key** (`sb_secret_...`) atau `service_role` key lama.

URL dan publishable key digunakan di browser. Secret/service-role key melewati RLS dan hanya boleh digunakan server. **Jangan pernah** menaruhnya di variabel `VITE_*`, mengirimkannya ke browser, atau commit nilainya.

### 1.3 Konfigurasi Authentication

Di **Authentication → URL Configuration**:

- **Site URL:** URL produksi, misalnya `https://film.example.com`.
- **Redirect URLs:** tambahkan URL yang benar-benar digunakan, contohnya:
  - `http://localhost:5173/**` untuk Vite lokal.
  - `http://127.0.0.1:5173/**` jika memakai alamat loopback tersebut.
  - `https://film.example.com/**` untuk domain produksi.
  - URL Vercel Preview yang digunakan tim, jika ada.

Pendaftaran mengirim email konfirmasi kembali ke origin aplikasi; reset password kembali ke `/reset-password`. Pastikan SMTP/email confirmation di Supabase sudah dikonfigurasi untuk penggunaan produksi. Pada schema dasar project ini, signup pertama dipromosikan menjadi admin oleh trigger `handle_new_user`; pastikan trigger dan tabel roles dari schema dasar tersedia sebelum signup pertama.

### 1.4 Terapkan schema dan migrasi

Untuk project baru, buka **SQL Editor** dan jalankan isi file berikut satu per satu, dalam urutan ini:

1. [Baseline database](./supabase/migrations/20261120120000_initial_schema.sql) — membuat schema inti, RPC, trigger signup pertama sebagai admin, RLS, serta bucket private `branding` dan `videos`.
2. [TMDB API key admin](./supabase/migrations/20261120135300_tmdb_api_key_admin.sql).
3. [Jadwal dan kapasitas Watch Party](./supabase/migrations/20261120135400_watch_party_schedule_capacity.sql).
4. [Favorites dan koleksi pribadi](./supabase/migrations/20261120143000_user_favorites_collections.sql).

Salin dan jalankan satu file per query di SQL Editor, tunggu sampai sukses sebelum melanjutkan. Jangan menjalankan ulang file yang sudah berhasil diterapkan; beberapa file bukan migrasi idempotent. Untuk database yang sudah digunakan, periksa schema dan migration history terlebih dahulu—jangan menimpa atau menghapus tabel untuk mengatasi error. Jangan menonaktifkan RLS.

### 1.5 TMDB dan Supabase Storage

1. Buat/ambil TMDB API key dari akun TMDB.
2. Simpan sebagai `TMDB_API_KEY` di environment **server** pada host.
3. Key TMDB yang pernah dibagikan atau masuk repository sebaiknya dirotasi.

TMDB key juga bisa disimpan melalui **Admin → Appearance & SEO → TMDB API key** setelah migrasi TMDB diterapkan. Mekanisme fallback admin memerlukan `SUPABASE_SERVICE_ROLE_KEY` di server. Jika backend tidak menyediakan service-role key, gunakan `TMDB_API_KEY` environment.

Baseline membuat bucket private `branding` dan `videos`. Setelah migrasi, buka **Storage → Policies** dan buat policy untuk `storage.objects` bagi role `authenticated`: izinkan operasi admin pada bucket `branding` dan `videos`, dengan kondisi `bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'::public.app_role)` atau `bucket_id = 'videos' AND public.has_role(auth.uid(), 'admin'::public.app_role)` pada **USING** dan **WITH CHECK**. Jangan jalankan `ALTER TABLE`/`GRANT` pada `storage.objects`; tabel ini dikelola Supabase dan policy dapat dibuat melalui Dashboard. Tambahkan server dengan base URL `storage://videos`; akses video saat playback tetap melalui signed URL server setelah pemeriksaan sumber. Jika memakai bucket lain, buat bucket private dan policy upload admin yang setara. Signed URL Storage dan sejumlah operasi privileged memerlukan `SUPABASE_SERVICE_ROLE_KEY` di server. Hanya masukkan video yang memang kamu miliki atau berlisensi untuk ditayangkan.

## 2. Environment variables

Buat `.env` lokal dari template [.env.example](./.env.example), lalu ganti semua placeholder dengan nilai dari project Supabase mandiri kamu.

```dotenv
# Browser: disisipkan saat build
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_PUBLIC_KEY

# Server: gunakan URL/key dari project yang sama
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_PUBLIC_KEY

# Server secrets
TMDB_API_KEY=YOUR_TMDB_API_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SECRET_KEY
TMDB_SYNC_CRON_SECRET=YOUR_RANDOM_CRON_SECRET

# Optional: Drizzle migrations only
DATABASE_URL=YOUR_POSTGRES_CONNECTION_STRING
```

| Variabel | Kapan diperlukan |
|---|---|
| `VITE_SUPABASE_URL` | Wajib untuk browser; nilainya harus tersedia ketika build. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Wajib untuk browser; publishable/anon key, bukan secret key. |
| `SUPABASE_URL` | Wajib untuk server functions. Gunakan project yang sama. |
| `SUPABASE_PUBLISHABLE_KEY` | Wajib untuk server functions yang memakai client publik/RLS. |
| `TMDB_API_KEY` | Direkomendasikan; server memakai ini untuk meminta metadata TMDB. |
| `SUPABASE_SERVICE_ROLE_KEY` | Opsional untuk sebagian tampilan publik; diperlukan untuk operasi privileged, penyimpanan katalog tertentu, Storage signing, dan fallback TMDB key admin. Hanya server. |
| `TMDB_SYNC_CRON_SECRET` | Opsional; bearer secret untuk endpoint sinkronisasi katalog terjadwal. |
| `DATABASE_URL` | Opsional; koneksi PostgreSQL yang dipakai Drizzle CLI saat menjalankan migrasi. |

`VITE_*` adalah nilai publik dan masuk ke bundle browser. Jangan pernah membuat `VITE_SUPABASE_SERVICE_ROLE_KEY` atau `VITE_TMDB_API_KEY`. Pada Vercel, isi variabel di Project Settings; pada cPanel/aaPanel isi melalui environment aplikasi; pada VPS gunakan environment file yang hanya bisa dibaca user service.

## 3. Menjalankan di komputer lokal

### 3.1 Persiapan dan konfigurasi

Pasang Git, Node.js 22+, dan npm. Clone repository, lalu jalankan dari PowerShell:

```powershell
git clone <URL_REPOSITORY>
Set-Location <FOLDER_REPOSITORY>
npm ci
Copy-Item .env.example .env
notepad .env
```

Isi `.env` dengan URL dan publishable key dari Supabase serta TMDB key. Jangan commit file `.env`.

### 3.2 Mode development

```powershell
npm run dev
```

Buka `http://localhost:5173`. Vite membaca `.env`; setelah mengubah nilainya, restart server development.

### 3.3 Uji server Node produksi secara lokal

Build standar project bisa memilih preset Cloudflare. Untuk menguji server Node seperti yang dipakai VPS/cPanel/aaPanel, pilih preset Node secara eksplisit:

```powershell
$env:NITRO_PRESET = "node-server"
Remove-Item Env:VERCEL -ErrorAction SilentlyContinue
npm run build
```

`VITE_*` harus tersedia ketika build. Server Node yang sudah dibuild tidak membaca `.env` secara otomatis; isi variabel server di proses terminal sebelum menjalankannya:

```powershell
$env:SUPABASE_URL = "https://YOUR_PROJECT_REF.supabase.co"
$env:SUPABASE_PUBLISHABLE_KEY = "sb_publishable_YOUR_PUBLIC_KEY"
$env:TMDB_API_KEY = "YOUR_TMDB_API_KEY"
$env:SUPABASE_SERVICE_ROLE_KEY = "YOUR_SERVER_ONLY_SECRET_KEY"
$env:HOST = "127.0.0.1"
$env:PORT = "3000"
node .output/server/index.mjs
```

Untuk stop, tekan `Ctrl+C`. Jangan mengisi service-role key pada browser atau memasukkannya ke nilai `VITE_*`.

## 4. Deploy ke Vercel

### 4.1 Hubungkan repository

1. Push repository ke GitHub.
2. Di Vercel pilih **Add New → Project**, lalu import repository.
3. Framework preset: **Other** atau auto-detect.
4. Build command: `npm run build`.
5. Tidak perlu mengisi Output Directory.

Vercel mengatur `VERCEL` untuk build. [vite.config.ts](./vite.config.ts) memilih preset Vercel secara otomatis; jangan set `NITRO_PRESET=node-server` pada project Vercel.

### 4.2 Environment variables Vercel

Di **Project → Settings → Environment Variables**, tambahkan variabel dari [bagian 2](#2-environment-variables):

- Tambahkan `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY` untuk environment yang akan dibuild: Production, Preview, dan/atau Development.
- Tambahkan `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `TMDB_API_KEY`, dan—jika backend yang dikelola sendiri membutuhkannya—`SUPABASE_SERVICE_ROLE_KEY` sebagai server environment variables.
- Pilih environment yang tepat untuk setiap variabel, lalu redeploy setelah mengubahnya.

Tambahkan domain produksi ke Supabase **Authentication → URL Configuration**. Untuk URL Preview, tambahkan domain yang memang dipakai dan diizinkan.

### 4.3 Tes Vercel secara lokal

```powershell
npm install --global vercel
vercel login
vercel link
vercel env pull .env.local
vercel dev
```

`vercel dev` biasanya berjalan di `http://localhost:3000`. Petunjuk tambahan tersedia di [DEPLOY-VERCEL.md](./DEPLOY-VERCEL.md).

## 5. Deploy ke cPanel

### 5.1 Pastikan paket hosting mendukung Node

Sebelum membeli atau deploy, konfirmasi ke provider bahwa paket menyediakan:

- Node.js **22+** (atau versi yang dapat menjalankan dependency project).
- **Setup Node.js App / Node.js Selector / Application Manager** yang mendukung proses Node persisten.
- Environment variables untuk aplikasi.
- Domain/subdomain HTTPS dan proxy ke aplikasi Node.

Shared hosting yang hanya melayani file PHP/static, atau yang menghentikan proses Node, **tidak dapat menjalankan aplikasi SSR ini**. Gunakan VPS atau Vercel jika provider tidak menyediakan Node app.

### 5.2 Build untuk Node server

Build di server cPanel melalui Terminal/SSH jika tersedia, atau build di lingkungan Linux Node 22 lalu unggah folder `.output` lengkap. Untuk build di Linux:

```bash
npm ci
NITRO_PRESET=node-server npm run build
```

Pastikan hasil `.output/nitro.json` menunjukkan preset `node-server`, bukan `cloudflare-module` atau `vercel`.

Jika build di Windows, isi `VITE_*` di `.env`, lalu:

```powershell
$env:NITRO_PRESET = "node-server"
Remove-Item Env:VERCEL -ErrorAction SilentlyContinue
npm ci
npm run build
```

Upload folder `.output` lengkap (termasuk `server` dan `public`) ke server. Simpan project di application root di luar folder publik jika panel memungkinkan.

### 5.3 Buat Node application

Di cPanel buka **Software → Setup Node.js App** atau **Application Manager** (nama menu tergantung provider):

1. Buat aplikasi baru dengan Node.js 22+.
2. Pilih environment **Production**.
3. Set Application Root ke folder aplikasi.
4. Set Startup File ke `.output/server/index.mjs`.
5. Tambahkan environment variables server: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `TMDB_API_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY` bila digunakan.
6. Jangan set `VITE_*` hanya saat runtime: nilai tersebut harus sudah disediakan ketika build.
7. Restart aplikasi dari panel.

Jika panel mengharuskan startup file berada di root aplikasi, buat file `app.mjs` di application root dengan isi:

```js
import "./.output/server/index.mjs";
```

Lalu pilih `app.mjs` sebagai Startup File. Gunakan port yang disediakan Node app manager/Passenger; jangan menjalankan server kedua pada port yang sama.

Tambahkan domain/subdomain ke aplikasi melalui panel. Pastikan request diteruskan ke proses Node dan HTTPS aktif. Untuk refresh URL dalam seperti `/movies` atau `/movie/123`, request harus sampai ke SSR Node app—jangan hanya memakai static rewrite ke `index.html`.

## 6. Deploy ke VPS

Contoh berikut untuk Ubuntu/Debian dengan systemd dan Nginx. Sesuaikan domain, folder, nama service, dan user dengan server kamu.

### 6.1 Pasang Node.js dan Nginx

Pasang Node.js 22+ dari sumber paket resmi yang kamu pilih. Verifikasi:

```bash
node --version
npm --version
```

Pasang Nginx dan buat user/folder aplikasi, contoh:

```bash
sudo apt update
sudo apt install -y nginx git
sudo useradd --system --create-home --shell /usr/sbin/nologin layar
sudo mkdir -p /opt/layaremas
sudo chown -R layar:layar /opt/layaremas
```

### 6.2 Ambil source dan build

```bash
sudo -u layar git clone <URL_REPOSITORY> /opt/layaremas
cd /opt/layaremas
npm ci
```

Sediakan `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY` saat build. Simpan `.env` yang dipakai build dengan permission terbatas dan jangan masukkan file itu ke Git. Build preset Node:

```bash
unset VERCEL
export VITE_SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
export VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_YOUR_PUBLIC_KEY"
NITRO_PRESET=node-server npm run build
```

### 6.3 Environment runtime yang aman

Buat file environment di luar document root:

```bash
sudo install -m 600 -o root -g root /dev/null /etc/layaremas.env
sudo nano /etc/layaremas.env
```

Isi dengan format berikut. Jangan tambahkan `export`:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_PUBLIC_KEY
TMDB_API_KEY=YOUR_TMDB_API_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SECRET_KEY
```

Service account aplikasi hanya perlu membaca file ini melalui systemd. Jangan taruh secret di folder `public`, `.output/public`, atau variabel `VITE_*`.

### 6.4 Buat systemd service

Buat `/etc/systemd/system/layaremas.service`:

```ini
[Unit]
Description=Layar Emas TanStack Start
After=network.target

[Service]
Type=simple
User=layar
Group=layar
WorkingDirectory=/opt/layaremas
EnvironmentFile=/etc/layaremas.env
Environment=HOST=127.0.0.1
Environment=PORT=3000
ExecStart=/usr/bin/node /opt/layaremas/.output/server/index.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Pastikan path Node benar dengan `which node`; ganti `/usr/bin/node` jika instalasi Node berada di path lain. Lalu:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now layaremas
sudo systemctl status layaremas
```

Log:

```bash
sudo journalctl -u layaremas -n 100 --no-pager
```

Setelah setiap deploy/build baru:

```bash
sudo systemctl restart layaremas
```

### 6.5 Reverse proxy Nginx dan HTTPS

Buat konfigurasi site Nginx untuk domain:

```nginx
server {
    listen 80;
    server_name film.example.com www.film.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Aktifkan konfigurasi, tes (`sudo nginx -t`), lalu reload Nginx. Buka port 80/443 pada firewall dan aktifkan sertifikat TLS, misalnya dengan Certbot. Di Supabase Authentication, set Site URL ke `https://film.example.com` dan izinkan origin tersebut.

## 7. Deploy ke aaPanel

aaPanel dan plugin Node dapat berbeda antarversi. Pilih mode **Node app / reverse proxy**, bukan **Static website**.

1. Di **App Store**, pasang Node.js manager/Node Project Manager yang disediakan versi aaPanel kamu.
2. Pasang Node.js 22+ dan verifikasi versi di Terminal.
3. Clone/upload source ke folder project di luar web root bila memungkinkan.
4. Sediakan `VITE_*` saat build, lalu jalankan:

   ```bash
   npm ci
   unset VERCEL
   NITRO_PRESET=node-server npm run build
   ```

5. Di Node Project Manager buat project dengan:
   - Project path: folder repository.
   - Startup file/command: `.output/server/index.mjs` atau `node .output/server/index.mjs`.
   - Node version: 22+.
   - Port: `3000` (atau port bebas yang kamu pilih).
   - Host: `127.0.0.1` jika aaPanel membuat reverse proxy lokal.
   - Environment runtime: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `TMDB_API_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY` bila digunakan.
6. Start/restart project dan pastikan status proses aktif.
7. Di **Website**, tambahkan domain, set **Reverse Proxy** ke `http://127.0.0.1:3000`, lalu aktifkan SSL.
8. Di Supabase Authentication, tambahkan domain HTTPS ke Site URL dan Redirect URLs.

Jika plugin aaPanel tidak menerima file `.mjs` atau path startup bertingkat, buat `app.mjs` di root project dengan `import "./.output/server/index.mjs";`, lalu jadikan itu startup file. Pastikan plugin benar-benar meneruskan port ke proses Node, bukan hanya menyalin `.output/public`.

## 8. Checklist setelah deploy

- [ ] Homepage terbuka dan refresh langsung pada `/movies`, `/networks`, dan halaman detail tidak menghasilkan 404.
- [ ] Supabase URL dan publishable key cocok dengan project yang dipakai.
- [ ] Register, email confirmation, sign in, reset password, dan sign out berhasil.
- [ ] Redirect URL domain lokal/produksi sudah diizinkan di Supabase.
- [ ] TMDB key berada di server dan metadata dapat dimuat.
- [ ] RLS aktif; pengguna hanya dapat membaca/menulis data yang memang diizinkan.
- [ ] Tombol Favorites/koleksi dan Watch Party berhasil setelah migrasi terkait diterapkan.
- [ ] Video private Storage diuji hanya jika service-role key, bucket, policy, dan server video yang diperlukan sudah dikonfigurasi.
- [ ] HTTPS aktif; tidak ada secret di source, browser bundle, Git, atau log publik.

## 9. Troubleshooting

| Gejala | Yang perlu diperiksa |
|---|---|
| `Missing Supabase environment variable(s)` | Bedakan variabel browser `VITE_*` dan variabel server. Cek nama, URL, value, lalu build ulang jika mengubah `VITE_*`. |
| Halaman tampil tetapi metadata TMDB kosong | Pastikan `TMDB_API_KEY` valid dan tersedia saat fungsi server berjalan. Restart/redeploy setelah mengubah secret. |
| Warning `SUPABASE_SERVICE_ROLE_KEY` | Sebagian operasi privileged, fallback TMDB admin, katalog, dan private Storage memang membutuhkannya. Gunakan secret key hanya di server yang kamu kelola; jangan menaruhnya di browser. |
| Login/register kembali gagal setelah deploy | Cek Supabase Authentication Site URL, Redirect URLs, email confirmation, dan HTTPS/domain yang benar. |
| Vercel gagal memilih runtime | Biarkan `VERCEL` disediakan Vercel dan build dengan `npm run build`; jangan paksa preset `node-server` pada project Vercel. |
| VPS/cPanel/aaPanel menampilkan 502/503 | Cek status proses Node, log aplikasi, Node 22+, port yang disediakan, dan target reverse proxy. |
| Build Node menghasilkan `cloudflare-module` | Build ulang dengan `NITRO_PRESET=node-server` dan pastikan `VERCEL` tidak tersetel. |
| File detail bekerja lewat klik tetapi 404 saat refresh | Pastikan semua request domain diteruskan ke SSR Node server. Jangan host hanya folder `.output/public`. |
| Favorites/koleksi/Watch Party mendapat error database | Pastikan baseline dan migrasi fitur diterapkan satu kali dalam urutan yang tercantum di bagian 1.4. |

