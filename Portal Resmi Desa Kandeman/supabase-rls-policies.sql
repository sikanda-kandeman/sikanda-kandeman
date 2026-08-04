-- SIKANDA — Supabase Row Level Security
-- Jalankan melalui Supabase SQL Editor sebagai pemilik proyek.
--
-- Tabel di bawah berasal dari pemanggilan sb.from(...) yang benar-benar ditemukan
-- pada index/admin: agenda, apbdes, aspirasi, berita, dokumen, galeri,
-- jadwal_kesehatan, kontak_kesehatan, perangkat, potensi, prestasi, statistik,
-- umkm, dan profiles. Bucket Storage yang ditemukan: galeri-desa.
--
-- PENTING: tinjau data lama sebelum mengubah aktif=false menjadi true. Baris yang
-- belum ditinjau sengaja tidak langsung dipublikasikan oleh migrasi ini.

begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null default 'viewer' check (role in ('admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

-- Fungsi SECURITY DEFINER mencegah rekursi policy profiles. Fungsi ditempatkan
-- di schema private (tidak diekspos Data API), bukan public.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

drop policy if exists "profiles_read_own" on public.profiles;
create policy "profiles_read_own"
on public.profiles for select
to authenticated
using (id = (select auth.uid()));

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all"
on public.profiles for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

revoke all on public.profiles from anon;
grant select, insert, update, delete on public.profiles to authenticated;

-- Tambahkan kolom publikasi hanya pada tabel yang memang sudah ada. Skema tabel
-- tidak dibuat di sini agar tipe/kolom bisnis tidak ditebak. NOTICE akan muncul
-- bila sebuah tabel yang direferensikan frontend belum dibuat.
do $migration$
declare
  table_name text;
  content_tables constant text[] := array[
    'agenda', 'apbdes', 'berita', 'dokumen', 'galeri',
    'jadwal_kesehatan', 'kontak_kesehatan', 'perangkat', 'potensi',
    'prestasi', 'statistik', 'umkm'
  ];
begin
  foreach table_name in array content_tables loop
    if to_regclass(format('public.%I', table_name)) is null then
      raise notice 'Tabel public.% belum ada; policy dilewati.', table_name;
      continue;
    end if;

    execute format(
      'alter table public.%I add column if not exists aktif boolean not null default false',
      table_name
    );
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);

    execute format('drop policy if exists %I on public.%I',
      'public_read_published_' || table_name, table_name);
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (aktif is true)',
      'public_read_published_' || table_name, table_name
    );

    execute format('drop policy if exists %I on public.%I',
      'admin_manage_' || table_name, table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))',
      'admin_manage_' || table_name, table_name
    );

    execute format('revoke all on public.%I from anon', table_name);
    execute format('grant select on public.%I to anon', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
  end loop;
end
$migration$;

-- Kolom ini dibaca oleh seluruh ringkasan statistik publik. Penambahan dilakukan
-- hanya bila tabel statistik sudah tersedia; nilai lama tetap NULL dan akan
-- ditampilkan sebagai tanda pisah sampai admin mengisi data resmi.
do $statistics$
begin
  if to_regclass('public.statistik') is not null then
    alter table public.statistik
      add column if not exists luas_wilayah_ha numeric,
      add column if not exists total_rt integer,
      add column if not exists total_rw integer;

    if not exists (
      select 1 from pg_constraint
      where conname = 'statistik_luas_wilayah_nonnegative'
        and conrelid = 'public.statistik'::regclass
    ) then
      alter table public.statistik add constraint statistik_luas_wilayah_nonnegative
        check (luas_wilayah_ha is null or luas_wilayah_ha >= 0) not valid;
    end if;
    if not exists (
      select 1 from pg_constraint
      where conname = 'statistik_rt_rw_nonnegative'
        and conrelid = 'public.statistik'::regclass
    ) then
      alter table public.statistik add constraint statistik_rt_rw_nonnegative
        check ((total_rt is null or total_rt >= 0) and (total_rw is null or total_rw >= 0)) not valid;
    end if;
    if not exists (
      select 1 from pg_constraint
      where conname = 'statistik_gender_consistent'
        and conrelid = 'public.statistik'::regclass
    ) then
      alter table public.statistik add constraint statistik_gender_consistent
        check (total_penduduk = coalesce(total_laki, 0) + coalesce(total_perempuan, 0)) not valid;
    end if;
    if not exists (
      select 1 from pg_constraint
      where conname = 'statistik_age_groups_consistent'
        and conrelid = 'public.statistik'::regclass
    ) then
      alter table public.statistik add constraint statistik_age_groups_consistent check (
        total_penduduk =
          coalesce(umur_0_9_l, 0) + coalesce(umur_0_9_p, 0) +
          coalesce(umur_10_19_l, 0) + coalesce(umur_10_19_p, 0) +
          coalesce(umur_20_29_l, 0) + coalesce(umur_20_29_p, 0) +
          coalesce(umur_30_44_l, 0) + coalesce(umur_30_44_p, 0) +
          coalesce(umur_45_59_l, 0) + coalesce(umur_45_59_p, 0) +
          coalesce(umur_60plus_l, 0) + coalesce(umur_60plus_p, 0)
      ) not valid;
    end if;
    if not exists (
      select 1 from pg_constraint
      where conname = 'statistik_education_percent_consistent'
        and conrelid = 'public.statistik'::regclass
    ) then
      alter table public.statistik add constraint statistik_education_percent_consistent check (
        abs(
          coalesce(didik_sd, 0) + coalesce(didik_smp, 0) +
          coalesce(didik_sma, 0) + coalesce(didik_tinggi, 0) - 100
        ) <= 0.05
      ) not valid;
    end if;
  end if;
end
$statistics$;

-- Pertahankan konsistensi APBDes juga di database. NOT VALID tidak menghapus
-- data lama, tetapi INSERT/UPDATE berikutnya wajib memenuhi aturan ini.
do $apbdes_validation$
begin
  if to_regclass('public.apbdes') is not null then
    if not exists (
      select 1 from pg_constraint
      where conname = 'apbdes_allocation_percent_consistent'
        and conrelid = 'public.apbdes'::regclass
    ) then
      alter table public.apbdes add constraint apbdes_allocation_percent_consistent check (
        pct_pemerintahan between 0 and 100 and
        pct_pembangunan between 0 and 100 and
        pct_pembinaan between 0 and 100 and
        pct_pemberdayaan between 0 and 100 and
        pct_pemerintahan + pct_pembangunan + pct_pembinaan + pct_pemberdayaan = 100
      ) not valid;
    end if;
    if not exists (
      select 1 from pg_constraint
      where conname = 'apbdes_nominal_nonnegative'
        and conrelid = 'public.apbdes'::regclass
    ) then
      alter table public.apbdes add constraint apbdes_nominal_nonnegative check (
        total_anggaran >= 0 and
        coalesce(realisasi_pendapatan, 0) >= 0 and
        coalesce(realisasi_belanja, 0) between 0 and total_anggaran and
        coalesce(realisasi_pembangunan, 0) >= 0 and
        coalesce(realisasi_pemberdayaan, 0) >= 0
      ) not valid;
    end if;
  end if;
end
$apbdes_validation$;

-- Aspirasi: pengunjung hanya boleh INSERT data baru yang lolos batas dasar.
-- SELECT, UPDATE, dan DELETE tetap khusus admin terautentikasi.
do $aspiration$
begin
  if to_regclass('public.aspirasi') is null then
    raise notice 'Tabel public.aspirasi belum ada; policy aspirasi dilewati.';
    return;
  end if;

  alter table public.aspirasi enable row level security;
  alter table public.aspirasi force row level security;

  drop policy if exists "public_submit_aspiration" on public.aspirasi;
  create policy "public_submit_aspiration"
  on public.aspirasi for insert
  to anon, authenticated
  with check (
    status = 'baru'
    and char_length(btrim(nama)) between 1 and 100
    and char_length(coalesce(kontak, '')) <= 30
    and char_length(coalesce(dusun, '')) <= 100
    and char_length(coalesce(kategori, '')) <= 100
    and char_length(btrim(isi)) between 12 and 2000
  );

  drop policy if exists "admin_manage_aspirasi" on public.aspirasi;
  create policy "admin_manage_aspirasi"
  on public.aspirasi for all
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

  revoke all on public.aspirasi from anon;
  grant insert (nama, kontak, dusun, kategori, isi, status) on public.aspirasi to anon;
  grant select, insert, update, delete on public.aspirasi to authenticated;
end
$aspiration$;

-- Storage. Bucket galeri-desa dipakai khusus aset yang memang dipublikasikan
-- (galeri, perangkat, potensi, UMKM, prestasi, dan dokumen). Jangan simpan berkas
-- internal admin di bucket publik ini; gunakan bucket privat terpisah bila perlu.
drop policy if exists "public_read_sikanda_assets" on storage.objects;
create policy "public_read_sikanda_assets"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'galeri-desa');

drop policy if exists "admin_upload_sikanda_assets" on storage.objects;
create policy "admin_upload_sikanda_assets"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'galeri-desa'
  and (select private.is_admin())
  and (storage.foldername(name))[1] = any (array['galeri','perangkat','potensi','umkm','prestasi','dokumen'])
  and lower(storage.extension(name)) = any (array['jpg','jpeg','png','webp','pdf','doc','docx','xls','xlsx','csv'])
);

drop policy if exists "admin_update_sikanda_assets" on storage.objects;
create policy "admin_update_sikanda_assets"
on storage.objects for update
to authenticated
using (bucket_id = 'galeri-desa' and (select private.is_admin()))
with check (
  bucket_id = 'galeri-desa'
  and (select private.is_admin())
  and (storage.foldername(name))[1] = any (array['galeri','perangkat','potensi','umkm','prestasi','dokumen'])
  and lower(storage.extension(name)) = any (array['jpg','jpeg','png','webp','pdf','doc','docx','xls','xlsx','csv'])
);

drop policy if exists "admin_delete_sikanda_assets" on storage.objects;
create policy "admin_delete_sikanda_assets"
on storage.objects for delete
to authenticated
using (bucket_id = 'galeri-desa' and (select private.is_admin()));

commit;

-- BOOTSTRAP ADMIN (jalankan manual setelah user Auth dibuat; jangan pakai email
-- sebagai pemeriksaan policy):
-- insert into public.profiles (id, email, role)
-- select id, email, 'admin' from auth.users where id = '<UUID AUTH USER RESMI>'
-- on conflict (id) do update set email = excluded.email, role = 'admin', updated_at = now();

-- RATE LIMIT ASPIRASI (wajib untuk produksi):
-- 1. Buat Supabase Edge Function dengan service role hanya di environment server.
-- 2. Terapkan batas per IP/fingerprint dan idempotency key (mis. 3 kiriman/jam).
-- 3. Verifikasi token Cloudflare Turnstile memakai secret key di Edge Function.
-- 4. Setelah endpoint aktif, cabut GRANT INSERT anon pada tabel aspirasi dan arahkan
--    frontend ke Edge Function. Jangan pernah menaruh Turnstile secret/service role
--    key di index.html atau JavaScript browser.
