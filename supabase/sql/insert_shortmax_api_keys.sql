-- Jalankan di Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- Insert API key ShortMax langsung ke tabel public.shortmax_api_keys
-- Pastikan kamu login sebagai user dengan role admin atau gunakan SQL Editor (bypass RLS)

-- Contoh insert satu key
insert into public.shortmax_api_keys (name, api_key, is_active)
values
  ('ShortMax Key 1', 'vbs_GANTI_DENGAN_KEY_KAMU', true);

-- Insert banyak key sekaligus (copy dan tambahkan key kamu di sini)
insert into public.shortmax_api_keys (name, api_key, is_active)
values
  ('ShortMax Key 1', 'vbs_GANTI_DENGAN_KEY_KAMU', true),
  ('ShortMax Key 2', 'vbs_YOUR_KEY_2', true),
  ('ShortMax Key 3', 'vbs_YOUR_KEY_3', true),
  ('ShortMax Key 4', 'vbs_YOUR_KEY_4', true),
  ('ShortMax Key 5', 'vbs_YOUR_KEY_5', true);

-- Cek semua key yang sudah masuk
select id, name, api_key, is_active, requests_today, request_date, created_at
from public.shortmax_api_keys
order by created_at desc;

-- Nonaktifkan key tertentu (ganti id dengan uuid yang sesuai)
-- update public.shortmax_api_keys set is_active = false where id = 'uuid-key-ini';

-- Hapus key tertentu
-- delete from public.shortmax_api_keys where id = 'uuid-key-ini';
