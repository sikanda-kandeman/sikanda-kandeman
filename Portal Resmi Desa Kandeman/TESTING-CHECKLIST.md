# TESTING CHECKLIST — SIKANDA

Tanggal audit: 3 Agustus 2026

Keterangan: ✅ terverifikasi; ⚠️ memerlukan konfigurasi/kredensial dan pengujian manual; ⛔ menemukan data/config yang harus diperbaiki.

## Gerbang otomatis

- ✅ `node --check` lulus untuk `supabase-client.js`, `main.js`, dan `admin.js`.
- ✅ Build produksi Sites/Vinext selesai dan artifact Worker tervalidasi.
- ✅ `index.html` tidak memiliki ID duplikat, gambar tanpa `alt`, tombol tanpa `type`, atau link `_blank` tanpa `noopener noreferrer`.
- ✅ `admin.html` tidak memiliki ID duplikat, gambar tanpa `alt`, tombol tanpa `type`, atau link `_blank` tanpa `noopener noreferrer`.
- ✅ Seluruh fungsi yang dipanggil inline memiliki definisi; hasil audit yang tersisa hanya built-in browser (`scrollTo`, `getElementById`) dan string CSS.
- ✅ JSON-LD dapat diparse; canonical, `og:url`, dan JSON-LD URL konsisten.
- ✅ Google Maps embed merespons HTTP 200 dan CSP mengizinkan kedua host Google Maps.
- ✅ OG image dan canonical sementara merespons HTTP 200.
- ✅ Seluruh 13 tabel konten yang ditemukan dapat dijangkau memakai publishable key; galeri saat audit kosong dan loader memiliki empty state.
- ✅ Tidak ada service role key, `mid=1placeholder`, pola `showToast && showToast`, atau hardcoded `data-count="5200"` pada hasil akhir.
- ✅ Stylesheet publik dan admin identik dengan stylesheet asli setelah normalisasi URL logo. Tidak ada class atau ID lama yang dihapus.
- ⚠️ Layanan screenshot browser pada lingkungan audit tidak tersedia; invariansi visual dibuktikan melalui stylesheet identik, preservasi class/ID, build produksi, serta audit DOM. Lakukan smoke test visual akhir pada browser target sebelum rilis publik.

## Halaman publik

1. ⚠️ Buka halaman dan pastikan DevTools tidak menampilkan uncaught error. Build/sintaks lulus; smoke test browser akhir tetap diperlukan.
2. ⚠️ Uji navigasi desktop dan status aktif section pada Chrome/Firefox/Safari.
3. ⚠️ Uji menu mobile pada lebar 320 px, 375 px, 768 px.
4. ✅ Seluruh anchor internal yang memiliki target section tetap tersedia; `href="#"` tanpa fungsi dicegah menggulir ke atas.
5. ✅ Kedua iframe Google Maps memakai koordinat sah, tidak memakai ID palsu, mendapat HTTP 200, dan diizinkan CSP.
6. ✅ Query anonim ke tabel konten utama merespons HTTP 200 memakai publishable key.
7. ✅ Cabang loading/kosong/error/sukses tersedia; data statis dibersihkan sebelum query dan galeri kosong menghasilkan empty state.
8. ✅ Tidak ada return kosong yang membiarkan demo tetap terlihat sebagai data resmi.
9. ⚠️ Kirim satu aspirasi uji hanya setelah kebijakan RLS/Edge Function dipasang; hapus data uji setelah verifikasi.
10. ✅ Honeypot, minimum 3 detik, flag submit, dan jeda 60 detik per sesi tersedia. ⚠️ Rate limit lintas sesi/IP membutuhkan Edge Function.
11. ✅ Copy link memakai Clipboard API aman dan fallback prompt. ⚠️ Klik tombol pada HTTPS di browser target.
12. ✅ Placeholder WhatsApp/telepon dipertahankan dan dicegah bernavigasi; URL valid hasil database tidak ikut diblokir.
13. ✅ Modal berita memiliki ARIA, pemulihan fokus, Escape, navigasi kiri/kanan, dan handler terdefinisi. ⚠️ Smoke test visual interaksi.
14. ✅ Fallback gambar dan URL sanitizer tersedia pada konten dinamis.
15. ✅ Hero dan section statistik membaca record database aktif terbaru yang sama; counter memakai target database.
16. ✅ CSS/breakpoint/class asli identik. ⚠️ Bandingkan screenshot desktop/mobile pada browser rilis karena layanan screenshot audit tidak tersedia.

## Panel admin

1. ⛔ Login role-based belum dapat diuji pada database aktif karena tabel `profiles` saat audit merespons 404. Jalankan SQL dan bootstrap UUID admin dahulu.
2. ✅ Kode menolak user tanpa `profiles.role = 'admin'`; ⚠️ verifikasi dengan satu akun non-admin setelah RLS dipasang.
3. ✅ Pemulihan session memakai `getSession`/`getUser`, persist session, refresh token, dan try/catch. ⚠️ Uji reload browser.
4. ✅ Logout memiliki try/finally; ⚠️ uji interaktif setelah login.
5. ⚠️ Uji tambah pada setiap tabel setelah role/RLS aktif.
6. ⚠️ Uji edit pada setiap tabel setelah role/RLS aktif.
7. ⚠️ Uji hapus dan konfirmasi storage cleanup setelah role/RLS aktif.
8. ⚠️ Upload JPEG/PNG/WebP serta PDF/DOCX/XLSX valid setelah storage policy aktif.
9. ✅ Validator menolak mismatch MIME/ekstensi, HTML, SVG, JavaScript, executable, file kosong, file terlalu besar, dan path tidak aman. ⚠️ Uji melalui browser.
10. ✅ Validasi statistik memeriksa angka non-negatif/finite, tahun, periode, gender, umur, KK, dan pendidikan 100%.
11. ✅ Penyimpanan dibatalkan dengan pesan spesifik bila data statistik/APBDes tidak konsisten.
12. ✅ Operasi kritis memakai try/catch; tombol simpan/upload dipulihkan dengan `finally`; safety handler mencegah unhandled Promise rejection.
13. ✅ Tombol yang diberi loading state pada operasi kritis dipulihkan pada sukses maupun error.
14. ✅ Audit sintaks dan referensi fungsi lulus. ⚠️ Pastikan console bersih saat CRUD nyata.
15. ✅ Stylesheet, class, breakpoint, dan DOM utama admin dipertahankan. ⚠️ Bandingkan screenshot login dan setiap panel setelah akses admin tersedia.

## Validasi data aktif yang ditemukan

- ⛔ Record statistik aktif Juli 2026: total laki-laki + perempuan tidak sama dengan total penduduk.
- ⛔ Record statistik aktif Juli 2026: jumlah seluruh kelompok umur tidak sama dengan total penduduk.
- ✅ Persentase pendidikan pada record aktif berjumlah 100%.
- ⚠️ Kolom `luas_wilayah_ha`, `total_rt`, `total_rw`, kolom `apbdes.aktif`, dan tabel `profiles` belum ada saat audit; semuanya ditangani oleh SQL tanpa mengarang nilai.

## Urutan uji rilis yang disarankan

1. Backup database dan bucket Supabase.
2. Jalankan `supabase-rls-policies.sql` pada staging, tinjau NOTICE, lalu bootstrap satu admin berdasarkan UUID Auth.
3. Koreksi data statistik aktif dengan angka resmi hingga semua validasi lulus.
4. Tandai `aktif = true` hanya pada data yang sudah ditinjau.
5. Jalankan seluruh uji publik dan admin di staging, termasuk upload gagal/rollback dan akun non-admin.
6. Konfigurasikan Edge Function + Turnstile untuk produksi, lalu cabut INSERT anon langsung bila endpoint sudah aktif.
7. Lakukan screenshot comparison desktop/mobile dan rilis hanya jika tidak ada perubahan visual tak disengaja.
