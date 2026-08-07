/* ── Pastikan semua accordion surat tertutup saat load ── */
  document.querySelectorAll('.surat-item').forEach(i => {
    i.classList.remove('open');
    const body = i.querySelector('.surat-body');
    if (body) body.style.removeProperty('display');
  });
  document.querySelectorAll('.surat-chevron').forEach(c => c.style.removeProperty('transform'));

  /* ══════════════════════════════════════
     INTRO SPLASH — timing controller
  ══════════════════════════════════════ */
  (function() {
    const intro = document.getElementById('page-intro');
    if (!intro) return;

    // Durasi splash: 0.8 detik — cukup untuk animasi, lebih ramah LCP
    const SPLASH_DURATION = 800;

    function dismissIntro() {
      intro.classList.add('hiding');
      setTimeout(() => {
        intro.remove();
        document.body.classList.add('page-ready');
      }, 700);
    }

    // Mulai countdown saat DOM siap
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(dismissIntro, SPLASH_DURATION));
    } else {
      setTimeout(dismissIntro, SPLASH_DURATION);
    }

    // Fallback: paksa hapus setelah 4 detik agar tidak stuck
    setTimeout(() => {
      if (document.getElementById('page-intro')) {
        intro.remove();
        document.body.classList.add('page-ready');
      }
    }, 4000);
  })();

  /* ── Navbar ── */
  function toggleNav() {
    const links = document.getElementById('navLinks');
    links.classList.toggle('open');
  }
  function closeNav() {
    document.getElementById('navLinks').classList.remove('open');
  }

  /* Dropdown click on mobile */
  function handleDropdownClick(e, el) {
    /* Ambang harus sama dengan media query menu hamburger (1239px),
       jika tidak dropdown tak bisa dibuka di laptop kecil. */
    if (window.innerWidth <= 1239) {
      e.preventDefault();
      el.closest('.nav-item').classList.toggle('open');
    }
  }

  /* ── Intercept SEMUA klik anchor internal ── */
  // Tangkap di document level agar mencakup nav, hero-tags, quick-cards, dan semua link #hash
  document.addEventListener('click', function(e) {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const hash = a.getAttribute('href');
    if (!hash || hash === '#') return;
    // Biarkan handleDropdownClick menangani dropdown mobile
    if (a.hasAttribute('onclick') &&
        a.getAttribute('onclick').includes('handleDropdownClick')) return;
    e.preventDefault();
    closeNav();
    // Tunggu menu tertutup dulu (reflow selesai) baru scroll
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToAnchor(hash);
      });
    });
  });

  /* ── Navbar muncul setelah pengunjung mulai menggulir ── */
  const mainNav = document.getElementById('mainNav');
  const NAV_REVEAL_OFFSET = 64;
  function updateMainNav() {
    if (!mainNav) return;
    const hasScrolled = window.scrollY > NAV_REVEAL_OFFSET;
    mainNav.classList.toggle('nav-visible', hasScrolled);
    mainNav.classList.toggle('scrolled', window.scrollY > 10);
  }
  window.addEventListener('scroll', updateMainNav, { passive: true });
  window.addEventListener('pageshow', updateMainNav);
  requestAnimationFrame(updateMainNav);

  /* ── Spotlight border: track posisi mouse di kartu ── */
  document.addEventListener('mousemove', e => {
    const cards = document.querySelectorAll('.news-card, .potensi-card, .lembaga-card, .quick-card');
    cards.forEach(card => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--sx', x + 'px');
      card.style.setProperty('--sy', y + 'px');
    });
  }, { passive: true });

  /* ── Ripple click effect ── */
  document.addEventListener('click', e => {
    const btn = e.target.closest('button, .hero-tag, .quick-card, .btn-primary');
    if (!btn || btn.style.position === '') return;
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'ripple-effect';
    ripple.style.cssText = `left:${e.clientX - rect.left}px; top:${e.clientY - rect.top}px;`;
    // hanya jika elemen position != static
    const pos = getComputedStyle(btn).position;
    if (pos === 'static') btn.style.position = 'relative';
    btn.style.overflow = 'hidden';
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  });

  /* ── Text Scramble pada hero tagline ── */
  function scrambleText(el, finalText, duration = 900) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#@&-_·';
    let frame = 0;
    const totalFrames = duration / 40;
    const interval = setInterval(() => {
      el.textContent = finalText.split('').map((char, i) => {
        if (char === ' ') return ' ';
        if (frame / totalFrames > i / finalText.length) return char;
        return chars[Math.floor(Math.random() * chars.length)];
      }).join('');
      frame++;
      if (frame >= totalFrames) { el.textContent = finalText; clearInterval(interval); }
    }, 40);
  }

  /* ── Section headers: ubah .center ke left pada non-info section ── */
  document.querySelectorAll('.section-header.center').forEach(el => {
    // Hanya keep center pada section yang memang perlu (galeri, kontak)
    const sec = el.closest('section');
    const id = sec?.id || '';
    if (!['galeri','kontak','lembaga'].includes(id)) {
      el.classList.remove('center');
    }
  });

  /* ── Active nav on scroll ── */
  const sections = document.querySelectorAll('section[id]');
  const navItems = document.querySelectorAll('.nav-item');

  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(s => {
      if (window.scrollY >= s.offsetTop - 100) current = s.id;
    });
    navItems.forEach(item => {
      item.classList.remove('active');
      const link = item.querySelector('a');
      if (link && link.getAttribute('href') === '#' + current) {
        item.classList.add('active');
      }
    });
  }, { passive: true });

  /* ── Search overlay ── */
  function openSearch() {
    const overlay = document.getElementById('searchOverlay');
    overlay?.classList.add('open');
    activateDialog(overlay, document.getElementById('searchInput'));
  }
  function closeSearch(e) {
    if (!e || e.target === document.getElementById('searchOverlay') || !e.target.closest) {
      const overlay = document.getElementById('searchOverlay');
      overlay?.classList.remove('open');
      deactivateDialog(overlay);
    }
  }
  document.addEventListener('keydown', e => {
    const overlay = document.getElementById('searchOverlay');
    if (e.key === 'Escape' && overlay?.classList.contains('open')) {
      overlay.classList.remove('open');
      deactivateDialog(overlay);
    }
  });
  /* ══════════════════════════════════════
     SEARCH ENGINE — keyword → anchor map
  ══════════════════════════════════════ */
  const searchRoutes = [
    // ── Profil ──
    { keys: ['sejarah','berdiri','asal usul','asal-usul','profil','tentang desa','mengenal'], anchor: '#profil-sejarah' },
    { keys: ['geografis','geografi','letak','wilayah','batas','peta wilayah','luas','ketinggian','pesisir','laut jawa'], anchor: '#profil-geografis' },
    { keys: ['demografi','penduduk','jumlah warga','kk','kepala keluarga','rt','rw','populasi'], anchor: '#profil-demografi' },
    { keys: ['visi','misi','visi misi','tujuan desa','cita-cita','mandiri','sejahtera','gotong royong'], anchor: '#visi-misi' },

    // ── Pemerintahan ──
    { keys: ['struktur','organisasi','org chart','bagan','hirarki','kepala desa','kades','sekdes','sekretaris'], anchor: '#struktur-org' },
    { keys: ['perangkat','kaur','kasi','kadus','kepala dusun','perangkat desa','daftar perangkat','tata usaha','keuangan','perencanaan'], anchor: '#perangkat-desa' },

    // ── Lembaga ──
    { keys: ['lembaga','bpd','pkk','karang taruna','linmas','lpmd','bumdes','posyandu','fkd','babinsa','bhabinkamtibmas','gapoktan','kelembagaan'], anchor: '#lembaga' },

    // ── Potensi ──
    { keys: ['potensi','pertanian','sawah','padi','peternakan','ayam','sapi'], anchor: '#potensi' },
    { keys: ['kelautan','nelayan','ikan','tambak','pantai','bahari','laut'], anchor: '#potensi' },
    { keys: ['dagang','jualan','kerajinan','produk lokal'], anchor: '#potensi' },
    { keys: ['wisata','wisata religi','ziarah','maulana','maghribi','pariwisata'], anchor: '#potensi' },
    { keys: ['budaya','seni','kuda lumping','hadroh','sedekah bumi','tradisi'], anchor: '#potensi' },

    // ── UMKM (section tersendiri) ──
    { keys: ['umkm','produk umkm','pelaku usaha','usaha warga','usaha','kuliner','oleh-oleh','belanja'], anchor: '#umkm' },

    // ── Kesehatan ──
    { keys: ['kesehatan','posyandu','posbindu','bidan','puskesmas','rumah sakit','jadwal posyandu','imunisasi','balita','lansia','darurat medis','119'], anchor: '#kesehatan' },

    // ── Agenda ──
    { keys: ['agenda','kalender','acara','kegiatan desa','jadwal kegiatan'], anchor: '#agenda' },

    // ── Statistik ──
    { keys: ['statistik','data penduduk','piramida','kelompok umur','tingkat pendidikan','demografi warga'], anchor: '#statistik' },

    // ── Aspirasi ──
    { keys: ['aspirasi','keluhan','saran','pengaduan','lapor','masukan','kritik'], anchor: '#aspirasi' },

    // ── Hukum & Edukasi ──
    { keys: ['perdes','peraturan desa','produk hukum','hukum','edukasi','poster','literasi'], anchor: '#hukum-edukasi' },

    // ── Transparency Hub ──
    { keys: ['unduh data','dataset','data statistik','literasi keuangan'], anchor: '#transparency-hub' },

    // ── Transparansi APBDes ──
    { keys: ['apbdes','apb des','anggaran desa','total anggaran','alokasi','dana desa','apbn','add','pendapatan desa','dokumen anggaran','arsip dokumen','laporan keuangan','lppd'], anchor: '#transparansi' },
    { keys: ['realisasi','realisasi anggaran','belanja desa','pembangunan','capaian anggaran','persen realisasi'], anchor: '#realisasi' },

    // ── Layanan / Surat ──
    { keys: ['alur','alur pelayanan','prosedur','langkah','cara mengurus','cara buat'], anchor: '#alur-pelayanan' },
    { keys: ['persyaratan','syarat','berkas','dokumen','lampiran','persiapan'], anchor: '#persyaratan' },
    { keys: ['domisili','keterangan domisili','surat domisili'], anchor: '#persyaratan' },
    { keys: ['sku','surat usaha','keterangan usaha','usaha kecil','umkm surat'], anchor: '#persyaratan' },
    { keys: ['ktp baru','ktp','e-ktp','ektp','pengantar ktp','kartu tanda','kartu keluarga','perubahan kk','pengantar kk'], anchor: '#persyaratan' },
    { keys: ['sktm','tidak mampu','keterangan tidak mampu','bansos','bantuan sosial','beasiswa','miskin'], anchor: '#persyaratan' },
    { keys: ['nikah','pernikahan','pengantar nikah','n1','n2','n4','kua','calon pengantin'], anchor: '#persyaratan' },
    { keys: ['kematian','surat kematian','meninggal','akta kematian','wafat'], anchor: '#persyaratan' },
    { keys: ['jam','jam buka','jam pelayanan','jadwal','buka','tutup','layanan'], anchor: '#layanan' },

    // ── Informasi ──
    { keys: ['berita','berita desa','news','kabar','informasi terbaru','update','warta'], anchor: '#berita' },
    { keys: ['pengumuman','pengumuman desa','pemberitahuan','info penting'], anchor: '#berita' },
    { keys: ['galeri','foto','dokumentasi','gambar','album'], anchor: '#galeri' },

    // ── Prestasi ──
    { keys: ['prestasi','penghargaan','juara','award','capaian','lomba','kompetisi'], anchor: '#penghargaan' },

    // ── FAQ ──
    { keys: ['faq','pertanyaan','tanya jawab','q&a','sering ditanya'], anchor: '#faq' },

    // ── Kontak ──
    { keys: ['kontak','hubungi','telepon','telpon','email','alamat','lokasi','peta','balai desa','jam kerja','whatsapp','wa'], anchor: '#kontak' },
  ];

  function doSmartSearch(query) {
    if (!query) return null;
    const lq = query.toLowerCase().trim();
    // Pilih kata kunci paling spesifik (terpanjang) yang cocok, bukan rute
    // pertama yang kebetulan cocok — supaya "jadwal posyandu" tidak
    // tertangkap lebih dulu oleh kata "jadwal".
    let terbaik = null, panjang = 0;
    for (const route of searchRoutes) {
      for (const key of route.keys) {
        if (lq.includes(key) && key.length > panjang) {
          terbaik = route.anchor;
          panjang = key.length;
        }
      }
    }
    return terbaik;
  }

  function doSearch() {
    const q = document.getElementById('searchInput').value.trim();
    if (!q) return;
    const anchor = doSmartSearch(q);
    document.getElementById('searchOverlay').classList.remove('open');
    if (anchor) {
      scrollToAnchor(anchor);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      showSearchFeedback(q, false);
    }
  }

  function doHeroSearch() {
    const q = document.getElementById('heroSearch').value.trim();
    if (!q) return;
    const anchor = doSmartSearch(q);
    if (anchor) {
      scrollToAnchor(anchor);
    } else {
      showSearchFeedback(q, false);
    }
  }

  function scrollToAnchor(anchor) {
    const target = document.querySelector(anchor);
    if (!target) return;
    const NAVBAR  = 64;  // tinggi navbar px — sama dengan CSS height: 64px
    const MARGIN  = 20;  // ruang napas di atas konten
    // getBoundingClientRect relatif ke viewport saat ini
    const rect = target.getBoundingClientRect();
    const absTop = rect.top + window.scrollY;
    window.scrollTo({ top: absTop - NAVBAR - MARGIN, behavior: 'smooth' });
  }

  function showSearchFeedback(q, found) {
    // Remove existing toast if any
    const existing = document.getElementById('search-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'search-toast';
    toast.style.cssText = `
      position:fixed; bottom:28px; left:50%; transform:translateX(-50%);
      background:var(--forest); color:#fff; padding:12px 24px;
      border-radius:40px; font-size:13.5px; font-weight:500;
      box-shadow:0 8px 28px rgba(0,0,0,.22); z-index:9999;
      display:flex; align-items:center; gap:10px;
      animation: fadeInUp 0.25s ease;
    `;
    if (!found) {
      toast.innerHTML = `<i class="fa-solid fa-circle-info" style="color:var(--mint)"></i> Kata kunci "<strong>${escHtml(q)}</strong>" tidak ditemukan. Coba kata lain.`;
    }
    // Add animation keyframes
    if (!document.getElementById('toast-style')) {
      const s = document.createElement('style');
      s.id = 'toast-style';
      s.textContent = `@keyframes fadeInUp { from { opacity:0; transform:translateX(-50%) translateY(14px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }`;
      document.head.appendChild(s);
    }
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity='0'; toast.style.transition='opacity 0.4s'; setTimeout(()=>toast.remove(),400); }, 3200);
  }

  /* ── FAQ accordion ── */
  function toggleFaq(el) {
    const item = el.closest('.faq-item');
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
  }

  /* ── Surat accordion ── */
  function toggleSurat(el) {
    const item = el.closest('.surat-item');
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.surat-item').forEach(i => i.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
  }

  /* ── Back to top ── */
  const backTop = document.getElementById('backTop');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 400) backTop.classList.add('show');
    else backTop.classList.remove('show');
  }, { passive: true });

  /* ── Scroll reveal + stagger anak elemen ── */
  const revealEls = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        // Stagger: beri delay bertingkat ke kartu di dalam section
        const kids = entry.target.querySelectorAll(
          '.news-card, .layanan-card, .lembaga-card, .potensi-card, .prestasi-card, ' +
          '.info-card, .galeri-item, .budget-item, .quick-card, .sehat-stat, ' +
          '.darurat-card, .umkm-card, .poster-card, .agenda-card, .geo-card, ' +
          '.kontak-card, .realisasi-overview, .realisasi-stat, .realisasi-row, .transp-info-card, .perdes-item, .arsip-item, ' +
          '.surat-item, .maklumat-item, .faq-item, .literasi-item, .jadwal-table tbody tr'
        );
        kids.forEach((k, i) => {
          k.classList.add('reveal-item');
          setTimeout(() => k.classList.add('visible'), Math.min(i * 60, 620));
        });
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  revealEls.forEach(el => observer.observe(el));

  /* ══════════════════════════════════════
     MOTION LAYER — kontrol animasi gerak
  ══════════════════════════════════════ */
  const kurangiGerak = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Pengaman: pastikan tidak ada section yang tertinggal tersembunyi
     (mis. section sangat panjang, atau digulir sangat cepat).
     Elemen yang sudah tampil dikeluarkan dari daftar agar tetap ringan. */
  let sisaReveal = Array.prototype.slice.call(revealEls);
  const sapuReveal = () => {
    if (!sisaReveal.length) return;
    const tinggi = window.innerHeight;
    sisaReveal = sisaReveal.filter(el => {
      /* Tampilkan bila sudah masuk viewport ATAU sudah terlewati
         (mis. akibat lompatan tautan anchor di navbar). */
      if (el.getBoundingClientRect().top < tinggi * 0.92) {
        el.classList.add('visible');
        return false;
      }
      return true;
    });
  };
  window.addEventListener('scroll', sapuReveal, { passive: true });
  window.addEventListener('resize', sapuReveal, { passive: true });
  setTimeout(sapuReveal, 900);
  window.addEventListener('load', sapuReveal);

  if (!kurangiGerak) {
    const bar      = document.getElementById('scrollProgressBar');
    const heroInner = document.querySelector('.hero-inner');
    let ticking = false;

    const perbaruiGerak = () => {
      const y = window.scrollY;

      /* 1. Progress baca */
      if (bar) {
        const total = document.documentElement.scrollHeight - window.innerHeight;
        const rasio = total > 0 ? Math.min(y / total, 1) : 0;
        bar.style.transform = 'scaleX(' + rasio + ')';
      }

      /* 2. Parallax hero — konten naik pelan & memudar saat digulir */
      if (heroInner && y < window.innerHeight) {
        heroInner.style.transform = 'translate3d(0,' + (y * 0.22) + 'px,0)';
        heroInner.style.opacity   = String(Math.max(1 - y / (window.innerHeight * 0.75), 0));
      }

      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(perbaruiGerak); }
    }, { passive: true });
    perbaruiGerak();

    /* 3. Tilt 3D ringan — memakai delegasi agar ikut berlaku
          untuk kartu yang dirender belakangan dari database. */
    const TILT_SEL = '.quick-card, .potensi-card';
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      let kartuAktif = null;

      document.addEventListener('pointermove', e => {
        const kartu = e.target.closest ? e.target.closest(TILT_SEL) : null;
        if (!kartu) {
          if (kartuAktif) {
            kartuAktif.classList.remove('tilting');
            kartuAktif.style.transform = '';
            kartuAktif = null;
          }
          return;
        }
        if (kartuAktif !== kartu) {
          if (kartuAktif) { kartuAktif.classList.remove('tilting'); kartuAktif.style.transform = ''; }
          kartu.classList.add('tilt');
          kartuAktif = kartu;
        }
        const r  = kartu.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width  - 0.5;
        const py = (e.clientY - r.top)  / r.height - 0.5;
        kartu.classList.add('tilting');
        kartu.style.transform =
          'perspective(700px) rotateX(' + (-py * 6) + 'deg) rotateY(' + (px * 6) + 'deg) translateY(-3px)';
      }, { passive: true });

      /* Reset saat pointer meninggalkan jendela */
      document.addEventListener('pointerleave', () => {
        if (kartuAktif) {
          kartuAktif.classList.remove('tilting');
          kartuAktif.style.transform = '';
          kartuAktif = null;
        }
      });
    }

    /* 4. Kartu yang dimuat dari database ikut beranimasi masuk.
          Diamati satu per satu, lalu dianimasikan saat memasuki layar. */
    const KARTU_SEL = '.news-card, .layanan-card, .lembaga-card, .potensi-card, ' +
                      '.prestasi-card, .info-card, .galeri-item, .quick-card, ' +
                      '.umkm-card, .agenda-card, .darurat-card, .perdes-item, ' +
                      '.arsip-item, .surat-item';

    const kartuObserver = new IntersectionObserver((entries, obs) => {
      const masuk = entries.filter(en => en.isIntersecting).map(en => en.target);
      masuk.forEach((el, i) => {
        el.style.animationDelay = Math.min(i * 60, 400) + 'ms';
        el.classList.add('card-in');
        obs.unobserve(el);
      });
    }, { threshold: 0.05 });

    const mutObserver = new MutationObserver(mutasi => {
      mutasi.forEach(m => {
        m.addedNodes.forEach(n => {
          if (n.nodeType !== 1) return;
          if (n.matches && n.matches(KARTU_SEL)) kartuObserver.observe(n);
          if (n.querySelectorAll) {
            n.querySelectorAll(KARTU_SEL).forEach(el => kartuObserver.observe(el));
          }
        });
      });
    });
    mutObserver.observe(document.body, { childList: true, subtree: true });
  }

  /* ── Count-up angka statistik ── */
  const countObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el     = entry.target;
      if (el.dataset.empty === 'true') {
        el.textContent = '—';
        countObserver.unobserve(el);
        return;
      }
      const target = parseFloat(el.dataset.count) || 0;
      const prefix = el.dataset.prefix || '';
      const suffix = el.dataset.suffix || '';
      const sep    = el.dataset.sep === 'true';
      const dur    = 1500;
      const t0     = performance.now();

      function step(now) {
        const p = Math.min((now - t0) / dur, 1);
        // easeOutExpo — cepat di awal, melambat di akhir
        const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
        const val   = Math.round(target * eased);
        el.textContent = prefix + (sep ? val.toLocaleString('id-ID') : val) + suffix;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
      countObserver.unobserve(el);
    });
  }, { threshold: 0.4 });
  function observeCounters() {
    document.querySelectorAll('.count-up').forEach(el => countObserver.observe(el));
  }

// ═══════════════════════════════════════════════════
// SIKANDA — Supabase Integration (Website Utama)
// Data berita, galeri, perangkat, APBDes, potensi
// diambil live dari database Supabase
// ═══════════════════════════════════════════════════
const sb = window.sb;

// Global state
let _beritaList  = [];
let _umkmList    = [];
let _beritaIndex = 0;

const DATA_STATE = Object.freeze({
  loading: { icon: 'fa-spinner fa-spin', message: 'Memuat...' },
  empty:   { icon: 'fa-circle-info', message: 'Belum ada data yang dipublikasikan.' },
  error:   { icon: 'fa-triangle-exclamation', message: 'Data belum dapat dimuat.' },
});

function renderDataState(target, status, message, options = {}) {
  const element = typeof target === 'string' ? document.getElementById(target) : target;
  if (!element) return;
  const state = DATA_STATE[status] || DATA_STATE.empty;
  const text = message || state.message;
  const colspan = Number(options.colspan) || 4;

  if (element.tagName === 'TBODY') {
    element.innerHTML = `<tr><td colspan="${colspan}" style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px;">
      <i class="fa-solid ${state.icon}" style="margin-right:7px;opacity:.45;"></i>${escHtml(text)}</td></tr>`;
    return;
  }

  element.innerHTML = `<div data-data-state="${status}" style="grid-column:1/-1;text-align:center;padding:32px;color:var(--text-muted);font-size:13px;">
    <i class="fa-solid ${state.icon}" style="font-size:24px;margin-bottom:9px;display:block;opacity:.35;"></i>${escHtml(text)}</div>`;
}

function resetOrgChart() {
  const names = [
    'kades-name-org','sekdes-name-org','kaur-tu-name','kaur-ku-name','kaur-kp-name',
    'kasi-pm-name','kasi-ks-name','kasi-pl-name','kadus1-name','kadus2-name',
    'kadus3-name','kadus4-name','kadus5-name',
  ];
  names.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.textContent = '—';
  });
}

function prepareDynamicLoadingStates() {
  [
    'berita-grid','galeri-grid','potensi-grid','umkm-grid','agenda-mendatang',
    'agenda-lalu','prestasi-grid','kontak-kesehatan-list','financial-docs-grid',
    'perdes-list','poster-edukasi-list',
  ].forEach(id => renderDataState(id, 'loading'));
  renderDataState('perangkat-tbody', 'loading', null, { colspan: 4 });
  renderDataState('jadwal-kesehatan-body', 'loading', null, { colspan: 4 });
  resetOrgChart();
}

function isPlaceholderLink(href) {
  if (!href) return true;
  const value = String(href).trim();
  if (/X{4,}/i.test(value) || value.includes('1placeholder')) return true;
  if (/^tel:(?:0|0285000000)$/i.test(value)) return true;

  try {
    const parsed = new URL(value, window.location.href);
    if (/^(?:www\.)?wa\.me$/i.test(parsed.hostname)) {
      const number = parsed.pathname.replace(/\//g, '');
      if (number === '62' || !/^62\d{7,15}$/.test(number)) return true;
    }
  } catch {
    return true;
  }
  return false;
}

document.addEventListener('click', event => {
  const link = event.target.closest?.('a[href]');
  if (!link) return;
  const href = link.getAttribute('href');

  if (isPlaceholderLink(href)) {
    event.preventDefault();
    return;
  }

  if (href === '#' && !link.hasAttribute('onclick')) {
    event.preventDefault();
  }
});

const dialogFocusReturn = new WeakMap();
function activateDialog(dialog, focusTarget) {
  if (!dialog) return;
  dialogFocusReturn.set(dialog, document.activeElement);
  dialog.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => focusTarget?.focus?.());
}

function deactivateDialog(dialog) {
  if (!dialog) return;
  dialog.setAttribute('aria-hidden', 'true');
  const previous = dialogFocusReturn.get(dialog);
  dialogFocusReturn.delete(dialog);
  if (previous && document.contains(previous)) previous.focus?.();
}

// ── Helper: escape HTML (cegah XSS) ──

/* ════════════════════════════════════════
   NOMOR TELEPON — normalisasi terpusat
   Menerima format apa pun yang biasa diketik admin:
   0821..., +62 821..., 62821..., 821..., (0285) 123-456
   Mengembalikan { wa, tel, tampil } atau null bila tidak valid.
   Nomor darurat pendek (119, 112, 110) tidak diubah dan
   tidak diberi tautan WhatsApp.
════════════════════════════════════════ */
function normalisasiTelepon(mentah) {
  if (mentah === null || mentah === undefined) return null;
  let d = String(mentah).replace(/[^0-9+]/g, '');
  if (!d) return null;
  d = d.replace(/\+/g, '');           // buang '+', kode negara ditentukan di bawah
  if (!d) return null;

  // Nomor darurat / layanan pendek (110, 112, 119): biarkan apa adanya
  if (d.length <= 4) {
    return { wa: null, tel: d, tampil: d, pendek: true };
  }
  // Terlalu pendek untuk nomor sungguhan
  if (d.length < 7) return null;

  let nasional;                       // tanpa kode negara, diawali 0
  if (d.startsWith('62'))      nasional = '0' + d.slice(2);
  else if (d.startsWith('0'))  nasional = d;
  else                         nasional = '0' + d;   // cth: 821... -> 0821...

  const internasional = '62' + nasional.slice(1);

  // Tampilan: seluler dikelompokkan 0812-3456-7890,
  // telepon tetap ditulis 0285 391234.
  let tampil;
  if (nasional.startsWith('08')) {
    tampil = nasional.length > 8
      ? nasional.slice(0, 4) + '-' + nasional.slice(4, 8) + '-' + nasional.slice(8)
      : nasional;
  } else {
    tampil = nasional.length > 4
      ? nasional.slice(0, 4) + ' ' + nasional.slice(4)
      : nasional;
  }

  return { wa: internasional, tel: '+' + internasional, tampil: tampil, pendek: false };
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Helper: pastikan URL aman dipakai pada href/src ──
// escHtml tidak memblokir protokol berbahaya seperti javascript: atau data:text/html
// sehingga URL dari basis data perlu divalidasi protokolnya lebih dulu.
function safeUrl(url) {
  if (!url) return '';
  const bersih = String(url).trim();
  // Izinkan hanya protokol yang wajar untuk tautan & gambar
  if (/^(https?:|mailto:|tel:|\/|#|data:image\/)/i.test(bersih)) {
    return escHtml(bersih);
  }
  return '';   // protokol tidak dikenal -> buang
}

// ── Helper: format Rupiah ──
function fmtRp(n) {
  if (!n && n !== 0) return 'Rp —';
  if (n >= 1e9) return 'Rp ' + (n/1e9).toFixed(2).replace(/\.?0+$/, '') + ' M';
  // Tampilkan satu desimal jika tidak bulat (misal Rp 1,5 jt bukan Rp 2 jt)
  if (n >= 1e6) return 'Rp ' + (n/1e6).toFixed(1).replace(/\.0$/, '') + ' jt';
  return 'Rp ' + n.toLocaleString('id-ID');
}

// ── Helper: format tanggal Indonesia ──
// Parse manual untuk menghindari bug UTC midnight di browser (new Date('YYYY-MM-DD')
// diparsing sebagai UTC, bisa menjadi tanggal sebelumnya di timezone WIB +7)
function fmtTgl(str) {
  if (!str) return '';
  const bln = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const parts = str.split('-');
  if (parts.length < 3) return str;
  const tgl = parseInt(parts[2], 10);
  const bln_ = parseInt(parts[1], 10) - 1;
  const thn  = parseInt(parts[0], 10);
  if (isNaN(tgl) || isNaN(bln_) || isNaN(thn)) return str;
  return tgl + ' ' + bln[bln_] + ' ' + thn;
}

// ── Badge class per kategori ──
function badgeClass(k) {
  return ({
    Pemerintahan: 'tag-green',
    Pengumuman:   'tag-sky',
    Kegiatan:     'tag-teal',
    Kesehatan:    'tag-sky',
    Pendidikan:   'tag-gold',
    Lingkungan:   'tag-teal',
    Sosial:       'tag-sky',
    Pembangunan:  'tag-teal',
    Pertanian:    'tag-green',
    Kelautan:     'tag-sky',
  })[k] || 'tag-green';
}

// ── Helper: potensi color class ──
function potensiClass(kat) {
  return ({
    Pertanian: 'pt-green', Kelautan: 'pt-sky',
    UMKM: 'pt-gold', 'Wisata Religi': 'pt-teal',
    'Seni & Budaya': 'pt-plum', Lainnya: 'pt-green'
  })[kat] || 'pt-green';
}

// ════════════════════
// LOAD BERITA
// ════════════════════
async function loadBerita() {
  const el = document.getElementById('berita-grid');
  if (!el) return;
  const { data, error } = await sb.from('berita')
    .select('*')
    .eq('aktif', true)
    .order('tanggal', { ascending: false })
    .limit(6);

  if (error) {
    console.error('Gagal memuat berita:', error);
    renderDataState(el, 'error', 'Berita belum dapat dimuat.');
    return;
  }
  if (!data || data.length === 0) {
    _beritaList = [];
    renderDataState(el, 'empty', 'Belum ada berita yang dipublikasikan.');
    return;
  }

  // Simpan data global untuk navigasi modal
  _beritaList = data;

  const BADGE_MAP = {
    Pemerintahan:'tag-green', Pengumuman:'tag-sky', Kegiatan:'tag-teal',
    Kesehatan:'tag-sky', Pendidikan:'tag-gold', Lingkungan:'tag-teal',
  };
  el.innerHTML = data.map((b, i) => {
    const isiPotong = b.isi ? escHtml(b.isi).substring(0, 160) + (b.isi.length > 160 ? '…' : '') : '';
    const gambarHtml = b.gambar_url
      ? `<img src="${safeUrl(b.gambar_url)}" alt="${escHtml(b.judul)}" loading="lazy" decoding="async"
           style="width:100%;height:140px;object-fit:cover;border-radius:8px;margin-bottom:12px;"
           onerror="this.remove()" />`
      : '';
    return `
    <div class="news-card" onclick="openBeritaModal(${i})" role="button" tabindex="0"
         onkeydown="if(event.key==='Enter')openBeritaModal(${i})"
         style="cursor:pointer;" aria-label="Baca berita: ${escHtml(b.judul)}">
      ${gambarHtml}
      <span class="news-tag ${BADGE_MAP[b.kategori]||'tag-green'}">${escHtml(b.kategori)}</span>
      <h3>${escHtml(b.judul)}</h3>
      <p>${isiPotong}</p>
      <div class="news-meta">
        <i class="fa-regular fa-calendar"></i> ${fmtTgl(b.tanggal)}
        <span style="margin-left:auto;font-size:12px;color:var(--emerald);font-weight:500;">
          Baca selengkapnya <i class="fa-solid fa-arrow-right" style="font-size:10px;"></i>
        </span>
      </div>
    </div>`;
  }).join('');
}

// ════════════════════
// MODAL DETAIL BERITA
// ════════════════════
const BADGE_BERITA_MAP = {
  Pemerintahan:'tag-green', Pengumuman:'tag-sky', Kegiatan:'tag-teal',
  Kesehatan:'tag-sky', Pendidikan:'tag-gold', Lingkungan:'tag-teal',
};

function openBeritaModal(idx) {
  _beritaIndex = idx;
  _renderBeritaModal();
  const modal = document.getElementById('beritaModal');
  modal.classList.add('open');
  activateDialog(modal, modal.querySelector('.bm-close'));
  document.body.style.overflow = 'hidden';
  // Scroll panel ke atas
  document.getElementById('bm-body').scrollTop = 0;
}

function closeBeritaModal() {
  const modal = document.getElementById('beritaModal');
  modal?.classList.remove('open');
  document.body.style.overflow = '';
  deactivateDialog(modal);
}

function navBerita(dir) {
  const next = _beritaIndex + dir;
  if (next < 0 || next >= _beritaList.length) return;
  _beritaIndex = next;
  _renderBeritaModal();
  document.getElementById('bm-body').scrollTop = 0;
}

function _renderBeritaModal() {
  const b = _beritaList[_beritaIndex];
  if (!b) return;

  const total = _beritaList.length;

  // Update navigasi
  document.getElementById('bm-counter').textContent = `${_beritaIndex + 1} / ${total}`;
  document.getElementById('bm-prev').disabled = _beritaIndex === 0;
  document.getElementById('bm-next').disabled = _beritaIndex === total - 1;

  // Gambar header
  const imgWrap = document.getElementById('bm-img-wrap');
  if (b.gambar_url) {
    imgWrap.innerHTML = `<img src="${safeUrl(b.gambar_url)}" alt="${escHtml(b.judul)}"
      onerror="this.parentElement.innerHTML='<div class=bm-img-placeholder><i class=fa-solid\\ fa-newspaper></i></div>'" />`;
  } else {
    imgWrap.innerHTML = `<div class="bm-img-placeholder"><i class="fa-solid fa-newspaper"></i></div>`;
  }

  // Badge kategori
  const badge = document.getElementById('bm-kategori');
  badge.textContent = b.kategori || 'Umum';
  badge.className = 'bm-badge ' + (BADGE_BERITA_MAP[b.kategori] || 'tag-green');

  // Meta
  document.getElementById('bm-tanggal').textContent = fmtTgl(b.tanggal);
  document.getElementById('bm-judul').textContent   = b.judul || '';
  document.getElementById('bm-isi').textContent     = b.isi   || '(Isi berita belum tersedia)';

  // Simpan judul untuk share
  document.getElementById('beritaModal').dataset.judul = b.judul || '';
}

function shareBeritaWA() {
  const judul = document.getElementById('beritaModal').dataset.judul || 'Berita Desa Kandeman';
  const url   = encodeURIComponent(window.location.href + '#informasi');
  const text  = encodeURIComponent(`*${judul}*\nBaca selengkapnya di website Desa Kandeman:\n${decodeURIComponent(url)}`);
  const shareWindow = window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  if (shareWindow) shareWindow.opener = null;
}

async function copyBeritaLink() {
  const url = window.location.href.split('#')[0] + '#informasi';
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url);
      const btn = document.getElementById('bm-copy-btn');
      if (btn) {
        const original = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check" style="color:#1C6B3E;"></i> Tersalin!';
        setTimeout(() => { btn.innerHTML = original; }, 2000);
      }
      return;
    }
    window.prompt('Salin tautan berikut:', url);
  } catch (error) {
    console.error('Gagal menyalin tautan:', error);
    window.prompt('Salin tautan berikut:', url);
  }
}

// Tutup modal dengan Escape
document.addEventListener('keydown', e => {
  const modal = document.getElementById('beritaModal');
  if (!modal || !modal.classList.contains('open')) return;
  if (e.key === 'Escape')     closeBeritaModal();
  if (e.key === 'ArrowLeft')  navBerita(-1);
  if (e.key === 'ArrowRight') navBerita(1);
});

// ════════════════════
// LOAD GALERI + LIGHTBOX
// ════════════════════
let _galeriData = []; // simpan untuk navigasi lightbox
let _lbIndex    = 0;

async function loadGaleri() {
  const el = document.getElementById('galeri-grid');
  if (!el) return;
  const { data, error } = await sb.from('galeri')
    .select('*')
    .eq('aktif', true)
    .order('created_at', { ascending: false })
    .limit(9);

  if (error) {
    console.error('Gagal memuat galeri:', error);
    renderDataState(el, 'error', 'Galeri belum dapat dimuat.');
    return;
  }
  if (!data || data.length === 0) {
    _galeriData = [];
    renderDataState(el, 'empty', 'Belum ada foto galeri yang dipublikasikan.');
    return;
  }

  _galeriData = data.filter(g => g.url_foto); // hanya yang punya foto
  const cols = ['g1','g2','g3','g4','g5','g6'];
  el.innerHTML = data.map((g, i) => {
    const cls      = cols[i % 6];
    const fotoUrl  = escHtml(g.url_foto || '');
    const label    = escHtml(g.judul || g.keterangan || '');
    const lbIdx    = _galeriData.findIndex(x => x.id === g.id);
    if (fotoUrl) {
      return `<div class="galeri-item ${cls}" role="button" tabindex="0" aria-label="Buka foto: ${label}"
        style="cursor:pointer;"
        onclick="openLightbox(${lbIdx >= 0 ? lbIdx : 0})"
        onkeydown="if(event.key==='Enter')openLightbox(${lbIdx >= 0 ? lbIdx : 0})">
        <img src="${fotoUrl}" alt="${label}" loading="lazy" decoding="async"
          style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;"
          onerror="this.parentElement.querySelector('.galeri-label').style.transform='translateY(0)';this.style.display='none'" />
        <div class="galeri-label">${label}</div>
      </div>`;
    }
    return `<div class="galeri-item ${cls}" style="display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px;">
      <span style="font-size:32px;">📷</span>
      <span style="font-size:11px;color:var(--text-muted);">${label}</span>
    </div>`;
  }).join('');
}


/* Poster edukasi — dibuka di lightbox yang sama dengan galeri. */
let _posterList = [];
function bukaPoster(idx) {
  if (!_posterList.length) return;
  openLightbox(idx, _posterList);
}

// ── Lightbox controls ──
/* Daftar yang sedang ditampilkan lightbox.
   Tiap item: { src, judul }. Diisi dari galeri atau poster. */
let _lbList = [];

function openLightbox(idx, daftar) {
  _lbList = daftar && daftar.length
    ? daftar
    : _galeriData.map(g => ({ src: g.url_foto, judul: g.judul || g.keterangan || '' }));
  if (!_lbList.length) return;
  _lbIndex = Math.max(0, Math.min(idx, _lbList.length - 1));
  renderLightbox();
  const lightbox = document.getElementById('lightbox');
  lightbox.classList.add('open');
  activateDialog(lightbox, lightbox.querySelector('.lightbox-close'));
  document.body.style.overflow = 'hidden';
}

function closeLightbox(e) {
  // Dipanggil tanpa argumen = dari tombol close (selalu tutup)
  // Dipanggil dengan event = dari click pada overlay (hanya tutup jika klik di luar)
  if (e && e.target !== document.getElementById('lightbox')) return;
  const lightbox = document.getElementById('lightbox');
  lightbox?.classList.remove('open');
  document.body.style.overflow = '';
  deactivateDialog(lightbox);
}

function lbNav(dir) {
  if (!_lbList.length) return;
  _lbIndex = (_lbIndex + dir + _lbList.length) % _lbList.length;
  renderLightbox();
}

function renderLightbox() {
  const g = _lbList[_lbIndex];
  if (!g) return;
  const img = document.getElementById('lb-img');
  img.style.opacity = '0';
  img.src = g.src;
  img.onload = () => { img.style.transition = 'opacity .2s'; img.style.opacity = '1'; };
  document.getElementById('lb-caption').textContent = g.judul || '';
  document.getElementById('lb-counter').textContent = `${_lbIndex+1} / ${_lbList.length}`;
  // Sembunyikan tombol navigasi bila hanya satu gambar
  document.querySelectorAll('.lightbox-nav')
    .forEach(n => n.style.display = _lbList.length > 1 ? '' : 'none');
}

// Keyboard navigation lightbox
document.addEventListener('keydown', e => {
  const lb = document.getElementById('lightbox');
  if (!lb || !lb.classList.contains('open')) return;
  if (e.key === 'ArrowRight') lbNav(1);
  if (e.key === 'ArrowLeft')  lbNav(-1);
  if (e.key === 'Escape') {
    lb.classList.remove('open');
    document.body.style.overflow = '';
    deactivateDialog(lb);
  }
});

// ════════════════════
// LOAD PERANGKAT
// ════════════════════
// Urutan jabatan resmi
const JABATAN_ORDER = [
  'Kepala Desa','Sekretaris Desa',
  'Kaur Tata Usaha & Umum','Kaur Keuangan','Kaur Perencanaan',
  'Kasi Pemerintahan','Kasi Kesejahteraan','Kasi Pelayanan',
  'Kepala Dusun 1','Kepala Dusun 2','Kepala Dusun 3','Kepala Dusun 4',
];
function jabatanRank(jabatan) {
  const value = String(jabatan || '').toLowerCase();
  const idx = JABATAN_ORDER.findIndex(j => value.includes(j.toLowerCase()));
  return idx >= 0 ? idx : 99;
}

async function loadPerangkat() {
  const tbody = document.getElementById('perangkat-tbody');
  if (!tbody) return;
  const { data, error } = await sb.from('perangkat')
    .select('*')
    .eq('aktif', true)
    .order('urutan')
    .order('created_at');
  
  // Sort di sisi klien berdasarkan hierarki jabatan resmi
  if (data) data.sort((a, b) => {
    const ra = jabatanRank(a.jabatan), rb = jabatanRank(b.jabatan);
    if (ra !== rb) return ra - rb;
    return (a.urutan || 99) - (b.urutan || 99);
  });

  if (error) {
    console.error('Gagal memuat perangkat desa:', error);
    resetOrgChart();
    renderDataState(tbody, 'error', 'Data perangkat desa belum dapat dimuat.', { colspan: 4 });
    return;
  }
  if (!data || data.length === 0) {
    resetOrgChart();
    renderDataState(tbody, 'empty', 'Belum ada data perangkat desa.', { colspan: 4 });
    return;
  }

  // ── Isi nama + foto ke org chart ──
  const orgMap = {
    'kepala desa':           { nameId: 'kades-name-org',  avatarId: 'kades-avatar-org',  initials: 'BW' },
    'sekretaris desa':       { nameId: 'sekdes-name-org', avatarId: 'sekdes-avatar-org', initials: 'TM' },
    'kaur tata usaha':       { nameId: 'kaur-tu-name',    avatarId: 'kaur-tu-av',        initials: 'TU' },
    'kaur tu & umum':        { nameId: 'kaur-tu-name',    avatarId: 'kaur-tu-av',        initials: 'TU' },
    'kaur tu dan umum':      { nameId: 'kaur-tu-name',    avatarId: 'kaur-tu-av',        initials: 'TU' },
    'kaur keuangan':         { nameId: 'kaur-ku-name',    avatarId: 'kaur-ku-av',        initials: 'KU' },
    'kaur perencanaan':      { nameId: 'kaur-kp-name',    avatarId: 'kaur-kp-av',        initials: 'KP' },
    'kasi pemerintahan':     { nameId: 'kasi-pm-name',    avatarId: 'kasi-pm-av',        initials: 'KP' },
    'kasi kesejahteraan':    { nameId: 'kasi-ks-name',    avatarId: 'kasi-ks-av',        initials: 'KS' },
    'kasi pelayanan':        { nameId: 'kasi-pl-name',    avatarId: 'kasi-pl-av',        initials: 'KL' },
    'kepala dusun randusari':  { nameId: 'kadus1-name', avatarId: 'kadus1-av', initials: 'D1' },
    'kadus randusari':         { nameId: 'kadus1-name', avatarId: 'kadus1-av', initials: 'D1' },
    'kepala dusun kandeman':   { nameId: 'kadus2-name', avatarId: 'kadus2-av', initials: 'D2' },
    'kadus kandeman':          { nameId: 'kadus2-name', avatarId: 'kadus2-av', initials: 'D2' },
    'kepala dusun gandok':     { nameId: 'kadus3-name', avatarId: 'kadus3-av', initials: 'D3' },
    'kadus gandok':            { nameId: 'kadus3-name', avatarId: 'kadus3-av', initials: 'D3' },
    'kepala dusun kaliongkek': { nameId: 'kadus4-name', avatarId: 'kadus4-av', initials: 'D4' },
    'kadus kaliongkek':        { nameId: 'kadus4-name', avatarId: 'kadus4-av', initials: 'D4' },
    'kepala dusun johosari':   { nameId: 'kadus5-name', avatarId: 'kadus5-av', initials: 'D5' },
    'kadus johosari':          { nameId: 'kadus5-name', avatarId: 'kadus5-av', initials: 'D5' },
    'kepala dusun 1':          { nameId: 'kadus1-name', avatarId: 'kadus1-av', initials: 'D1' },
    'kepala dusun 2':          { nameId: 'kadus2-name', avatarId: 'kadus2-av', initials: 'D2' },
    'kepala dusun 3':          { nameId: 'kadus3-name', avatarId: 'kadus3-av', initials: 'D3' },
    'kepala dusun 4':          { nameId: 'kadus4-name', avatarId: 'kadus4-av', initials: 'D4' },
    'kepala dusun 5':          { nameId: 'kadus5-name', avatarId: 'kadus5-av', initials: 'D5' },
  };
  data.forEach(p => {
    const key = String(p.jabatan || '').toLowerCase().trim();
    const map = orgMap[key];
    if (!map) return;

    // Isi nama
    const nameEl = document.getElementById(map.nameId);
    if (nameEl) {
      const nama = String(p.nama || '').replace(/\[.*?\]/g, '').trim();
      nameEl.textContent = nama || '–';
    }

    // Isi avatar: foto jika ada, inisial sebagai fallback
    const avEl = document.getElementById(map.avatarId);
    if (avEl) {
      if (p.foto_url) {
        avEl.innerHTML = `<img src="${safeUrl(p.foto_url)}" alt="${escHtml(p.nama)}"
          style="width:100%;height:100%;object-fit:cover;border-radius:50%;"
          onerror="this.parentElement.textContent='${escHtml(map.initials)}'" />`;
        avEl.style.padding = '0';
        avEl.style.overflow = 'hidden';
      } else {
        avEl.textContent = map.initials;
      }
    }
  });

  function bidangBadge(jabatan) {
    const j = String(jabatan || '').toLowerCase();
    if (j.includes('kepala desa') || j.includes('kades')) return '<span class="badge badge-green">Pimpinan</span>';
    if (j.includes('sekretaris') || j.includes('sekdes')) return '<span class="badge badge-sky">Sekretariat</span>';
    if (j.includes('kaur')) return '<span class="badge badge-gold">Urusan</span>';
    if (j.includes('kasi')) return '<span class="badge badge-teal">Seksi</span>';
    if (j.includes('dusun') || j.includes('kadus')) return '<span class="badge badge-green">Dusun</span>';
    return '<span class="badge badge-sky">Perangkat</span>';
  }

  tbody.innerHTML = data.map((p, i) => {
    const fotoHtml = p.foto_url
      ? `<img src="${safeUrl(p.foto_url)}" alt="${escHtml(p.nama)}" loading="lazy" decoding="async"
           style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:1.5px solid var(--border);vertical-align:middle;margin-right:10px;"
           onerror="this.style.display='none'" />`
      : `<span style="display:inline-flex;width:36px;height:36px;border-radius:50%;background:var(--cream);border:1.5px solid var(--border);align-items:center;justify-content:center;color:var(--text-muted);font-size:11px;font-weight:700;margin-right:10px;vertical-align:middle;flex-shrink:0;">${escHtml(String(p.nama || '').slice(0,2).toUpperCase())}</span>`;
    return `<tr>
      <td>${i + 1}</td>
      <td style="font-weight:500;white-space:nowrap;">${fotoHtml}<span style="vertical-align:middle;">${escHtml(p.nama)}</span></td>
      <td>${escHtml(p.jabatan)}</td>
      <td>${bidangBadge(p.jabatan)}</td>
    </tr>`;
  }).join('');
}

// ════════════════════
// LOAD APBDES — format Laporan Realisasi APB Desa (LRA)
// ════════════════════
const LRA_PUBLIC_SECTIONS = {
  pendapatan: [
    ['pad', 'Pendapatan Asli Desa'], ['dana_desa', 'Dana Desa'],
    ['bagi_hasil', 'Bagi Hasil Pajak dan Retribusi'], ['add', 'Alokasi Dana Desa'],
    ['bantuan_provinsi', 'Bantuan Keuangan Provinsi'], ['bantuan_kabupaten', 'Bantuan Keuangan Kabupaten/Kota'],
    ['lain_lain', 'Pendapatan Lain-lain'],
  ],
  belanja: [
    ['penyelenggaraan', 'Penyelenggaraan Pemerintahan'], ['pelaksanaan', 'Pelaksanaan Pembangunan'],
    ['pembinaan', 'Pembinaan Kemasyarakatan'], ['pemberdayaan', 'Pemberdayaan Masyarakat'],
    ['penanggulangan_bencana', 'Penanggulangan Bencana'],
  ],
  pembiayaan: [['penerimaan', 'Penerimaan Pembiayaan'], ['pengeluaran', 'Pengeluaran Pembiayaan']],
};
const lraPublicNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const lraPublicTotal = (data, section, column) => LRA_PUBLIC_SECTIONS[section]
  .reduce((sum, [key]) => sum + lraPublicNumber(data[section]?.[key]?.[column]), 0);
const fmtRpFull = value => {
  const number = lraPublicNumber(value);
  return `${number < 0 ? '- ' : ''}Rp ${Math.abs(number).toLocaleString('id-ID')}`;
};
const fmtRpSignedCompact = value => lraPublicNumber(value) < 0 ? `- ${fmtRp(Math.abs(lraPublicNumber(value)))}` : fmtRp(value);
const lraPublicPercent = (part, total) => total ? `${Math.round(part / total * 10000) / 100}%` : '—';
const LRA_PUBLIC_VIEW_META = {
  pendapatan: {
    overviewLabel: 'Pendapatan terealisasi', progressLabel: 'tercapai', comparisonPrefix: 'dari target pendapatan',
    breakdownTitle: 'Realisasi sumber pendapatan', breakdownCaption: 'Capaian setiap sumber penerimaan desa.',
    legend: 'Pendapatan diterima', emptyMessage: 'Belum ada data realisasi pendapatan.',
  },
  belanja: {
    overviewLabel: 'Belanja terealisasi', progressLabel: 'terserap', comparisonPrefix: 'dari anggaran belanja',
    breakdownTitle: 'Realisasi per bidang belanja', breakdownCaption: 'Lihat penyerapan dana pada setiap bidang.',
    legend: 'Dana terpakai', emptyMessage: 'Belum ada data realisasi belanja.',
  },
  pembiayaan: {
    overviewLabel: 'Aktivitas pembiayaan terealisasi', progressLabel: 'terealisasi', comparisonPrefix: 'dari total aktivitas pembiayaan',
    breakdownTitle: 'Realisasi komponen pembiayaan', breakdownCaption: 'Perbandingan penerimaan dan pengeluaran pembiayaan.',
    legend: 'Pembiayaan terealisasi', emptyMessage: 'Belum ada data realisasi pembiayaan.',
  },
};
let _activeLraPublicCategory = 'belanja';
let _latestLraPublicView = null;
let _lraPublicStatus = 'loading';

function setLraPublicText(id, text) {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
}

function setLraPublicIcon(id, iconClass) {
  const element = document.getElementById(id);
  if (element) element.className = `fa-solid ${iconClass}`;
}

function setLraPublicStat(index, { label, value, note, icon }) {
  setLraPublicText(`apb-stat-${index}-label`, label);
  setLraPublicText(`apb-stat-${index}-value`, value);
  setLraPublicText(`apb-stat-${index}-note`, note);
  setLraPublicIcon(`apb-stat-${index}-icon`, icon);
}

function renderEmptyLraPublicCategory(category) {
  const meta = LRA_PUBLIC_VIEW_META[category];
  const unavailable = _lraPublicStatus === 'error';
  setLraPublicText('apb-overview-label', meta.overviewLabel);
  setLraPublicText('apb-overview-percent', '—');
  setLraPublicText('apb-overview-progress-label', meta.progressLabel);
  setLraPublicText('apb-overview-nominal', 'Rp —');
  setLraPublicText('apb-overview-comparison', unavailable ? 'Data anggaran belum dapat dimuat' : 'Belum ada data anggaran');
  setLraPublicText('apb-breakdown-title', meta.breakdownTitle);
  setLraPublicText('apb-breakdown-caption', meta.breakdownCaption);
  setLraPublicText('apb-breakdown-legend', meta.legend);
  const progress = document.getElementById('apb-realisasi-progress');
  if (progress) {
    progress.style.setProperty('--progress', 0);
    progress.setAttribute('aria-label', unavailable ? 'Data realisasi belum dapat dimuat' : 'Data realisasi belum tersedia');
  }
  const list = document.getElementById('apb-realisasi-list');
  if (list) {
    list.innerHTML = `<div class="realisasi-loading"><i class="fa-solid ${unavailable ? 'fa-triangle-exclamation' : 'fa-circle-info'}"></i>${unavailable ? 'Data realisasi belum dapat dimuat.' : meta.emptyMessage}</div>`;
  }
  setLraPublicStat(1, { label: 'Anggaran', value: 'Rp —', note: 'Data belum tersedia', icon: 'fa-chart-column' });
  setLraPublicStat(2, { label: 'Realisasi', value: 'Rp —', note: 'Data belum tersedia', icon: 'fa-wallet' });
  setLraPublicStat(3, { label: 'Selisih', value: 'Rp —', note: 'Data belum tersedia', icon: 'fa-scale-balanced' });
}

function renderLraPublicCategory(category = _activeLraPublicCategory) {
  if (!LRA_PUBLIC_VIEW_META[category]) return;
  _activeLraPublicCategory = category;
  const panel = document.getElementById('realisasi');
  if (panel) panel.dataset.category = category;
  document.querySelectorAll('[data-realisasi-category]').forEach(tab => {
    const active = tab.dataset.realisasiCategory === category;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });

  if (!_latestLraPublicView) {
    renderEmptyLraPublicCategory(category);
    return;
  }

  const meta = LRA_PUBLIC_VIEW_META[category];
  const { lra, tahun, pendapatanAnggaran, pendapatanRealisasi, belanjaAnggaran, belanjaRealisasi,
    pembiayaanAnggaran, pembiayaanRealisasi, surplusRealisasi, silpaRealisasi } = _latestLraPublicView;
  const anggaran = lraPublicTotal(lra, category, 'anggaran');
  const realisasi = lraPublicTotal(lra, category, 'realisasi');
  const progressValue = anggaran > 0 ? Math.max(0, Math.min(100, realisasi / anggaran * 100)) : 0;

  setLraPublicText('apb-overview-label', meta.overviewLabel);
  setLraPublicText('apb-overview-percent', lraPublicPercent(realisasi, anggaran));
  setLraPublicText('apb-overview-progress-label', meta.progressLabel);
  setLraPublicText('apb-overview-nominal', fmtRp(realisasi));
  setLraPublicText('apb-overview-comparison', `${meta.comparisonPrefix} ${fmtRp(anggaran)}`);
  setLraPublicText('apb-breakdown-title', meta.breakdownTitle);
  setLraPublicText('apb-breakdown-caption', meta.breakdownCaption);
  setLraPublicText('apb-breakdown-legend', meta.legend);

  const progress = document.getElementById('apb-realisasi-progress');
  if (progress) {
    progress.style.setProperty('--progress', progressValue);
    progress.setAttribute('aria-label', `${meta.overviewLabel} ${lraPublicPercent(realisasi, anggaran)}`);
  }

  if (category === 'pendapatan') {
    const targetGap = pendapatanAnggaran - pendapatanRealisasi;
    setLraPublicStat(1, {
      label: 'Anggaran pendapatan', value: fmtRp(pendapatanAnggaran), note: `Target Tahun ${tahun}`, icon: 'fa-chart-column',
    });
    setLraPublicStat(2, {
      label: targetGap >= 0 ? 'Sisa target pendapatan' : 'Pendapatan di atas target', value: fmtRp(Math.abs(targetGap)),
      note: targetGap >= 0 ? 'Belum terealisasi' : 'Melebihi target', icon: targetGap >= 0 ? 'fa-bullseye' : 'fa-arrow-trend-up',
    });
    setLraPublicStat(3, {
      label: surplusRealisasi >= 0 ? 'Surplus realisasi' : 'Defisit realisasi', value: fmtRp(Math.abs(surplusRealisasi)),
      note: 'Pendapatan dikurangi belanja', icon: 'fa-scale-balanced',
    });
  } else if (category === 'belanja') {
    const belanjaGap = belanjaAnggaran - belanjaRealisasi;
    setLraPublicStat(1, {
      label: 'Realisasi pendapatan', value: lraPublicPercent(pendapatanRealisasi, pendapatanAnggaran),
      note: fmtRp(pendapatanRealisasi), icon: 'fa-arrow-trend-up',
    });
    setLraPublicStat(2, {
      label: belanjaGap >= 0 ? 'Sisa anggaran belanja' : 'Belanja di atas anggaran', value: fmtRp(Math.abs(belanjaGap)),
      note: belanjaGap >= 0 ? 'Belum digunakan' : 'Melebihi anggaran', icon: 'fa-wallet',
    });
    setLraPublicStat(3, {
      label: 'SiLPA tahun berjalan', value: fmtRpSignedCompact(silpaRealisasi), note: 'Setelah pembiayaan netto', icon: 'fa-scale-balanced',
    });
  } else {
    setLraPublicStat(1, {
      label: 'Anggaran pembiayaan netto', value: fmtRpSignedCompact(pembiayaanAnggaran),
      note: 'Penerimaan dikurangi pengeluaran', icon: 'fa-chart-column',
    });
    setLraPublicStat(2, {
      label: 'Realisasi pembiayaan netto', value: fmtRpSignedCompact(pembiayaanRealisasi),
      note: 'Nilai bersih yang terealisasi', icon: 'fa-money-bill-transfer',
    });
    setLraPublicStat(3, {
      label: 'SiLPA tahun berjalan', value: fmtRpSignedCompact(silpaRealisasi), note: 'Surplus/defisit ditambah pembiayaan netto', icon: 'fa-scale-balanced',
    });
  }

  const list = document.getElementById('apb-realisasi-list');
  if (!list) return;
  list.innerHTML = LRA_PUBLIC_SECTIONS[category].map(([key, label], index) => {
    const rowAnggaran = lra[category][key].anggaran;
    const rowRealisasi = lra[category][key].realisasi;
    const rowProgress = rowAnggaran > 0 ? Math.max(0, Math.min(100, rowRealisasi / rowAnggaran * 100)) : 0;
    const progressState = rowAnggaran <= 0 ? ' is-empty' : rowRealisasi > rowAnggaran ? ' is-over' : '';
    return `<div class="realisasi-row realisasi-row-enter${progressState}" style="--row-index:${index}">
      <div class="realisasi-row-top">
        <span class="realisasi-row-label">${escHtml(label)}</span>
        <span class="realisasi-row-percent">${lraPublicPercent(rowRealisasi, rowAnggaran)}<small> ${meta.progressLabel}</small></span>
      </div>
      <div class="realisasi-row-bar" aria-hidden="true"><span style="--progress:${rowProgress}"></span></div>
      <div class="realisasi-row-meta">
        <span class="realisasi-row-meta-item"><small>Realisasi</small><strong>${fmtRp(rowRealisasi)}</strong></span>
        <span class="realisasi-row-meta-item"><small>Anggaran</small><strong>${fmtRp(rowAnggaran)}</strong></span>
      </div>
    </div>`;
  }).join('');
}

function setActiveLraPublicCategory(category, focusTab = false) {
  if (!LRA_PUBLIC_VIEW_META[category]) return;
  renderLraPublicCategory(category);
  if (focusTab) document.querySelector(`[data-realisasi-category="${category}"]`)?.focus();
}

function initLraPublicTabs() {
  const tabs = [...document.querySelectorAll('[data-realisasi-category]')];
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => setActiveLraPublicCategory(tab.dataset.realisasiCategory));
    tab.addEventListener('keydown', event => {
      let targetIndex = null;
      if (event.key === 'ArrowRight') targetIndex = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') targetIndex = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') targetIndex = 0;
      if (event.key === 'End') targetIndex = tabs.length - 1;
      if (targetIndex === null) return;
      event.preventDefault();
      setActiveLraPublicCategory(tabs[targetIndex].dataset.realisasiCategory, true);
    });
  });
}

function normaliseLraData(record = {}) {
  const lra = record.lra_data && typeof record.lra_data === 'object' ? record.lra_data : {};
  const legacyIncome = { pad: record.pendapatan_pades, dana_desa: record.pendapatan_dd, bagi_hasil: record.pendapatan_pajak, add: record.pendapatan_add };
  const legacyExpense = { penyelenggaraan: record.nominal_pemerintahan, pelaksanaan: record.nominal_pembangunan, pembinaan: record.nominal_pembinaan, pemberdayaan: record.nominal_pemberdayaan };
  const legacyExpenseRealisasi = {
    penyelenggaraan: Math.max(0, lraPublicNumber(record.realisasi_belanja) - lraPublicNumber(record.realisasi_pembangunan) - lraPublicNumber(record.realisasi_pemberdayaan)),
    pelaksanaan: record.realisasi_pembangunan, pemberdayaan: record.realisasi_pemberdayaan,
  };
  return Object.fromEntries(Object.entries(LRA_PUBLIC_SECTIONS).map(([section, rows]) => [section,
    Object.fromEntries(rows.map(([key]) => [key, {
      anggaran: lraPublicNumber(lra[section]?.[key]?.anggaran ?? (section === 'pendapatan' ? legacyIncome[key] : legacyExpense[key])),
      realisasi: lraPublicNumber(lra[section]?.[key]?.realisasi ?? (section === 'pendapatan' && key === 'pad' ? record.realisasi_pendapatan : section === 'belanja' ? legacyExpenseRealisasi[key] : 0)),
    }]))
  ]));
}

function resetApbdesData(status = 'empty') {
  const unavailable = status === 'error';
  _latestLraPublicView = null;
  _lraPublicStatus = status;
  document.getElementById('apb-val').textContent = 'Rp —';
  document.getElementById('apb-tahun-lbl').textContent = 'Anggaran Pendapatan APBDes';
  document.getElementById('apb-sub').textContent = unavailable ? 'Data belum dapat dimuat' : 'Belum ada data yang dipublikasikan';
  document.getElementById('apb-alokasi').innerHTML = `<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:13px;"><i class="fa-solid ${unavailable ? 'fa-triangle-exclamation' : 'fa-circle-info'}" style="margin-right:6px;opacity:.5;"></i>${unavailable ? 'Data APBDes belum dapat dimuat.' : 'Data APBDes belum tersedia.'}</div>`;
  renderEmptyLraPublicCategory(_activeLraPublicCategory);
}

async function loadApbdes() {
  const { data, error } = await sb.from('apbdes').select('*').order('tahun', { ascending: false }).limit(1);
  if (error || !data?.length) {
    if (error) console.error('Gagal memuat APBDes:', error);
    resetApbdesData(error ? 'error' : 'empty');
    return;
  }
  const d = data[0];
  const lra = normaliseLraData(d);
  const pendapatanAnggaran = lraPublicTotal(lra, 'pendapatan', 'anggaran');
  const pendapatanRealisasi = lraPublicTotal(lra, 'pendapatan', 'realisasi');
  const belanjaAnggaran = lraPublicTotal(lra, 'belanja', 'anggaran');
  const belanjaRealisasi = lraPublicTotal(lra, 'belanja', 'realisasi');
  const pembiayaanAnggaran = lra.pembiayaan.penerimaan.anggaran - lra.pembiayaan.pengeluaran.anggaran;
  const pembiayaanRealisasi = lra.pembiayaan.penerimaan.realisasi - lra.pembiayaan.pengeluaran.realisasi;
  const surplusAnggaran = pendapatanAnggaran - belanjaAnggaran;
  const surplusRealisasi = pendapatanRealisasi - belanjaRealisasi;
  const silpaAnggaran = surplusAnggaran + pembiayaanAnggaran;
  const silpaRealisasi = surplusRealisasi + pembiayaanRealisasi;
  document.getElementById('apb-val').textContent = fmtRp(pendapatanAnggaran);
  document.getElementById('apb-tahun-lbl').textContent = `Anggaran Pendapatan APBDes ${d.tahun}`;
  document.getElementById('apb-sub').textContent = `Realisasi pendapatan: ${fmtRp(pendapatanRealisasi)} (${lraPublicPercent(pendapatanRealisasi, pendapatanAnggaran)})`;
  document.getElementById('apb-section-sub').textContent = `Informasi APBDes dan realisasi anggaran Desa Kandeman Tahun Anggaran ${d.tahun}.`;

  const barClasses = ['bf-green', 'bf-sky', 'bf-gold', 'bf-teal', 'bf-plum'];
  document.getElementById('apb-alokasi').innerHTML = LRA_PUBLIC_SECTIONS.belanja.map(([key, label], index) => {
    const nominal = lra.belanja[key].anggaran;
    const width = belanjaAnggaran ? nominal / belanjaAnggaran * 100 : 0;
    return `<div class="budget-item"><div class="budget-header"><span>${label}</span><span>${fmtRp(nominal)} (${Math.round(width * 10) / 10}%)</span></div><div class="budget-bar"><div class="budget-fill bar-fill ${barClasses[index]}" style="--target-w:${width}%"></div></div></div>`;
  }).join('');
  observeBars();
  _latestLraPublicView = {
    lra, tahun: d.tahun, pendapatanAnggaran, pendapatanRealisasi, belanjaAnggaran, belanjaRealisasi,
    pembiayaanAnggaran, pembiayaanRealisasi, surplusRealisasi, silpaAnggaran, silpaRealisasi,
  };
  _lraPublicStatus = 'ready';
  renderLraPublicCategory(_activeLraPublicCategory);
}

// ════════════════════
// LOAD POTENSI
// ════════════════════
async function loadPotensi() {
  const el = document.getElementById('potensi-grid');
  if (!el) return;
  const { data, error } = await sb.from('potensi')
    .select('*')
    .eq('aktif', true)
    .order('urutan');

  if (error) {
    console.error('Gagal memuat potensi desa:', error);
    renderDataState(el, 'error', 'Data potensi desa belum dapat dimuat.');
    return;
  }
  if (!data || data.length === 0) {
    renderDataState(el, 'empty', 'Belum ada data potensi desa yang dipublikasikan.');
    return;
  }

  el.innerHTML = data.map(p => {
    const thumb = p.foto_url
      ? `<img src="${safeUrl(p.foto_url)}" alt="${escHtml(p.nama)}" loading="lazy" decoding="async" onerror="this.parentElement.innerHTML='${escHtml(p.emoji||'🌾')}'" />`
      : escHtml(p.emoji || '🌾');
    return `
    <div class="potensi-card">
      <div class="potensi-thumb ${potensiClass(p.kategori)}" style="font-size:32px;display:flex;align-items:center;justify-content:center;">${thumb}</div>
      <div class="potensi-body">
        <h3>${escHtml(p.nama)}</h3>
        <p>${escHtml(p.deskripsi)}</p>
      </div>
    </div>`;
  }).join('');
}

// ════════════════════
// LOAD UMKM
// ════════════════════
async function loadUmkm() {
  const el = document.getElementById('umkm-grid');
  if (!el) return;
  const { data, error } = await sb.from('umkm')
    .select('*')
    .eq('aktif', true)
    .order('created_at', { ascending:false });

  if (error) {
    console.error('Gagal memuat UMKM:', error);
    _umkmList = [];
    renderDataState(el, 'error', 'Data UMKM belum dapat dimuat.');
    return;
  }
  if (!data || data.length === 0) {
    _umkmList = [];
    renderDataState(el, 'empty', 'Belum ada UMKM yang dipublikasikan.');
    return;
  }

  _umkmList = data;

  el.innerHTML = data.map((u, i) => {
    const thumb = u.foto_url
      ? `<img src="${safeUrl(u.foto_url)}" alt="${escHtml(u.nama)}" loading="lazy" decoding="async" onerror="this.parentElement.innerHTML='<span class=umkm-cat>${escHtml(u.kategori)}</span>${escHtml(u.emoji||'🛒')}'" />`
      : escHtml(u.emoji || '🛒');
    return `
    <div class="umkm-card" onclick="openUmkmModal(${i})" role="button" tabindex="0"
         onkeydown="if(event.key==='Enter')openUmkmModal(${i})"
         aria-label="Lihat detail ${escHtml(u.nama)}">
      <div class="umkm-thumb"><span class="umkm-cat">${escHtml(u.kategori)}</span>${thumb}</div>
      <div class="umkm-body">
        <h3>${escHtml(u.nama)}</h3>
        <p>${escHtml(u.deskripsi)}</p>
        <div class="umkm-detail-cue">
          <i class="fa-solid fa-circle-info"></i> Lihat detail usaha
        </div>
      </div>
    </div>`;
  }).join('');
}

// ════════════════════
// MODAL DETAIL UMKM
// ════════════════════
function openUmkmModal(idx) {
  const u = _umkmList[idx];
  if (!u) return;

  // Hero visual
  const heroVisual = document.getElementById('um-hero-visual');
  const hero = document.getElementById('um-hero');
  if (u.foto_url) {
    heroVisual.outerHTML = `<img id="um-hero-visual" src="${safeUrl(u.foto_url)}" alt="${escHtml(u.nama)}" onerror="this.outerHTML='<span id=um-hero-visual>${escHtml(u.emoji||'🛒')}</span>'" />`;
  } else {
    heroVisual.outerHTML = `<span id="um-hero-visual">${escHtml(u.emoji || '🛒')}</span>`;
  }

  document.getElementById('um-kategori').textContent = u.kategori || 'Lainnya';
  document.getElementById('um-nama').textContent     = u.nama || '';
  document.getElementById('um-desc').textContent     = u.deskripsi || '';

  // Pemilik
  const pemWrap = document.getElementById('um-pemilik-wrap');
  if (u.pemilik) {
    document.getElementById('um-pemilik').textContent = u.pemilik;
    pemWrap.style.display = 'block';
  } else pemWrap.style.display = 'none';

  // Produk (dipisah koma)
  const prodWrap = document.getElementById('um-produk-wrap');
  const prodList = document.getElementById('um-produk-list');
  if (u.produk) {
    const items = u.produk.split(',').map(s => s.trim()).filter(Boolean);
    if (items.length) {
      prodList.innerHTML = items.map(p => `<span class="um-produk-tag">${escHtml(p)}</span>`).join('');
      prodWrap.style.display = 'block';
    } else prodWrap.style.display = 'none';
  } else prodWrap.style.display = 'none';

  // Info grid
  const rows = [];
  if (u.whatsapp) {
    const tel = normalisasiTelepon(u.whatsapp);
    if (tel) {
      const tautan = tel.wa
        ? `<a href="https://wa.me/${escHtml(tel.wa)}" target="_blank" rel="noopener noreferrer">${escHtml(tel.tampil)}</a>`
        : `<a href="tel:${escHtml(tel.tel)}">${escHtml(tel.tampil)}</a>`;
      rows.push({ icon:'fa-phone', lbl:'Kontak', val: tautan });
    }
  }
  if (u.alamat)     rows.push({ icon:'fa-location-dot', lbl:'Alamat',        val: escHtml(u.alamat) });
  if (u.jam_buka)   rows.push({ icon:'fa-clock',        lbl:'Jam Operasional', val: escHtml(u.jam_buka) });
  if (u.harga)      rows.push({ icon:'fa-tag',          lbl:'Kisaran Harga',  val: escHtml(u.harga) });
  if (u.instagram)  rows.push({ icon:'fa-hashtag',      lbl:'Media Sosial',   val:`<a href="https://instagram.com/${escHtml(u.instagram.replace('@',''))}" target="_blank" rel="noopener noreferrer">@${escHtml(u.instagram.replace('@',''))}</a>` });
  if (!rows.length) rows.push({ icon:'fa-circle-info', lbl:'Informasi', val:'Detail lengkap belum tersedia. Hubungi via WhatsApp.' });

  document.getElementById('um-info-grid').innerHTML = rows.map(r => `
    <div class="um-info-row">
      <div class="um-info-icon"><i class="fa-solid ${r.icon}"></i></div>
      <div class="um-info-text">
        <div class="lbl">${r.lbl}</div>
        <div class="val">${r.val}</div>
      </div>
    </div>`).join('');

  // Tombol WA
  const waBtn = document.getElementById('um-wa-btn');
  if (u.whatsapp) {
    const telWa = normalisasiTelepon(u.whatsapp);
    const pesan = encodeURIComponent('Halo, saya melihat profil ' + u.nama + ' di website Desa Kandeman. Saya tertarik dengan produknya.');
    waBtn.href = telWa && telWa.wa
      ? `https://wa.me/${telWa.wa}?text=${pesan}`
      : `https://wa.me/?text=${pesan}`;
    waBtn.style.display = 'inline-flex';
  } else {
    waBtn.style.display = 'none';
  }

  // Tombol lokasi
  const mapBtn = document.getElementById('um-map-btn');
  if (u.alamat) {
    mapBtn.href = 'https://maps.google.com/?q=' + encodeURIComponent(u.alamat + ', Kandeman, Batang');
    mapBtn.style.display = 'inline-flex';
  } else mapBtn.style.display = 'none';

  const modal = document.getElementById('umkmModal');
  modal.classList.add('open');
  activateDialog(modal, modal.querySelector('.um-close'));
  document.body.style.overflow = 'hidden';
}

function closeUmkmModal() {
  const modal = document.getElementById('umkmModal');
  modal?.classList.remove('open');
  document.body.style.overflow = '';
  deactivateDialog(modal);
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('umkmModal')?.classList.contains('open')) {
    closeUmkmModal();
  }
});

// ════════════════════
// AGENDA DESA
// ════════════════════
async function loadAgenda() {
  const elDepan = document.getElementById('agenda-mendatang');
  const elLalu  = document.getElementById('agenda-lalu');
  if (!elDepan) return;

  const { data, error } = await sb.from('agenda')
    .select('*').eq('aktif', true).order('tanggal', { ascending: true });

  const BADGE = { rutin:'ag-rutin', penting:'ag-penting', umum:'ag-umum' };
  const BLN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];

  const kartu = a => {
    const d = new Date(a.tanggal);
    const jenis = (a.jenis || 'umum').toLowerCase();
    return `<div class="agenda-card">
      <div class="agenda-date">
        <div class="d">${d.getDate()}</div>
        <div class="m">${BLN[d.getMonth()]}</div>
      </div>
      <div class="agenda-body">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:4px;">
          <h4 style="margin:0;">${escHtml(a.judul)}</h4>
          <span class="agenda-badge ${BADGE[jenis]||'ag-umum'}">${escHtml(a.jenis||'Umum')}</span>
        </div>
        ${a.deskripsi ? `<p>${escHtml(a.deskripsi)}</p>` : ''}
        <div class="agenda-meta">
          ${a.waktu   ? `<span><i class="fa-regular fa-clock"></i> ${escHtml(a.waktu)}</span>` : ''}
          ${a.lokasi  ? `<span><i class="fa-solid fa-location-dot"></i> ${escHtml(a.lokasi)}</span>` : ''}
        </div>
      </div>
    </div>`;
  };

  const kosong = (ikon, teks) => `<div class="agenda-empty">
      <i class="fa-solid ${ikon}" style="font-size:30px;color:var(--text-muted);opacity:.3;display:block;margin-bottom:10px;"></i>
      <div style="font-size:13px;color:var(--text-muted);">${teks}</div>
    </div>`;

  if (error) {
    console.error('Gagal memuat agenda:', error);
    elDepan.innerHTML = kosong('fa-triangle-exclamation', 'Agenda belum dapat dimuat.');
    if (elLalu) elLalu.innerHTML = kosong('fa-triangle-exclamation', 'Riwayat agenda belum dapat dimuat.');
    return;
  }
  if (!data || data.length === 0) {
    elDepan.innerHTML = kosong('fa-calendar-xmark', 'Belum ada agenda terjadwal.');
    if (elLalu) elLalu.innerHTML = kosong('fa-calendar-check', 'Belum ada agenda terlaksana.');
    return;
  }

  const kini = new Date(); kini.setHours(0,0,0,0);
  const depan = data.filter(a => new Date(a.tanggal) >= kini).slice(0, 6);
  const lalu  = data.filter(a => new Date(a.tanggal) <  kini).reverse().slice(0, 4);

  elDepan.innerHTML = depan.length ? depan.map(kartu).join('')
    : kosong('fa-calendar-xmark', 'Belum ada agenda mendatang.');
  if (elLalu) elLalu.innerHTML = lalu.length ? lalu.map(kartu).join('')
    : kosong('fa-calendar-check', 'Belum ada agenda terlaksana.');
}

// ════════════════════
// ASPIRASI WARGA
// ════════════════════
const ASPIRASI_MIN_FILL_MS = 3000;
const ASPIRASI_REPEAT_DELAY_MS = 60000;
const ASPIRASI_LAST_SUBMIT_KEY = 'sikanda_aspirasi_last_submit';
let aspirasiFormStartedAt = performance.now();
let aspirasiSubmitting = false;

function sanitizeAspirasiText(value, maxLength) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLength);
}

function getLastAspirasiSubmit() {
  try {
    return Number(sessionStorage.getItem(ASPIRASI_LAST_SUBMIT_KEY)) || 0;
  } catch {
    return 0;
  }
}

async function kirimAspirasi() {
  const btn = document.getElementById('asp-submit-btn');
  if (!btn || aspirasiSubmitting) return;
  if (!sb) {
    console.error('Supabase belum tersedia saat form aspirasi dikirim.');
    alert('Aspirasi belum dapat dikirim. Silakan coba lagi beberapa saat.');
    return;
  }

  const honeypot = document.getElementById('website-url');
  if (honeypot?.value.trim()) return;
  if (performance.now() - aspirasiFormStartedAt < ASPIRASI_MIN_FILL_MS) return;

  const sinceLastSubmit = Date.now() - getLastAspirasiSubmit();
  if (sinceLastSubmit < ASPIRASI_REPEAT_DELAY_MS) {
    const seconds = Math.ceil((ASPIRASI_REPEAT_DELAY_MS - sinceLastSubmit) / 1000);
    alert(`Mohon tunggu ${seconds} detik sebelum mengirim aspirasi berikutnya.`);
    return;
  }

  const namaEl = document.getElementById('asp-nama');
  const kontakEl = document.getElementById('asp-kontak');
  const dusunEl = document.getElementById('asp-dusun');
  const kategoriEl = document.getElementById('asp-kategori');
  const isiEl = document.getElementById('asp-isi');

  const rawNama = String(namaEl?.value ?? '');
  const rawKontak = String(kontakEl?.value ?? '');
  const rawDusun = String(dusunEl?.value ?? '');
  const rawKategori = String(kategoriEl?.value ?? '');
  const rawIsi = String(isiEl?.value ?? '');
  if (rawNama.length > 100) {
    alert('Nama maksimal 100 karakter.'); namaEl?.focus(); return;
  }
  if (rawKontak.length > 30) {
    alert('Nomor kontak maksimal 30 karakter.'); kontakEl?.focus(); return;
  }
  if (rawDusun.length > 100 || rawKategori.length > 100) {
    alert('Data wilayah atau kategori melebihi batas yang diizinkan.'); return;
  }
  if (rawIsi.length > 2000) {
    alert('Isi aspirasi maksimal 2.000 karakter.'); isiEl?.focus(); return;
  }

  const nama = sanitizeAspirasiText(rawNama, 100);
  const kontak = sanitizeAspirasiText(rawKontak, 30);
  const dusun = sanitizeAspirasiText(rawDusun, 100);
  const kategori = sanitizeAspirasiText(rawKategori, 100);
  const isi = sanitizeAspirasiText(rawIsi, 2000);

  if (!nama) {
    alert('Nama lengkap wajib diisi.');
    namaEl?.focus();
    return;
  }
  if (kontak && !/^[0-9+().\-\s]{7,30}$/.test(kontak)) {
    alert('Nomor kontak hanya boleh berisi angka, spasi, +, tanda kurung, titik, atau tanda hubung.');
    kontakEl?.focus();
    return;
  }
  if (!isi || isi.length < 12) {
    alert('Isi aspirasi minimal 12 karakter agar dapat ditindaklanjuti.');
    isiEl?.focus();
    return;
  }

  aspirasiSubmitting = true;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengirim…';

  try {
    // TODO produksi: arahkan INSERT melalui Supabase Edge Function untuk rate
    // limiting berbasis IP/fingerprint dan verifikasi token Cloudflare Turnstile.
    const { error } = await sb.from('aspirasi').insert({
      nama, kontak, dusun, kategori, isi, status: 'baru',
    });
    if (error) throw error;

    try {
      sessionStorage.setItem(ASPIRASI_LAST_SUBMIT_KEY, String(Date.now()));
    } catch {}
    document.getElementById('asp-form-wrap').style.display = 'none';
    document.getElementById('asp-success-wrap').style.display = 'block';
    document.getElementById('aspirasi-box').scrollIntoView({ behavior:'smooth', block:'center' });
  } catch (error) {
    console.error('Gagal mengirim aspirasi:', error);
    alert('Aspirasi belum dapat dikirim. Silakan coba lagi atau hubungi Balai Desa.');
  } finally {
    aspirasiSubmitting = false;
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Kirim Aspirasi';
  }
}

function resetAspirasiForm() {
  ['asp-nama','asp-kontak','asp-isi'].forEach(i => { const e = document.getElementById(i); if (e) e.value = ''; });
  document.getElementById('asp-dusun').value = '';
  document.getElementById('asp-kategori').selectedIndex = 0;
  const honeypot = document.getElementById('website-url');
  if (honeypot) honeypot.value = '';
  document.getElementById('asp-success-wrap').style.display = 'none';
  document.getElementById('asp-form-wrap').style.display = 'block';
  aspirasiFormStartedAt = performance.now();
}

// ════════════════════
// ANIMASI STATISTIK
// ════════════════════
function observeStatistik() {
  const sec = document.getElementById('statistik');
  if (!sec) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      // Bar horizontal
      sec.querySelectorAll('.hbar-fill').forEach((b, i) => {
        setTimeout(() => { b.style.width = (b.dataset.w || 0) + '%'; }, i * 90);
      });
      // Piramida
      sec.querySelectorAll('.pyr-bar').forEach((b, i) => {
        setTimeout(() => { b.style.width = (b.dataset.w || 0) + '%'; }, i * 70);
      });
      // Donut
      sec.querySelectorAll('.donut-seg').forEach((s, i) => {
        setTimeout(() => {
          s.style.transition = 'stroke-dasharray 1.1s cubic-bezier(.22,1,.36,1)';
          s.setAttribute('stroke-dasharray', `${s.dataset.len} ${100 - s.dataset.len}`);
          s.setAttribute('stroke-dashoffset', s.dataset.off);
        }, i * 160);
      });
      io.unobserve(sec);
    });
  }, { threshold: 0.25 });
  io.observe(sec);
}

// ════════════════════
// STATISTIK WARGA (dari basis data, diperbarui 6 bulan sekali)
// ════════════════════
function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function setCounterData(id, value) {
  const element = document.getElementById(id);
  if (!element) return;
  const numeric = numberOrNull(value);
  if (numeric === null) {
    element.dataset.count = '0';
    element.dataset.empty = 'true';
    element.textContent = '—';
    return;
  }
  element.dataset.count = String(numeric);
  element.dataset.empty = 'false';
  const prefix = element.dataset.prefix || '';
  const suffix = element.dataset.suffix || '';
  const formatted = element.dataset.sep === 'true'
    ? numeric.toLocaleString('id-ID')
    : numeric.toLocaleString('id-ID', { maximumFractionDigits: 2 });
  element.textContent = prefix + formatted + suffix;
}

function resetStatistikData(status = 'empty') {
  const unavailable = status === 'error';
  const label = document.getElementById('stat-periode-label');
  if (label) label.textContent = unavailable ? ' Data belum dapat dimuat.' : ' Data belum tersedia.';

  document.querySelectorAll('#piramida-umur .pyr-bar').forEach(bar => {
    bar.textContent = '0';
    bar.dataset.w = '0';
    bar.style.width = '0%';
  });
  document.querySelectorAll('.donut-seg').forEach(segment => {
    segment.dataset.len = '0';
    segment.dataset.off = '25';
    segment.setAttribute('stroke-dasharray', '0 100');
  });
  document.querySelectorAll('#stat-pendidikan-legend .vl').forEach(value => {
    value.textContent = '0%';
  });
  ['stat-total-penduduk','stat-total-kk','stat-total-laki','stat-total-perempuan'].forEach(id => {
    const element = document.getElementById(id);
    if (element) element.textContent = '—';
  });

  setCounterData('hero-total-penduduk', null);
  setCounterData('hero-luas-wilayah', null);
  const emptyIds = [
    'hero-total-penduduk-duplikat','hero-luas-wilayah-duplikat','hero-rt-rw',
    'hero-rt-rw-duplikat','profil-total-kk','profil-luas-wilayah',
    'profil-total-rt','profil-total-rw',
  ];
  emptyIds.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.textContent = '—';
  });
}

async function loadStatistik() {
  const { data, error } = await sb.from('statistik')
    .select('*').eq('aktif', true)
    .order('tahun', { ascending:false })
    .order('periode', { ascending:false })
    .limit(1);
  if (error) {
    console.error('Gagal memuat statistik:', error);
    resetStatistikData('error');
    return;
  }
  if (!data || data.length === 0) {
    resetStatistikData('empty');
    return;
  }
  const s = data[0];

  // ── Label periode ──
  const lbl = document.getElementById('stat-periode-label');
  if (lbl) {
    const nm = s.periode >= 7 ? 'Juli' : 'Januari';
    lbl.textContent = ` Data diperbarui ${nm} ${s.tahun}.`;
  }

  // ── Piramida umur ──
  const kel = [
    ['umur_0_9_l','umur_0_9_p'], ['umur_10_19_l','umur_10_19_p'],
    ['umur_20_29_l','umur_20_29_p'], ['umur_30_44_l','umur_30_44_p'],
    ['umur_45_59_l','umur_45_59_p'], ['umur_60plus_l','umur_60plus_p']
  ];
  const semua = kel.flat().map(k => Number(s[k]) || 0);
  const maks  = Math.max(...semua, 1);

  const barisPyr = document.querySelectorAll('#piramida-umur .pyr-row');
  kel.forEach((pasangan, i) => {
    const baris = barisPyr[i];
    if (!baris) return;
    const [kl, kp] = pasangan.map(k => Number(s[k]) || 0);
    const bl = baris.querySelector('.pyr-bar.l');
    const bp = baris.querySelector('.pyr-bar.p');
    if (bl) { bl.textContent = kl; bl.dataset.w = Math.round(kl / maks * 80); }
    if (bp) { bp.textContent = kp; bp.dataset.w = Math.round(kp / maks * 80); }
  });

  // ── Tingkat pendidikan (donut + legenda) ──
  const didik = [
    ['SD / sederajat',     s.didik_sd],
    ['SMP / sederajat',    s.didik_smp],
    ['SMA / sederajat',    s.didik_sma],
    ['Diploma / Sarjana',  s.didik_tinggi]
  ];
  const seg = document.querySelectorAll('.donut-seg');
  const leg = document.querySelectorAll('#stat-pendidikan-legend .donut-item');
  let offset = 25;
  didik.forEach(([nama, nilai], i) => {
    const p = Number(nilai) || 0;
    if (seg[i]) {
      seg[i].dataset.len = p;
      seg[i].dataset.off = offset;
    }
    offset -= p;
    if (leg[i]) {
      const n = leg[i].querySelector('.nm');
      const v = leg[i].querySelector('.vl');
      if (n) n.textContent = nama;
      if (v) v.textContent = p + '%';
    }
  });

  // ── Ringkasan demografi ──
  const totalPenduduk = numberOrNull(s.total_penduduk) ?? 0;
  const totalKk = numberOrNull(s.total_kk) ?? 0;
  const totalLaki = numberOrNull(s.total_laki) ?? 0;
  const totalPerempuan = numberOrNull(s.total_perempuan) ?? 0;
  const ring = [
    ['stat-total-penduduk', totalPenduduk],
    ['stat-total-kk', totalKk],
    ['stat-total-laki', totalLaki],
    ['stat-total-perempuan', totalPerempuan],
  ];
  ring.forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = '±' + value.toLocaleString('id-ID');
  });

  // Semua angka penduduk menggunakan record statistik yang sama.
  setCounterData('hero-total-penduduk', totalPenduduk);
  const heroPopulationClone = document.getElementById('hero-total-penduduk-duplikat');
  if (heroPopulationClone) heroPopulationClone.textContent = '±' + totalPenduduk.toLocaleString('id-ID');
  const profileKk = document.getElementById('profil-total-kk');
  if (profileKk) profileKk.textContent = '±' + totalKk.toLocaleString('id-ID');

  // Kolom berikut bersifat opsional. Jika belum tersedia di skema database,
  // website menampilkan tanda pisah, bukan angka hardcoded atau data buatan.
  const luasWilayah = numberOrNull(s.luas_wilayah_ha);
  const totalRt = numberOrNull(s.total_rt);
  const totalRw = numberOrNull(s.total_rw);
  setCounterData('hero-luas-wilayah', luasWilayah);
  const heroLuasClone = document.getElementById('hero-luas-wilayah-duplikat');
  const profileLuas = document.getElementById('profil-luas-wilayah');
  const luasText = luasWilayah === null ? '—' : `±${luasWilayah.toLocaleString('id-ID')} Ha`;
  if (heroLuasClone) heroLuasClone.textContent = luasText;
  if (profileLuas) profileLuas.textContent = luasText;

  const rtRwText = totalRt === null && totalRw === null
    ? '—'
    : `${totalRt ?? '—'} RT / ${totalRw ?? '—'} RW`;
  ['hero-rt-rw','hero-rt-rw-duplikat'].forEach(id => {
    const element = document.getElementById(id);
    if (element) element.textContent = rtRwText;
  });
  const profileRt = document.getElementById('profil-total-rt');
  const profileRw = document.getElementById('profil-total-rw');
  if (profileRt) profileRt.textContent = totalRt === null ? '—' : `${totalRt} RT`;
  if (profileRw) profileRw.textContent = totalRw === null ? '—' : `${totalRw} RW`;

  if (totalPenduduk !== totalLaki + totalPerempuan) {
    console.warn('Statistik tidak konsisten: total penduduk berbeda dari jumlah laki-laki dan perempuan.');
  }
  const totalKelompokUmur = semua.reduce((sum, value) => sum + value, 0);
  if (totalKelompokUmur !== totalPenduduk) {
    console.warn('Statistik tidak konsisten: jumlah seluruh kelompok umur berbeda dari total penduduk.');
  }
  const totalPendidikan = didik.reduce((sum, item) => sum + (Number(item[1]) || 0), 0);
  if (Math.abs(totalPendidikan - 100) > 0.05) {
    console.warn('Statistik tidak konsisten: persentase pendidikan tidak berjumlah 100%.');
  }
}

// ════════════════════
// JADWAL POSYANDU / POSBINDU (diperbarui tiap bulan)
// ════════════════════

/* Tanggal jadwal kesehatan disimpan YYYY-MM-DD, ditampilkan hari/bulan/tahun.
   Nilai lama berupa teks bebas ditampilkan apa adanya. */
function formatTanggalJadwal(nilai, bulan, tahun) {
  if (!nilai && nilai !== 0) return '';
  const teks = String(nilai).trim();

  // Sudah berupa tanggal ISO (YYYY-MM-DD) dari pemilih tanggal admin
  const iso = teks.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;

  // Sudah dd/mm/yyyy — biarkan
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(teks)) return teks;

  // Data lama "Tanggal 28" / "28": bentuk tanggal dari bulan & tahun baris itu
  const angka = teks.match(/^(?:tanggal\s*)?(\d{1,2})$/i);
  if (angka && bulan && tahun) {
    const b = Number(bulan), t = Number(tahun);
    if (b >= 1 && b <= 12 && t > 1900) {
      const akhirBulan = new Date(t, b, 0).getDate();
      const h = Math.min(Number(angka[1]), akhirBulan);
      const dd = String(h).padStart(2, '0');
      const mm = String(b).padStart(2, '0');
      return `${dd}/${mm}/${t}`;
    }
  }

  // Format lain (mis. "Setiap Senin") ditampilkan apa adanya
  return teks;
}

async function loadJadwalKesehatan() {
  const tbody = document.getElementById('jadwal-kesehatan-body');
  if (!tbody) return;
  const kini  = new Date();
  const bulan = kini.getMonth() + 1;
  const tahun = kini.getFullYear();

  let { data, error } = await sb.from('jadwal_kesehatan')
    .select('*').eq('aktif', true)
    .eq('bulan', bulan).eq('tahun', tahun)
    .order('urutan');

  if (error) {
    console.error('Gagal memuat jadwal kesehatan:', error);
    renderDataState(tbody, 'error', 'Jadwal kesehatan belum dapat dimuat.', { colspan: 4 });
    return;
  }

  // Bila jadwal bulan ini belum diisi, ambil jadwal terbaru yang tersedia
  if (!data || !data.length) {
    const cad = await sb.from('jadwal_kesehatan')
      .select('*').eq('aktif', true)
      .order('tahun', { ascending:false })
      .order('bulan', { ascending:false })
      .order('urutan');
    if (cad.error) {
      console.error('Gagal memuat arsip jadwal kesehatan:', cad.error);
      renderDataState(tbody, 'error', 'Jadwal kesehatan belum dapat dimuat.', { colspan: 4 });
      return;
    }
    if (!cad.data || cad.data.length === 0) {
      renderDataState(tbody, 'empty', 'Belum ada jadwal kesehatan yang dipublikasikan.', { colspan: 4 });
      return;
    }
    const b = cad.data[0].bulan, t = cad.data[0].tahun;
    data = cad.data.filter(j => j.bulan === b && j.tahun === t);
  }

  tbody.textContent = '';
  const frag = document.createDocumentFragment();
  data.forEach(j => {
    const tr = document.createElement('tr');

    const tdDusun = document.createElement('td');
    tdDusun.textContent = j.dusun || '';

    const tdLokasi = document.createElement('td');
    tdLokasi.textContent = j.lokasi || '\u2014';   // strip bila belum diisi

    const tdJadwal = document.createElement('td');
    tdJadwal.textContent = formatTanggalJadwal(j.jadwal, j.bulan, j.tahun);

    // Kolom jam: pakai kolom `jam`; bila kosong pakai nilai baku.
    const tdJam = document.createElement('td');
    tdJam.textContent = j.jam || '09.00 - selesai';

    tr.append(tdDusun, tdLokasi, tdJadwal, tdJam);
    frag.appendChild(tr);
  });
  tbody.appendChild(frag);
}

// ════════════════════
// KONTAK DARURAT & KESEHATAN
// ════════════════════
async function loadKontakKesehatan() {
  const wadah = document.getElementById('kontak-kesehatan-list');
  if (!wadah) return;
  const { data, error } = await sb.from('kontak_kesehatan')
    .select('*').eq('aktif', true).order('urutan');
  if (error) {
    console.error('Gagal memuat kontak kesehatan:', error);
    renderDataState(wadah, 'error', 'Kontak layanan kesehatan belum dapat dimuat.');
    return;
  }
  if (!data || data.length === 0) {
    renderDataState(wadah, 'empty', 'Belum ada kontak layanan kesehatan yang dipublikasikan.');
    return;
  }

  const JENIS = { emergency:'emergency', bidan:'bidan', pusk:'pusk' };

  wadah.textContent = '';
  const frag = document.createDocumentFragment();

  data.forEach(k => {
    const kartu = document.createElement('div');
    kartu.className = 'darurat-card';

    // Ikon
    const ikon = document.createElement('div');
    ikon.className = 'darurat-icon ' + (JENIS[k.jenis] || 'emergency');
    const i = document.createElement('i');
    i.className = 'fa-solid ' + (k.ikon || 'fa-kit-medical');
    ikon.appendChild(i);

    // Informasi
    const info = document.createElement('div');
    info.className = 'darurat-info';

    const h4 = document.createElement('h4');
    h4.textContent = k.nama_layanan || '';
    info.appendChild(h4);

    if (k.petugas) {
      const pet = document.createElement('div');
      pet.className = 'darurat-petugas';
      pet.textContent = k.petugas;
      info.appendChild(pet);
    }

    const detail = document.createElement('div');
    detail.className = 'darurat-detail';

    const barisDetail = [
      ['fa-location-dot', k.lokasi],
      ['fa-clock',        k.jam_layanan],
      ['fa-phone',        k.telepon]
    ];
    barisDetail.forEach(([ic, teks]) => {
      if (!teks) return;
      const sp = document.createElement('span');
      const ii = document.createElement('i');
      ii.className = 'fa-solid ' + ic;
      sp.appendChild(ii);
      sp.appendChild(document.createTextNode(teks));
      detail.appendChild(sp);
    });
    if (detail.children.length) info.appendChild(detail);

    kartu.appendChild(ikon);
    kartu.appendChild(info);

    // Tombol telepon
    if (k.telepon) {
      const a = document.createElement('a');
      a.className = 'darurat-call';
      const telK = normalisasiTelepon(k.telepon);
      a.href = 'tel:' + (telK ? telK.tel : String(k.telepon).replace(/[^0-9+]/g, ''));
      a.setAttribute('aria-label', 'Telepon ' + (k.nama_layanan || ''));
      const ic = document.createElement('i');
      ic.className = 'fa-solid fa-phone';
      a.appendChild(ic);
      kartu.appendChild(a);
    }

    frag.appendChild(kartu);
  });

  wadah.appendChild(frag);
}

// ════════════════════
// LOAD PRESTASI
// ════════════════════
async function loadPrestasi() {
  const el = document.getElementById('prestasi-grid');
  if (!el) return;
  const { data, error } = await sb.from('prestasi')
    .select('*')
    .eq('aktif', true)
    .order('urutan');

  if (error) {
    console.error('Gagal memuat prestasi:', error);
    renderDataState(el, 'error', 'Data prestasi belum dapat dimuat.');
    return;
  }
  if (!data || data.length === 0) {
    renderDataState(el, 'empty', 'Belum ada prestasi yang dipublikasikan.');
    return;
  }

  const MEDAL = { emas:'medal-gold', perak:'medal-silver', perunggu:'medal-bronze' };
  el.innerHTML = data.map(p => {
    const visual = p.foto_url
      ? `<img class="prestasi-foto" src="${safeUrl(p.foto_url)}" alt="${escHtml(p.judul)}" loading="lazy" decoding="async" onerror="this.outerHTML='<div class=\\'prestasi-medal ${MEDAL[p.medali]||'medal-gold'}\\'>${p.emoji||'🏆'}</div>'" />`
      : `<div class="prestasi-medal ${MEDAL[p.medali]||'medal-gold'}">${escHtml(p.emoji || '🏆')}</div>`;
    return `
    <div class="prestasi-card">
      ${visual}
      <div>
        <h4>${escHtml(p.judul)}</h4>
        <p>${escHtml(p.deskripsi)}</p>
        ${p.tahun_info ? `<div class="prestasi-year">${escHtml(p.tahun_info)}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ════════════════════
// OFFLINE BANNER
// Tampilkan banner jika browser tidak terhubung internet
// ════════════════════
function updateOnlineStatus() {
  const existing = document.getElementById('offline-banner');
  if (!navigator.onLine) {
    if (!existing) {
      const banner = document.createElement('div');
      banner.id = 'offline-banner';
      banner.style.cssText = `
        position:fixed; top:64px; left:0; right:0; z-index:1000;
        background:#7C2D12; color:#fff; text-align:center;
        padding:10px 16px; font-size:13px; font-weight:500;
        display:flex; align-items:center; justify-content:center; gap:8px;
      `;
      banner.innerHTML = `<i class="fa-solid fa-wifi" style="opacity:.7;"></i>
        Tidak ada koneksi internet. Beberapa data mungkin tidak tampil.`;
      document.body.prepend(banner);
    }
  } else {
    if (existing) existing.remove();
  }
}
window.addEventListener('online',  updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus(); // cek saat pertama load

// ════════════════════
// ANIMASI PROGRESS BAR APBDes
// Bar mengisi bertahap saat masuk viewport
// ════════════════════
let _barObserver = null;
function observeBars() {
  if (!_barObserver) {
    _barObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Delay bertingkat agar bar mengisi satu per satu
          const bars = [...document.querySelectorAll('.bar-fill')];
          const idx  = bars.indexOf(entry.target);
          setTimeout(() => entry.target.classList.add('filled'), idx * 130);
          _barObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });
  }
  document.querySelectorAll('.bar-fill:not(.filled)').forEach(b => _barObserver.observe(b));
}

// ════════════════════
// INIT — load semua sekaligus
// ════════════════════
async function runDataLoader(name, loader) {
  try {
    await loader();
  } catch (error) {
    console.error(`Gagal menjalankan pemuat ${name}:`, error);
  }
}

function _initDataLoad() {
  bindFinancialArchiveTabs();
  prepareDynamicLoadingStates();
  if (!sb) {
    console.error('Supabase client belum tersedia.');
    [
      'berita-grid','galeri-grid','potensi-grid','umkm-grid','agenda-mendatang',
      'agenda-lalu','prestasi-grid','kontak-kesehatan-list','financial-docs-grid',
      'perdes-list','poster-edukasi-list',
    ].forEach(id => renderDataState(id, 'error'));
    renderDataState('perangkat-tbody', 'error', null, { colspan: 4 });
    renderDataState('jadwal-kesehatan-body', 'error', null, { colspan: 4 });
    resetApbdesData('error');
    resetStatistikData('error');
    observeCounters();
    return;
  }
  (async () => {
    const loaders = [
      ['berita', loadBerita],
      ['galeri', loadGaleri],
      ['perangkat', loadPerangkat],
      ['APBDes', loadApbdes],
      ['potensi', loadPotensi],
      ['UMKM', loadUmkm],
      ['dokumen', loadDokumen],
      ['prestasi', loadPrestasi],
      ['agenda', loadAgenda],
      ['statistik', loadStatistik],
      ['jadwal kesehatan', loadJadwalKesehatan],
      ['kontak kesehatan', loadKontakKesehatan],
    ];
    await Promise.all(loaders.map(([name, loader]) => runDataLoader(name, loader)));
    observeStatistik();
    observeCounters();
  })();
}

// ════════════════════
// CETAK PANDUAN LAYANAN
// Hanya mencetak section layanan desa (bukan seluruh halaman)
// ════════════════════
// ════════════════════
// FITUR BARU — Download & Peta
// ════════════════════

// Peta layer switch tetap visual sampai URL layer Google My Maps resmi tersedia.
function switchPetaLayer(layer, btn) {
  document.querySelectorAll('.peta-tool-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // TODO: Ganti src iframe berdasarkan layer setelah URL My Maps resmi dikonfirmasi.
}

const FINANCIAL_DOC_TYPES = Object.freeze([
  { key:'apbdes', label:'APBDes', icon:'fa-file-invoice-dollar' },
  { key:'realisasi_anggaran', label:'Realisasi Anggaran', icon:'fa-chart-column' },
  { key:'laporan_keuangan', label:'Laporan Keuangan', icon:'fa-book-open' },
  { key:'lppd', label:'LPPD', icon:'fa-landmark' },
]);
const FINANCIAL_ARCHIVE_YEARS = Object.freeze([2024, 2025, 2026]);
let _financialArchiveYear = 2026;
let _financialDocuments = [];

function resolveFinancialDocumentYear(documentRecord) {
  const storedYear = Number(documentRecord?.tahun);
  if (FINANCIAL_ARCHIVE_YEARS.includes(storedYear)) return storedYear;
  const titleYear = String(documentRecord?.judul || '').match(/\b(2024|2025|2026)\b/);
  return titleYear ? Number(titleYear[1]) : 2026;
}

function renderFinancialArchive() {
  const grid = document.getElementById('financial-docs-grid');
  if (!grid) return;
  const yearDocuments = _financialDocuments.filter(documentRecord =>
    resolveFinancialDocumentYear(documentRecord) === _financialArchiveYear
  );
  const availableCount = FINANCIAL_DOC_TYPES.filter(type => {
    const record = yearDocuments.find(item => item.kategori === type.key);
    return Boolean(record && safeUrl(record.file_url));
  }).length;

  const yearLabel = document.getElementById('financial-archive-year');
  const countLabel = document.getElementById('financial-archive-count');
  if (yearLabel) yearLabel.innerHTML = `<i class="fa-regular fa-calendar"></i> Tahun ${_financialArchiveYear}`;
  if (countLabel) countLabel.textContent = `${availableCount} dari ${FINANCIAL_DOC_TYPES.length} dokumen tersedia`;
  grid.setAttribute('aria-label', `Arsip keuangan tahun ${_financialArchiveYear}`);

  grid.innerHTML = FINANCIAL_DOC_TYPES.map(type => {
    const record = yearDocuments.find(item => item.kategori === type.key);
    const href = safeUrl(record?.file_url);
    const available = Boolean(href);
    const description = record?.keterangan
      ? escHtml(record.keterangan)
      : `Dokumen ${escHtml(type.label)} tahun ${_financialArchiveYear}`;
    return `<article class="financial-doc-card${available ? ' is-available' : ''}">
      <div class="financial-doc-symbol" aria-hidden="true"><i class="fa-solid ${type.icon}"></i></div>
      <div class="financial-doc-copy">
        <h4>${escHtml(type.label)}</h4>
        <div class="financial-doc-meta">
          <span class="financial-doc-status">${available ? 'PDF tersedia' : 'Belum tersedia'}</span>
          ${available ? `<span aria-hidden="true">·</span><span title="${description}">Tahun ${_financialArchiveYear}</span>` : ''}
        </div>
      </div>
      <div class="financial-doc-actions">
        ${available ? `<a class="financial-doc-action" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="Lihat ${escHtml(type.label)} tahun ${_financialArchiveYear}"><i class="fa-regular fa-eye"></i><span>Lihat</span></a>
        <a class="financial-doc-action download" href="${href}" target="_blank" rel="noopener noreferrer" download aria-label="Unduh ${escHtml(type.label)} tahun ${_financialArchiveYear}"><i class="fa-solid fa-download"></i><span>Unduh</span></a>`
        : '<span class="financial-doc-unavailable">Menunggu publikasi</span>'}
      </div>
    </article>`;
  }).join('');
}

function selectFinancialArchiveYear(year, selectedButton) {
  const parsedYear = Number(year);
  if (!FINANCIAL_ARCHIVE_YEARS.includes(parsedYear)) return;
  _financialArchiveYear = parsedYear;
  document.querySelectorAll('.financial-year-tab').forEach(button => {
    const isActive = button === selectedButton || Number(button.dataset.financialYear) === parsedYear;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
    button.tabIndex = isActive ? 0 : -1;
  });
  renderFinancialArchive();
}

function bindFinancialArchiveTabs() {
  const tabs = [...document.querySelectorAll('.financial-year-tab')];
  tabs.forEach((button, index) => {
    if (button.dataset.bound === 'true') return;
    button.dataset.bound = 'true';
    button.addEventListener('click', () => selectFinancialArchiveYear(button.dataset.financialYear, button));
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const nextIndex = event.key === 'Home' ? 0
        : event.key === 'End' ? tabs.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      tabs[nextIndex].focus();
      selectFinancialArchiveYear(tabs[nextIndex].dataset.financialYear, tabs[nextIndex]);
    });
  });
}

// Load semua dokumen download dari tabel Supabase
async function loadDokumen() {
  let { data, error } = await sb.from('dokumen')
    .select('*')
    .eq('aktif', true)
    .order('urutan');
  if (error) {
    console.error('Gagal memuat dokumen:', error);
    renderDataState('financial-docs-grid', 'error', 'Arsip keuangan belum dapat dimuat.');
    renderDataState('perdes-list', 'error', 'Peraturan desa belum dapat dimuat.');
    renderDataState('poster-edukasi-list', 'error', 'Poster edukasi belum dapat dimuat.');
    return;
  }
  data = data || [];

  // ── Arsip Keuangan Desa ──
  const financialKeys = FINANCIAL_DOC_TYPES.map(type => type.key);
  _financialDocuments = data.filter(documentRecord => financialKeys.includes(documentRecord.kategori));
  renderFinancialArchive();

  // ── Perdes ──
  const perdesEl = document.getElementById('perdes-list');
  const perdes = data.filter(d => d.kategori === 'perdes');
  if (perdesEl) {
    perdesEl.innerHTML = !perdes.length
      ? '<p class="daftar-kosong"><i class="fa-solid fa-circle-info"></i> Belum ada peraturan desa yang diunggah.</p>'
      : perdes.map(d =>
      `<a href="${safeUrl(d.file_url)}" class="perdes-item" target="_blank" rel="noopener noreferrer" download>
        <div class="perdes-icon"><i class="fa-solid fa-scroll"></i></div>
        <div class="perdes-info">
          <h4>${escHtml(d.judul)}</h4>
          <span>${escHtml(d.keterangan || '')}</span>
        </div>
        <i class="fa-solid fa-download perdes-arrow"></i>
      </a>`
    ).join('');
  }

  // ── Poster edukasi ──
  // Bila ada poster terunggah, kartu bawaan diganti seluruhnya.
  const posterEl = document.getElementById('poster-edukasi-list');
  const poster = data.filter(d => d.kategori === 'poster' && d.file_url);
  if (posterEl && poster.length) {
    _posterList = poster.map(d => ({ src: d.file_url, judul: d.judul || '' }));
    posterEl.innerHTML = poster.map((d, i) =>
      `<button type="button" class="poster-card klik" onclick="bukaPoster(${i})"
               aria-label="Perbesar poster ${escHtml(d.judul || '')}">
        <div class="poster-thumb-img">
          <img src="${safeUrl(d.file_url)}" alt="${escHtml(d.judul || 'Poster edukasi')}" loading="lazy" />
          <span class="poster-zoom"><i class="fa-solid fa-magnifying-glass-plus"></i></span>
        </div>
        <div class="poster-label">${escHtml(d.judul || '')}</div>
      </button>`
    ).join('');
  } else if (posterEl) {
    renderDataState(posterEl, 'empty', 'Belum ada poster edukasi yang dipublikasikan.');
  }

  // ── Statistik (tombol tunggal) ──
  const statDoc = data.find(d => d.kategori === 'statistik');
  const btnStat = document.getElementById('btn-statistik');
  if (statDoc && btnStat) {
    btnStat.href = statDoc.file_url;
    btnStat.setAttribute('target','_blank');
    btnStat.setAttribute('rel','noopener noreferrer');
    btnStat.removeAttribute('onclick');
  }

  // ── SOP (tombol tunggal) ──
  const sopDoc = data.find(d => d.kategori === 'sop');
  const btnSop = document.getElementById('btn-sop');
  if (sopDoc && btnSop) {
    btnSop.href = sopDoc.file_url;
    btnSop.setAttribute('target','_blank');
    btnSop.setAttribute('rel','noopener noreferrer');
    btnSop.removeAttribute('onclick');
  }
}

// Helper: pesan file belum ada (fallback ketika tabel dokumen kosong)
function _fileBelumAda(namaFile) {
  alert(`File "${namaFile}" belum diunggah.\n\nAdmin dapat mengunggah dokumen melalui Panel Admin SIKANDA → menu Dokumen & Arsip.`);
}
function unduhSOP(e)        { e.preventDefault(); _fileBelumAda('SOP Pelayanan Desa'); return false; }
function unduhStatistik(e)  { e.preventDefault(); _fileBelumAda('Data Statistik Kependudukan'); return false; }
function unduhPerdes(e,nama){ e.preventDefault(); _fileBelumAda(nama); return false; }

function cetakLayanan() {
  const el = document.getElementById('layanan');
  if (!el) { window.print(); return; }

  // Kumpulkan data dari DOM tanpa mengubah display state
  const items = document.querySelectorAll('.surat-item');
  let suratHtml = '';
  items.forEach(item => {
    const title  = item.querySelector('h4')?.textContent || '';
    const sub    = item.querySelector('.surat-text > p')?.textContent || '';
    const body   = item.querySelector('.surat-body');
    if (!body) return;
    const reqs   = [...body.querySelectorAll('.syarat-list li')].map(li => `<li>${li.textContent}</li>`).join('');
    const steps  = [...body.querySelectorAll('.alur-mini-step')].map(s => {
      const num  = s.querySelector('.alur-mini-num')?.textContent || '';
      const txt  = s.querySelector('span:last-child')?.textContent || '';
      return `<div class="step"><div class="step-num">${num}</div><span>${txt}</span></div>`;
    }).join('');
    const est    = body.querySelector('.estimasi')?.textContent || '';
    suratHtml += `
      <hr class="divider"/>
      <div class="surat-title">${title}</div>
      <div class="surat-sub">${sub}</div>
      ${reqs ? `<ul>${reqs}</ul>` : ''}
      ${steps ? `<div class="steps">${steps}</div>` : ''}
      ${est ? `<div class="estimasi">${est}</div>` : ''}`;
  });

  // Buat jendela print khusus
  const win = window.open('', '_blank', 'width=800,height=600');
  win.document.write(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <title>Panduan Layanan Desa Kandeman — SIKANDA</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; margin: 0; padding: 24pt; }
    h1 { font-size: 18pt; margin-bottom: 4pt; }
    .sub { font-size: 10pt; color: #555; margin-bottom: 20pt; }
    .divider { border: none; border-top: 1.5pt solid #ccc; margin: 14pt 0; }
    .surat-title { font-size: 13pt; font-weight: bold; margin: 16pt 0 6pt; }
    .surat-sub { font-size: 9pt; color: #555; margin-bottom: 8pt; }
    ul { margin: 0 0 8pt 18pt; padding: 0; }
    li { font-size: 10pt; margin-bottom: 3pt; }
    .steps { margin: 8pt 0; }
    .step { display: flex; gap: 8pt; margin-bottom: 5pt; font-size: 10pt; align-items: flex-start; }
    .step-num { background: #1C6B3E; color: #fff; border-radius: 50%; width: 16pt; height: 16pt; 
                display: flex; align-items: center; justify-content: center; font-size: 8pt; 
                flex-shrink: 0; margin-top: 1pt; }
    .estimasi { font-size: 9pt; color: #555; font-style: italic; margin-top: 6pt; }
    .header-bar { background: #0D2B1A; color: #fff; padding: 12pt 16pt; border-radius: 4pt; margin-bottom: 20pt; }
    .header-bar h1 { color: #fff; margin: 0; font-size: 16pt; }
    .header-bar p { color: rgba(255,255,255,.7); margin: 2pt 0 0; font-size: 9pt; }
    @media print { @page { margin: 16mm; } }
  </style>
</head>
<body>
  <div class="header-bar">
    <h1>🌾 Panduan Layanan Desa Kandeman</h1>
    <p>SIKANDA — Sistem Informasi Desa Kandeman · Dicetak ${new Date().toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'})}</p>
  </div>
  ${suratHtml}
</body></html>`);
  win.document.close();
  setTimeout(() => {
    try { win.print(); } catch(e) { /* abaikan jika popup diblokir */ }
  }, 400);
}

function enhancePublicAccessibility(root = document) {
  root.querySelectorAll('button:not([type])').forEach(button => button.setAttribute('type', 'button'));
  root.querySelectorAll('label:not([for])').forEach(label => {
    const control = label.parentElement?.querySelector('input[id], select[id], textarea[id]');
    if (control) label.htmlFor = control.id;
  });
  root.querySelectorAll('button:not([aria-label])').forEach(button => {
    if (button.textContent.trim()) return;
    button.setAttribute('aria-label', button.getAttribute('title') || 'Tombol aksi');
  });
  root.querySelectorAll('img:not([alt])').forEach(image => image.setAttribute('alt', ''));
}

document.addEventListener('DOMContentLoaded', () => {
  enhancePublicAccessibility();
  initLraPublicTabs();
  const observer = new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) enhancePublicAccessibility(node);
    }));
  });
  observer.observe(document.body, { childList:true, subtree:true });
});

window.addEventListener('unhandledrejection', event => {
  console.error('Operasi asynchronous halaman publik gagal:', event.reason);
  event.preventDefault();
});
_initDataLoad();
