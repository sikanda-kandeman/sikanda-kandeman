# CHANGELOG — Perbaikan Teknis SIKANDA

Tanggal: 3 Agustus 2026

## Ringkasan

Perbaikan dilakukan tanpa redesign. Stylesheet publik dan admin tetap identik dengan stylesheet asli setelah satu-satunya substitusi mekanis URL logo Base64 ke `assets/images/logo-desa.png`. Tidak ada class atau ID lama yang dihapus, urutan section dan navigasi tetap, dan seluruh fungsi tetap menggunakan HTML, CSS, serta JavaScript vanilla.

## Masalah yang ditemukan dan perbaikan

### CSP dan Google Maps

- CSP publik dan admin belum memiliki izin iframe Google Maps. Ditambahkan `frame-src 'self' https://www.google.com https://maps.google.com;` tanpa melonggarkan direktif lain.
- URL My Maps `mid=1placeholder` menghasilkan lokasi tidak valid. Iframe sekarang memakai embed koordinat yang sudah ada di kode (`-6.9004, 109.7497`), tanpa mengubah container, ukuran, posisi, border, atau style.
- TODO untuk URL/layer My Maps resmi tetap disediakan. Tidak ada ID peta buatan.

### Placeholder

- Nomor WhatsApp, telepon, kode desa, tautan sosial, dan data resmi lain yang belum tersedia tetap dipertahankan.
- Setiap kelompok data yang belum resmi diberi komentar `TODO` yang mudah dicari.
- Link placeholder dicegah dari navigasi keliru melalui pemeriksaan JavaScript. Setelah nilai diganti dengan URL/nomor valid, link langsung bekerja tanpa perubahan kode.
- `href="#"` yang memiliki handler tetap berfungsi; yang tidak memiliki fungsi tidak lagi menggulir halaman ke atas.

### Data dinamis dan empty state

- Konten contoh untuk berita, galeri, perangkat, APBDes, potensi, UMKM, agenda, statistik, jadwal/kontak kesehatan, prestasi, dan dokumen dibersihkan sebelum query.
- Kondisi loading, kosong, error, dan sukses dipisahkan. Pesan `Memuat...` selalu diganti setelah query selesai/gagal.
- Query kosong atau gagal tidak lagi membiarkan data demo terlihat sebagai data resmi.

### Statistik

- Nilai hero, ringkasan demografi, piramida umur, gender, pendidikan, KK, luas wilayah, RT, dan RW memakai record `statistik` aktif terbaru yang sama.
- Target animasi counter diperbarui dari database; nilai hardcoded `data-count` dihapus.
- Kolom opsional `luas_wilayah_ha`, `total_rt`, dan `total_rw` ditambahkan oleh SQL. Sebelum data resmi diisi, UI menampilkan tanda pisah, bukan angka buatan.
- Panel admin menolak total penduduk yang tidak sama dengan laki-laki + perempuan, total kelompok umur yang tidak sama dengan penduduk, total pendidikan yang bukan 100%, angka negatif, NaN, dan tahun/periode tidak valid.
- Constraint database `NOT VALID` disediakan agar data lama tidak dihapus, tetapi INSERT/UPDATE berikutnya wajib konsisten.

### JavaScript dan salin tautan

- Salin tautan memakai Clipboard API hanya dalam secure context dan memiliki fallback `window.prompt`.
- Akses fungsi yang mungkin tidak tersedia tidak lagi menghasilkan `ReferenceError`.
- Loader publik dijalankan melalui pembungkus error; rejection tak tertangani dicatat sebagai error terkendali.
- Null checks, pemulihan fokus modal, tombol bertipe benar, rel eksternal aman, label form, dan alt gambar diperkuat tanpa perubahan visual.

### Supabase dan autentikasi admin

- Frontend hanya memuat publishable key; tidak ditemukan service role key.
- Daftar email admin di JavaScript dipertahankan hanya sebagai metadata UI.
- Login admin kini membutuhkan record `public.profiles` dengan `role = 'admin'` untuk user Auth yang sama.
- `supabase-rls-policies.sql` mengaktifkan/menegakkan RLS untuk seluruh tabel yang ditemukan di kode, membatasi baca publik ke `aktif = true`, membatasi CRUD ke admin database, dan mencegah anon membaca aspirasi.
- Aspirasi publik hanya mendapat izin INSERT dengan batas panjang/status dasar. Storage `galeri-desa` dapat dibaca untuk aset publik; upload/update/delete hanya admin.

### Form aspirasi

- Ditambahkan honeypot tersembunyi, waktu isi minimum 3 detik, jeda kirim ulang 60 detik per sesi, flag submit aktif, sanitasi karakter kontrol/HTML, validasi panjang dan kontak, serta pemulihan tombol dalam `finally`.
- Komentar integrasi Cloudflare Turnstile dan Supabase Edge Function tersedia. Secret key dan service role key tidak ditempatkan di frontend.

### Upload file

- Gambar dibatasi ke JPEG, PNG, dan WebP; dokumen ke PDF, DOC/DOCX, XLS/XLSX, CSV, JPEG/PNG/WebP sesuai kebutuhan form.
- MIME type dan ekstensi harus cocok, ukuran dibatasi, nama storage memakai UUID, folder dibersihkan, dan path traversal ditolak.
- File baru dihapus kembali bila insert/update database gagal. File lama dihapus setelah perubahan database berhasil.
- HTML, SVG, JavaScript, executable, ekstensi ganda yang tidak cocok, dan tipe di luar whitelist ditolak.

### Metadata

- Canonical, Open Graph URL, dan JSON-LD memakai URL sementara yang sama: `https://sikanda-kandeman.vercel.app/`.
- JSON-LD berhasil diparse tanpa trailing comma. Judul dan deskripsi tidak diubah.
- OG image dan URL canonical sementara merespons HTTP 200 pada pengujian.

### Refactor

- CSS inline dipindahkan ke `assets/css/main.css` dan `assets/css/admin.css`.
- JavaScript dipindahkan ke `assets/js/main.js` dan `assets/js/admin.js`.
- Konfigurasi Supabase bersama dipindahkan ke `assets/js/supabase-client.js`.
- Logo Base64 dipindahkan lossless ke `assets/images/logo-desa.png` dan dipakai langsung oleh elemen gambar.
- Script memakai `defer` dengan urutan SDK Supabase → client bersama → script halaman.

## File yang diubah/dibuat

- `index.html` — CSP, metadata, iframe peta, placeholder TODO, ID statistik, honeypot, atribut aksesibilitas, dan referensi aset eksternal.
- `admin.html` — CSP, whitelist input file, ARIA modal, atribut aksesibilitas, ID tombol, dan referensi aset eksternal.
- `assets/css/main.css` — CSS publik asli tanpa redesign.
- `assets/css/admin.css` — CSS admin asli tanpa redesign.
- `assets/js/supabase-client.js` — konfigurasi publishable client bersama.
- `assets/js/main.js` — loader/empty state, statistik, placeholder guard, copy link, modal, dan anti-spam.
- `assets/js/admin.js` — role admin database, validasi data, upload/rollback, error handling, dan aksesibilitas.
- `assets/images/logo-desa.png` — hasil ekstraksi lossless dari Base64 asli.
- `supabase-rls-policies.sql` — profiles, RLS tabel, Storage policy, constraint konsistensi, dan panduan bootstrap/rate limit.
- `TESTING-CHECKLIST.md` — hasil audit otomatis dan langkah uji integrasi.

## Dampak

- UI/UX, palette, font, spacing, breakpoint, animasi, hover, layout, class lama, dan struktur navigasi tidak berubah.
- Data kosong/error kini terlihat sebagai empty/error state formal, bukan konten contoh.
- Panel tidak menyimpan data statistik/APBDes yang tidak konsisten.
- Operasi upload tidak meninggalkan file yatim ketika transaksi database gagal.
- Hak admin tidak lagi ditentukan oleh email frontend.

## Data asli yang masih dibutuhkan

- Nomor WhatsApp Balai Desa dan UMKM.
- Nomor telepon kantor, Bidan Desa, Puskesmas, dan rumah sakit rujukan.
- Kode desa, akun media sosial, serta URL/layer Google My Maps resmi.
- Nilai resmi luas wilayah, jumlah RT, dan jumlah RW pada tabel statistik.
- Koreksi record statistik aktif Juli 2026: pengujian menemukan total gender dan total kelompok umur belum sama dengan total penduduk. Nilai tidak diubah karena angka resmi belum dikonfirmasi.

## Konfigurasi Supabase yang masih wajib

- Jalankan `supabase-rls-policies.sql` di SQL Editor.
- Tabel `profiles` dan kolom opsional statistik belum ada pada database saat audit; SQL menyediakannya.
- Tambahkan user Auth resmi ke `profiles` dengan UUID user dan `role = 'admin'` menggunakan contoh bootstrap di akhir SQL.
- Tinjau data lama lalu set `aktif = true` hanya untuk baris yang memang boleh dipublikasikan.
- Pastikan bucket `galeri-desa` khusus aset publik; simpan dokumen internal pada bucket privat terpisah.

## Domain, Turnstile, dan Edge Function

- Ganti ketiga URL metadata bersama hanya setelah domain resmi aktif dan benar-benar mengarah ke SIKANDA.
- Turnstile tetap opsional sampai site key/secret tersedia. Secret hanya boleh disimpan di environment Edge Function.
- Untuk rate limiting produksi, arahkan submit aspirasi ke Edge Function, terapkan batas per IP/fingerprint dan idempotency key, lalu cabut INSERT anon langsung sesuai catatan SQL.
