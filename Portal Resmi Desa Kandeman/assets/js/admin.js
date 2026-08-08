// ═══════════════════════════════════════════════
// KONFIGURASI SUPABASE
// ═══════════════════════════════════════════════
const sb = window.sb;

// ── Helper: escape HTML ──
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function isValidHttpUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function safeAdminUrl(value) {
  return isValidHttpUrl(value) ? escHtml(String(value).trim()) : '';
}

function isValidPhone(value) {
  return !value || /^[+()\d\s.-]{3,30}$/.test(value);
}

function readFiniteNumber(id, options = {}) {
  const element = document.getElementById(id);
  const raw = element?.value;
  if ((raw === '' || raw == null) && options.nullable) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return NaN;
  return value;
}

// ── Helper: format Rupiah singkat ──
function fmtRpShort(n) {
  if (!n) return 'Rp 0';
  if (n >= 1e9) return 'Rp ' + (n/1e9).toFixed(2).replace(/\.?0+$/,'') + ' M';
  if (n >= 1e6) return 'Rp ' + (n/1e6).toFixed(1).replace(/\.0$/,'') + ' jt';
  return 'Rp ' + n.toLocaleString('id-ID');
}

const ALLOWED_IMAGE_TYPES = Object.freeze({
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
});

const ALLOWED_DOCUMENT_TYPES = Object.freeze({
  'application/pdf': ['pdf'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.ms-excel': ['xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'text/csv': ['csv'],
});

class UploadValidationError extends Error {}

function getFileExtension(fileName) {
  const parts = String(fileName || '').toLowerCase().split('.');
  return parts.length > 1 ? parts.pop().replace(/[^a-z0-9]/g, '') : '';
}

function validateUploadFile(file, kind = 'image', maxBytes = 3 * 1024 * 1024) {
  if (!file) return { ok:false, message:'Pilih file terlebih dahulu.' };
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok:false, message:'File kosong atau tidak valid.' };
  }
  if (file.size > maxBytes) {
    return { ok:false, message:`Ukuran file melebihi batas ${Math.round(maxBytes / 1024 / 1024)} MB.` };
  }

  const extension = getFileExtension(file.name);
  const whitelist = kind === 'berita-image'
    ? {
        'image/jpeg': ALLOWED_IMAGE_TYPES['image/jpeg'],
        'image/png': ALLOWED_IMAGE_TYPES['image/png'],
      }
    : kind === 'image'
    ? ALLOWED_IMAGE_TYPES
    : kind === 'pdf'
      ? { 'application/pdf': ['pdf'] }
      : { ...ALLOWED_DOCUMENT_TYPES, ...ALLOWED_IMAGE_TYPES };
  const extensions = whitelist[file.type];
  if (!extensions || !extensions.includes(extension)) {
    return { ok:false, message:'Format file tidak diizinkan. Periksa jenis dan ekstensi file.' };
  }
  return { ok:true, extension };
}

function createUniqueStoragePath(folder, extension) {
  const randomPart = window.crypto && typeof window.crypto.randomUUID === 'function'
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  const safeFolder = String(folder || '').replace(/[^a-z0-9/_-]/gi, '').replace(/\.{2,}/g, '');
  return `${safeFolder ? safeFolder.replace(/\/$/, '') + '/' : ''}${randomPart}.${extension}`;
}

async function uploadValidatedFile(file, options = {}) {
  const kind = options.kind || 'image';
  const maxBytes = options.maxBytes || 3 * 1024 * 1024;
  const validation = validateUploadFile(file, kind, maxBytes);
  if (!validation.ok) throw new UploadValidationError(validation.message);

  const storagePath = createUniqueStoragePath(options.folder || '', validation.extension);
  const { error } = await sb.storage
    .from('galeri-desa')
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });
  if (error) throw error;

  const { data } = sb.storage.from('galeri-desa').getPublicUrl(storagePath);
  if (!data?.publicUrl) {
    await sb.storage.from('galeri-desa').remove([storagePath]);
    throw new Error('URL publik file tidak tersedia setelah upload.');
  }
  return { storagePath, publicUrl: data.publicUrl };
}

async function rollbackUploadedFile(storagePath) {
  if (!storagePath) return;
  try {
    const { error } = await sb.storage.from('galeri-desa').remove([storagePath]);
    if (error) throw error;
  } catch (error) {
    console.error('Gagal membersihkan file setelah operasi database gagal:', error);
  }
}

function storagePathFromPublicUrl(url) {
  if (!url) return '';
  try {
    const pathname = new URL(url).pathname;
    const markers = ['/object/public/galeri-desa/', '/galeri-desa/'];
    for (const marker of markers) {
      const index = pathname.indexOf(marker);
      if (index >= 0) {
        const decoded = decodeURIComponent(pathname.slice(index + marker.length));
        const segments = decoded.split('/');
        if (!decoded || decoded.includes('\\') || segments.some(segment => !segment || segment === '.' || segment === '..')) {
          return '';
        }
        return decoded;
      }
    }
  } catch (error) {
    console.error('URL storage tidak valid:', error);
  }
  return '';
}

// ── Toast ──
let toastTimer;
function showToast(msg, isError=false) {
  const t = document.getElementById('toast');
  if (!t) return;
  const icon = document.createElement('i');
  icon.className = isError ? 'fa-solid fa-circle-exclamation' : 'fa-solid fa-circle-check';
  t.replaceChildren(icon, document.createTextNode(' ' + String(msg || '')));
  t.className = 'show' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = '', 3000);
}

// ── Last saved indicator ──
function showLastSaved(msg) {
  const el = document.getElementById('last-saved-indicator');
  document.getElementById('last-saved-text').textContent = msg;
  el.style.display = 'flex';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.style.display='none', 6000);
}


/* ════════════════════════════════════════════════════════════
   HAPUS BARIS — dengan pembuktian
   Tanpa .select(), Supabase mengembalikan sukses walaupun TIDAK ADA
   baris yang terhapus (mis. ditolak Row Level Security atau sesi login
   sudah kedaluwarsa). Akibatnya panel menampilkan "berhasil dihapus"
   padahal datanya masih ada. Dengan .select() kita bisa memastikan
   berapa baris yang benar-benar terhapus.
════════════════════════════════════════════════════════════ */
async function hapusBaris(tabel, id) {
  const { data, error } = await sb.from(tabel).delete().eq('id', id).select('id');
  if (error) {
    return { ok: false, pesan: 'Gagal hapus: ' + error.message };
  }
  if (!data || data.length === 0) {
    const { data: sesi } = await sb.auth.getSession();
    return {
      ok: false,
      pesan: sesi && sesi.session
        ? 'Tidak ada data yang terhapus. Izin database (RLS) menolak penghapusan pada tabel "' + tabel + '".'
        : 'Sesi login sudah berakhir. Silakan keluar lalu masuk kembali.'
    };
  }
  return { ok: true };
}

// ── Confirm modal ──
let _confirmCallback = null;
let _dialogReturnFocus = null;
function openConfirm(title, desc, okLabel, cb) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-desc').textContent  = desc;
  document.getElementById('confirm-ok-btn').innerHTML  = `<i class="fa-solid fa-trash-can"></i> ${okLabel || 'Hapus'}`;
  _confirmCallback = cb;
  _dialogReturnFocus = document.activeElement;
  const modal = document.getElementById('confirm-modal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.getElementById('confirm-ok-btn').focus();
}
function closeConfirm() {
  const modal = document.getElementById('confirm-modal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  _confirmCallback = null;
  if (_dialogReturnFocus && typeof _dialogReturnFocus.focus === 'function') {
    _dialogReturnFocus.focus();
  }
  _dialogReturnFocus = null;
}
function runConfirm() {
  // Simpan callback DULU: closeConfirm() mengosongkan _confirmCallback,
  // sehingga bila dipanggil lebih dulu, aksinya tidak pernah berjalan.
  const cb = _confirmCallback;
  closeConfirm();
  if (cb) cb();
}

// ── Sidebar mobile ──
function openSidebar()  { document.getElementById('sidebar').classList.add('open'); document.getElementById('sb-overlay').classList.add('open'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sb-overlay').classList.remove('open'); }

// ── Panel switching ──
const panelTitles = {
  dashboard:'Beranda Admin', berita:'Berita & Pengumuman',
  galeri:'Galeri Foto', perangkat:'Perangkat Desa',
  apbdes:'APBDes & Anggaran', potensi:'Potensi Desa', umkm:'UMKM Desa',
  prestasi:'Prestasi Desa', dokumen:'Dokumen & Arsip',
  agenda:'Agenda Desa', aspirasi:'Aspirasi Warga',
  statistik:'Statistik Warga', kesehatan:'Layanan Kesehatan',
};
function switchPanel(id, el) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach(s => s.classList.remove('active'));
  document.getElementById('panel-' + id).classList.add('active');
  document.getElementById('page-title').textContent = panelTitles[id] || id;
  if (el) el.classList.add('active');
  closeSidebar();
  if (id==='dashboard') loadDashboard();
  if (id==='berita')    { loadBerita(); setTimeout(loadDraft, 300); }
  if (id==='galeri')    loadGaleri();
  if (id==='perangkat') loadPerangkat();
  if (id==='apbdes')    { loadApbdes(); loadFinanceDocuments(); }
  if (id==='potensi')   loadPotensi();
  if (id==='umkm')      loadUmkm();
  if (id==='prestasi')  loadPrestasi();
  if (id==='dokumen')   loadDokumen();
  if (id==='agenda')    loadAgenda();
  if (id==='aspirasi')  loadAspirasi();
  if (id==='statistik') loadStatistik();
  if (id==='kesehatan') { loadJadwalKesehatan(); loadKontakKesehatan(); }
}

// ── APBDes tab switch ──
function switchApbTab(id, btn) {
  document.querySelectorAll('.apb-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.apb-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('apb-pane-' + id).classList.add('active');
  btn.classList.add('active');
}

// ── Rich text editor berita ──
const BERITA_ALLOWED_TAGS = new Set([
  'P','DIV','BR','STRONG','B','EM','I','U','S','STRIKE',
  'H2','H3','BLOCKQUOTE','UL','OL','LI','A','SPAN','FONT',
]);
const BERITA_DROP_TAGS = new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','FORM','INPUT','BUTTON']);
const BERITA_ALLOWED_FONTS = new Map([
  ['dm sans', 'DM Sans'],
  ['dm mono', 'DM Mono'],
  ['cormorant garamond', 'Cormorant Garamond'],
  ['georgia', 'Georgia'],
  ['arial', 'Arial'],
  ['times new roman', 'Times New Roman'],
  ['courier new', 'Courier New'],
]);
let _beritaSavedRange = null;

function normalizeBeritaFont(value) {
  const first = String(value || '').split(',')[0].replace(/["']/g, '').trim().toLowerCase();
  return BERITA_ALLOWED_FONTS.get(first) || '';
}

function legacyBeritaTextToHtml(value) {
  const escaped = escHtml(String(value || '').replace(/\r\n?/g, '\n'));
  if (!escaped) return '';
  return escaped.split(/\n{2,}/).map(block => `<p>${block.replace(/\n/g, '<br>')}</p>`).join('');
}

function sanitizeBeritaHtml(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const hasKnownMarkup = /<\/?(?:p|div|br|strong|b|em|i|u|s|strike|h2|h3|blockquote|ul|ol|li|a|span|font)\b/i.test(raw);
  const source = hasKnownMarkup ? raw : legacyBeritaTextToHtml(raw);
  const doc = document.implementation.createHTMLDocument('');
  const root = doc.createElement('div');
  root.innerHTML = source;

  Array.from(root.querySelectorAll('*')).forEach(element => {
    if (BERITA_DROP_TAGS.has(element.tagName)) {
      element.remove();
      return;
    }
    if (!BERITA_ALLOWED_TAGS.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }

    const safeAttrs = {};
    if (element.tagName === 'A') {
      const href = String(element.getAttribute('href') || '').trim();
      if (href && isValidHttpUrl(href)) {
        safeAttrs.href = href;
        safeAttrs.target = '_blank';
        safeAttrs.rel = 'noopener noreferrer';
      } else {
        element.replaceWith(...Array.from(element.childNodes));
        return;
      }
    }
    if (element.tagName === 'FONT') {
      const face = normalizeBeritaFont(element.getAttribute('face'));
      if (face) safeAttrs.face = face;
    }
    const align = String(element.getAttribute('align') || element.style.textAlign || '').toLowerCase();
    if (['left','center','right','justify'].includes(align)) safeAttrs.align = align;
    const font = normalizeBeritaFont(element.style.fontFamily);
    if (font && element.tagName !== 'FONT') safeAttrs.style = `font-family: '${font}'`;

    Array.from(element.attributes).forEach(attribute => element.removeAttribute(attribute.name));
    Object.entries(safeAttrs).forEach(([name, attrValue]) => element.setAttribute(name, attrValue));
  });
  return root.innerHTML.trim();
}

function beritaPlainText(value) {
  const html = sanitizeBeritaHtml(value);
  if (!html) return '';
  const doc = document.implementation.createHTMLDocument('');
  const root = doc.createElement('div');
  root.innerHTML = html;
  root.querySelectorAll('br').forEach(element => element.replaceWith(doc.createTextNode(' ')));
  root.querySelectorAll('p,div,h2,h3,blockquote,li').forEach(element => element.append(doc.createTextNode(' ')));
  return String(root.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function getBeritaEditorHtml() {
  const editor = document.getElementById('b-isi');
  return sanitizeBeritaHtml(editor?.innerHTML || '');
}

function getBeritaEditorText() {
  return beritaPlainText(document.getElementById('b-isi')?.innerHTML || '');
}

function setBeritaEditorContent(value) {
  const editor = document.getElementById('b-isi');
  if (editor) editor.innerHTML = sanitizeBeritaHtml(value);
}

function formatBerita(command, value = null) {
  const editor = document.getElementById('b-isi');
  if (!editor) return;
  editor.focus();
  if (_beritaSavedRange && editor.contains(_beritaSavedRange.commonAncestorContainer)) {
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(_beritaSavedRange);
  }
  document.execCommand(command, false, value);
  updateCharCount();
  scheduleDraftSave();
  updateBeritaToolbarState();
}

function tambahTautanBerita() {
  const editor = document.getElementById('b-isi');
  const selection = window.getSelection();
  const activeRange = selection?.rangeCount && !selection.isCollapsed
    ? selection.getRangeAt(0).cloneRange()
    : _beritaSavedRange?.cloneRange();
  if (!editor || !selection || !activeRange || activeRange.collapsed) {
    showToast('Blok teks yang ingin diberi tautan terlebih dahulu', true);
    return;
  }
  const range = activeRange;
  if (!editor.contains(range.commonAncestorContainer)) {
    showToast('Blok teks di dalam isi berita terlebih dahulu', true);
    return;
  }
  const url = window.prompt('Masukkan tautan lengkap (https://...)');
  if (!url) return;
  if (!isValidHttpUrl(url)) {
    showToast('Tautan harus diawali http:// atau https://', true);
    return;
  }
  editor.focus();
  selection.removeAllRanges();
  selection.addRange(range);
  formatBerita('createLink', url.trim());
}

function pastePlainTextBerita(event) {
  event.preventDefault();
  const text = event.clipboardData?.getData('text/plain') || '';
  document.execCommand('insertText', false, text);
}

function updateBeritaToolbarState() {
  ['bold','italic','underline','strikeThrough'].forEach(command => {
    const button = document.querySelector(`.rich-tool-btn[data-command="${command}"]`);
    if (button) button.classList.toggle('active', document.queryCommandState(command));
  });
}

document.addEventListener('selectionchange', () => {
  const editor = document.getElementById('b-isi');
  const selection = window.getSelection();
  if (editor && selection?.rangeCount && editor.contains(selection.anchorNode)) {
    _beritaSavedRange = selection.getRangeAt(0).cloneRange();
    updateBeritaToolbarState();
  }
});

// ── Preview berita ──
function previewBerita() {
  const judul  = document.getElementById('b-judul').value.trim();
  const isi    = getBeritaEditorHtml();
  const isiTeks = beritaPlainText(isi);
  const kat    = document.getElementById('b-kategori').value;
  const tgl    = document.getElementById('b-tanggal').value;
  const gambar = getBeritaPreviewUrl();
  if (!judul && !isiTeks) { showToast('Isi judul atau isi berita dahulu', true); return; }
  const BADGE_COL = {
    Pemerintahan:'#E3F4EC', Pengumuman:'#E3EEF7', Kegiatan:'#DDF0EB',
    Kesehatan:'#E3EEF7', Pendidikan:'#F7EDD0', Lingkungan:'#DDF0EB',
  };
  const BADGE_TXT = {
    Pemerintahan:'#1C6B3E', Pengumuman:'#1A5080', Kegiatan:'#0F6455',
    Kesehatan:'#1A5080', Pendidikan:'#B07D2A', Lingkungan:'#0F6455',
  };
  const tglFmt = tgl ? new Date(tgl).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}) : '—';
  document.getElementById('preview-body').innerHTML = `
    <span class="p-tag" style="background:${BADGE_COL[kat]||'#E3F4EC'};color:${BADGE_TXT[kat]||'#1C6B3E'};">${escHtml(kat)}</span>
    <div class="p-title">${escHtml(judul || '(tanpa judul)')}</div>
    <div class="p-meta"><i class="fa-regular fa-calendar"></i> ${tglFmt} · Desa Kandeman</div>
    ${gambar ? `<img class="p-img" src="${escHtml(gambar)}" alt="Gambar berita" onerror="this.remove()" />` : ''}
    <div class="p-content rich-content">${isi || '<p>(isi belum diisi)</p>'}</div>`;
  _dialogReturnFocus = document.activeElement;
  const modal = document.getElementById('preview-modal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  modal.querySelector('button')?.focus();
}
function closePreview(e) {
  if (!e || e.target === document.getElementById('preview-modal')) {
    const modal = document.getElementById('preview-modal');
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    if (_dialogReturnFocus && typeof _dialogReturnFocus.focus === 'function') _dialogReturnFocus.focus();
    _dialogReturnFocus = null;
  }
}
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (document.getElementById('confirm-modal')?.classList.contains('open')) closeConfirm();
  else if (document.getElementById('preview-modal')?.classList.contains('open')) closePreview();
});

// ── Auto-save draft berita ke localStorage ──
let _draftTimer = null;
function scheduleDraftSave() {
  clearTimeout(_draftTimer);
  _draftTimer = setTimeout(saveDraft, 5000);
}
function saveDraft() {
  const draft = {
    judul:  document.getElementById('b-judul').value,
    isi:    getBeritaEditorHtml(),
    kat:    document.getElementById('b-kategori').value,
    tgl:    document.getElementById('b-tanggal').value,
    savedAt: Date.now(),
  };
  try {
    localStorage.setItem('sikanda_draft_berita', JSON.stringify(draft));
    const ind = document.getElementById('autosave-ind');
    const txt = document.getElementById('autosave-text');
    if (ind) { ind.style.display = 'flex'; ind.className = 'autosave-ind saved'; }
    if (txt) txt.textContent = 'Draft tersimpan ' + new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
    setTimeout(() => { if (ind) ind.className = 'autosave-ind'; }, 4000);
  } catch {}
}
function loadDraft() {
  try {
    const raw = localStorage.getItem('sikanda_draft_berita');
    if (!raw) return;
    const draft = JSON.parse(raw);
    const judul = document.getElementById('b-judul').value;
    if (judul || (Date.now() - draft.savedAt > 86400000)) return;
    if (!draft.judul && !draft.isi) return;
    document.getElementById('b-judul').value    = draft.judul || '';
    setBeritaEditorContent(draft.isi || '');
    document.getElementById('b-kategori').value = draft.kat   || 'Pemerintahan';
    if (draft.tgl) document.getElementById('b-tanggal').value = draft.tgl;
    updateCharCount();
    const ind = document.getElementById('autosave-ind');
    const txt = document.getElementById('autosave-text');
    if (ind) { ind.style.display = 'flex'; ind.className = 'autosave-ind'; }
    if (txt) txt.textContent = 'Draft dipulihkan';
  } catch {}
}
function clearDraft() {
  try { localStorage.removeItem('sikanda_draft_berita'); } catch {}
  const ind = document.getElementById('autosave-ind');
  if (ind) ind.style.display = 'none';
}

// ── Filter + duplikat berita ──
let _allBerita = [];
function filterBerita() {
  const q   = (document.getElementById('berita-search')?.value || '').toLowerCase();
  const kat = document.getElementById('berita-filter-kat')?.value || '';
  const filtered = _allBerita.filter(b =>
    (!q   || b.judul.toLowerCase().includes(q) || beritaPlainText(b.isi).toLowerCase().includes(q)) &&
    (!kat || b.kategori === kat)
  );
  renderBeritaTable(filtered);
  const cnt = document.getElementById('berita-filter-count');
  if (cnt) cnt.textContent = filtered.length < _allBerita.length ? `${filtered.length} dari ${_allBerita.length}` : '';
}

function duplikatBerita(id) {
  const b = _beritaMap[id];
  if (!b) return;
  document.getElementById('berita-id').value     = '';
  document.getElementById('b-judul').value       = '[Salinan] ' + b.judul;
  setBeritaEditorContent(b.isi || '');
  document.getElementById('b-kategori').value    = b.kategori;
  document.getElementById('b-tanggal').value     = new Date().toISOString().slice(0,10);
  resetBeritaImageState();
  updateCharCount();
  document.getElementById('berita-form-title').textContent = 'Duplikat berita';
  document.getElementById('panel-berita').scrollIntoView({ behavior:'smooth' });
  showToast('Isi disalin — simpan untuk mempublikasikan');
}

function renderBeritaTable(data) {
  const el = document.getElementById('berita-list');
  if (!data.length) {
    el.innerHTML = '<div class="empty"><i class="fa-solid fa-newspaper"></i>Tidak ada berita yang cocok.</div>';
    return;
  }
  el.innerHTML = `<table><thead><tr>
    <th>Kategori</th><th>Judul</th><th>Tanggal</th>
    <th>Status</th><th>Aksi</th>
  </tr></thead><tbody>
    ${data.map(b => `<tr>
      <td><span class="badge ${BADGE_BERITA[b.kategori]||'badge-green'}">${escHtml(b.kategori)}</span></td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(b.judul)}</td>
      <td style="white-space:nowrap;font-size:12px;">${escHtml(b.tanggal)}</td>
      <td>
        <button class="toggle ${b.aktif?'on':''}" title="${b.aktif?'Nonaktifkan':'Aktifkan'}"
          onclick="toggleAktifBerita('${b.id}',${b.aktif})"></button>
      </td>
      <td style="white-space:nowrap;">
        <button class="icon-btn" onclick="editBerita('${escHtml(b.id)}')" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
        <button class="icon-btn" onclick="duplikatBerita('${escHtml(b.id)}')" title="Duplikat"><i class="fa-solid fa-copy"></i></button>
        <button class="icon-btn danger" onclick="konfirmasiHapusBerita('${escHtml(b.id)}')" title="Hapus"><i class="fa-solid fa-trash-can"></i></button>
      </td>
    </tr>`).join('')}
  </tbody></table>`;
}

// ── Char counter berita ──
function updateCharCount() {
  const isi  = getBeritaEditorText();
  const el   = document.getElementById('b-isi-count');
  const len  = isi.length;
  el.textContent = len.toLocaleString('id-ID') + ' karakter';
  el.className = 'char-count' + (len > 3000 ? ' over' : '');
}

// ── Upload & preview gambar berita ──
let _beritaPreviewObjectUrl = '';

function revokeBeritaPreviewObjectUrl() {
  if (!_beritaPreviewObjectUrl) return;
  URL.revokeObjectURL(_beritaPreviewObjectUrl);
  _beritaPreviewObjectUrl = '';
}

function getBeritaPreviewUrl() {
  const wrap = document.getElementById('b-gambar-preview-wrap');
  const img = document.getElementById('b-gambar-preview');
  return wrap?.classList.contains('show') ? (img?.src || '') : '';
}

function previewGambarBerita(url, isLocalFile = false) {
  const wrap = document.getElementById('b-gambar-preview-wrap');
  const img  = document.getElementById('b-gambar-preview');
  const removeBtn = document.getElementById('btn-hapus-gambar-berita');
  if (url && (isLocalFile || isValidHttpUrl(url))) {
    img.src = url;
    wrap.classList.add('show');
    if (removeBtn) removeBtn.style.display = 'inline-flex';
  } else {
    img.removeAttribute('src');
    wrap.classList.remove('show');
    if (removeBtn) removeBtn.style.display = 'none';
  }
}

function resetBeritaImageState(currentUrl = '') {
  revokeBeritaPreviewObjectUrl();
  const fileInput = document.getElementById('b-gambar-file');
  if (fileInput) fileInput.value = '';
  document.getElementById('b-gambar-current-url').value = currentUrl || '';
  document.getElementById('b-gambar-remove').value = '0';
  previewGambarBerita(currentUrl || '');
}

function hapusPilihanGambarBerita() {
  revokeBeritaPreviewObjectUrl();
  const fileInput = document.getElementById('b-gambar-file');
  if (fileInput) fileInput.value = '';
  document.getElementById('b-gambar-remove').value = '1';
  previewGambarBerita('');
  scheduleDraftSave();
}

function handleBeritaImageSelection(input) {
  revokeBeritaPreviewObjectUrl();
  const file = input?.files?.[0];
  if (!file) {
    const currentUrl = document.getElementById('b-gambar-current-url').value;
    document.getElementById('b-gambar-remove').value = '0';
    previewGambarBerita(currentUrl || '');
    return;
  }

  const validation = validateUploadFile(file, 'berita-image', 5 * 1024 * 1024);
  if (!validation.ok) {
    input.value = '';
    showToast(validation.message, true);
    const currentUrl = document.getElementById('b-gambar-current-url').value;
    previewGambarBerita(currentUrl || '');
    return;
  }

  document.getElementById('b-gambar-remove').value = '0';
  _beritaPreviewObjectUrl = URL.createObjectURL(file);
  previewGambarBerita(_beritaPreviewObjectUrl, true);
  scheduleDraftSave();
}

// ════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════
let loginAttempts = 0;
let loginLockUntil = 0;
let inactivityListenersBound = false;

// Daftar ini hanya metadata tampilan tambahan. Hak akses sebenarnya diverifikasi
// dari public.profiles.role dan tetap dipaksa oleh kebijakan RLS di database.
const ADMIN_EMAILS = [
  '67sikanda@gmail.com',
  // TODO: Tambahkan email admin lain hanya untuk penanda tampilan bila diperlukan.
];

async function getVerifiedAdminProfile(userId) {
  if (!userId) return null;
  try {
    const { data, error } = await sb
      .from('profiles')
      .select('id,email,role')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    return data && data.role === 'admin' ? data : null;
  } catch (error) {
    console.error('Gagal memverifikasi role admin:', error);
    return null;
  }
}

async function doLogin() {
  if (!sb?.auth) {
    showLoginErr('Layanan autentikasi belum dapat dimuat. Muat ulang halaman.');
    return;
  }
  const now = Date.now();
  if (now < loginLockUntil) {
    const sisa = Math.ceil((loginLockUntil-now)/1000);
    showLoginErr(`Terlalu banyak percobaan. Coba lagi dalam ${sisa} detik.`);
    return;
  }
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const btn   = document.getElementById('login-btn');
  document.getElementById('login-error').style.display = 'none';
  btn.textContent = 'Memuat...'; btn.disabled = true;

  if (!email || !pass) {
    showLoginErr('Email dan password wajib diisi.');
    resetLoginBtn(); return;
  }

  try {
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) {
      loginAttempts++;
      if (loginAttempts >= 5) {
        loginLockUntil = Date.now() + 60000;
        loginAttempts = 0;
        showLoginErr('Terlalu banyak percobaan. Akun dikunci 60 detik.');
      } else {
        showLoginErr(`Email atau password salah. ${5-loginAttempts} percobaan tersisa.`);
      }
      document.getElementById('login-pass').value = '';
      return;
    }
    loginAttempts = 0;
    await showAdminShell();
  } catch (error) {
    console.error('Proses login gagal:', error);
    showLoginErr('Login belum dapat diproses. Silakan coba lagi.');
  } finally {
    resetLoginBtn();
  }
}

function showLoginErr(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg; el.style.display = 'block';
}
function resetLoginBtn() {
  const btn = document.getElementById('login-btn');
  btn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket" style="margin-right:6px;"></i>Masuk ke Panel Admin';
  btn.disabled = false;
}

async function doLogout() {
  try {
    await sb.auth.signOut();
  } catch (error) {
    console.error('Logout gagal:', error);
  } finally {
    document.getElementById('admin-shell').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
  }
}

let inactivityTimer = null;
function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(async () => {
    try {
      await sb.auth.signOut();
    } catch (error) {
      console.error('Logout otomatis gagal:', error);
    } finally {
      document.getElementById('admin-shell').style.display = 'none';
      document.getElementById('login-screen').style.display = 'flex';
      showLoginErr('Sesi berakhir karena tidak aktif selama 30 menit.');
    }
  }, 30*60*1000);
}

async function showAdminShell() {
  let user;
  try {
    const response = await sb.auth.getUser();
    user = response.data?.user || null;
  } catch (error) {
    console.error('Gagal memulihkan pengguna:', error);
  }
  if (!user) return false;
  const email = user.email || '';

  const profile = await getVerifiedAdminProfile(user.id);
  if (!profile) {
    try {
      await sb.auth.signOut();
    } catch (error) {
      console.error('Gagal mengakhiri sesi non-admin:', error);
    }
    showLoginErr('Akun ini tidak memiliki akses admin yang terverifikasi.');
    return false;
  }

  document.getElementById('sb-email').textContent  = email;
  document.getElementById('sb-avatar').textContent = email.slice(0,2).toUpperCase();
  document.getElementById('sb-avatar').dataset.knownAdmin = String(ADMIN_EMAILS.includes(email));
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('admin-shell').style.display  = 'flex';
  document.getElementById('b-tanggal').value = new Date().toISOString().slice(0,10);
  renderLraInputs();
  loadDashboard();

  resetInactivityTimer();
  if (!inactivityListenersBound) {
    ['click','keydown','mousemove','touchstart'].forEach(e =>
      document.addEventListener(e, resetInactivityTimer, { passive:true })
    );
    inactivityListenersBound = true;
  }
  return true;
}

(async () => {
  if (!sb) {
    showLoginErr('Layanan autentikasi belum dapat dimuat. Muat ulang halaman.');
    return;
  }
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) await showAdminShell();
  } catch (error) {
    console.error('Pemulihan sesi gagal:', error);
  }
})();

// ════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════
async function loadDashboard() {
  // Greeting sesuai waktu
  const jam = new Date().getHours();
  let sapa = 'Selamat malam';
  if (jam >= 4 && jam < 11)  sapa = 'Selamat pagi';
  else if (jam >= 11 && jam < 15) sapa = 'Selamat siang';
  else if (jam >= 15 && jam < 19) sapa = 'Selamat sore';
  document.getElementById('dash-greeting').textContent = sapa + ', Admin! 👋';
  document.getElementById('dash-date').textContent = new Date().toLocaleDateString('id-ID', {
    weekday:'long', day:'numeric', month:'long', year:'numeric'
  });

  const counts = [
    { tbl:'berita',    id:'dash-berita',    filter:{ aktif:true } },
    { tbl:'perangkat', id:'dash-perangkat', filter:{ aktif:true } },
    { tbl:'galeri',    id:'dash-galeri',    filter:{ aktif:true } },
    { tbl:'potensi',   id:'dash-potensi',   filter:{ aktif:true } },
  ];
  for (const c of counts) {
    try {
      const { count } = await sb.from(c.tbl).select('*',{count:'exact',head:true}).match(c.filter);
      document.getElementById(c.id).textContent = count ?? 0;
    } catch { document.getElementById(c.id).textContent = '!'; }
  }

  // APBDes summary
  try {
    const { data } = await sb.from('apbdes').select('*').order('tahun',{ascending:false}).limit(1);
    const el = document.getElementById('dash-apbdes-info');
    if (data?.length) {
      const d = data[0];
      const upd = d.updated_at ? new Date(d.updated_at).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}) : '—';
      el.innerHTML = `
        <strong>APBDes ${d.tahun}</strong> — Total: <strong>${fmtRpShort(d.total_anggaran)}</strong><br>
        <span style="color:var(--text-muted);font-size:12px;">Terakhir diperbarui: ${upd}</span>`;
    } else {
      el.textContent = 'Data APBDes belum tersedia. Tambahkan di menu APBDes.';
    }
  } catch { /* abaikan */ }

  // Berita terbaru (3 item)
  try {
    const { data } = await sb.from('berita').select('judul,kategori,tanggal,aktif')
      .order('tanggal',{ascending:false}).limit(3);
    const el = document.getElementById('dash-recent');
    if (!data?.length) {
      el.innerHTML = '<div class="empty" style="padding:16px;"><i class="fa-solid fa-newspaper"></i>Belum ada berita.</div>';
    } else {
      const DOTS = {
        Pemerintahan:['#E3F4EC','#1C6B3E','fa-landmark'], Pengumuman:['#E3EEF7','#1A5080','fa-bullhorn'],
        Kegiatan:['#DDF0EB','#0F6455','fa-calendar-check'], Kesehatan:['#E3EEF7','#1A5080','fa-heart-pulse'],
        Pendidikan:['#F7EDD0','#B07D2A','fa-graduation-cap'], Lingkungan:['#DDF0EB','#0F6455','fa-leaf'],
      };
      el.innerHTML = data.map(b => {
        const [bg, fg, ic] = DOTS[b.kategori] || DOTS.Pemerintahan;
        const tgl = new Date(b.tanggal).toLocaleDateString('id-ID',{day:'numeric',month:'short'});
        return `<div class="recent-item">
          <div class="recent-dot" style="background:${bg};color:${fg};"><i class="fa-solid ${ic}"></i></div>
          <div style="flex:1;min-width:0;">
            <div class="recent-title" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(b.judul)}</div>
            <div class="recent-meta">${escHtml(b.kategori)} · ${tgl}${b.aktif ? '' : ' · <span style="color:var(--danger)">nonaktif</span>'}</div>
          </div>
        </div>`;
      }).join('');
    }
  } catch { /* abaikan */ }

  // ── Mini bar chart: berita 6 bulan terakhir ──
  try {
    const { data: chartData } = await sb.from('berita')
      .select('tanggal').order('tanggal',{ascending:true});
    const wrap = document.getElementById('dash-chart-wrap');
    if (wrap && chartData?.length) {
      // Hitung per bulan
      const counts = {};
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        counts[key] = 0;
      }
      chartData.forEach(b => {
        const key = b.tanggal?.slice(0,7);
        if (key && counts[key] !== undefined) counts[key]++;
      });
      const vals = Object.values(counts);
      const labels = Object.keys(counts).map(k => {
        const [y,m] = k.split('-');
        return new Date(+y, +m-1).toLocaleDateString('id-ID',{month:'short'});
      });
      const maxV = Math.max(...vals, 1);
      wrap.innerHTML = vals.map((v,i) => `
        <div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;" title="${labels[i]}: ${v} berita">
          <div style="width:100%;max-width:18px;background:var(--emerald);opacity:${0.4 + (v/maxV)*0.6};border-radius:2px 2px 0 0;height:${Math.max(3, (v/maxV)*28)}px;"></div>
          <span style="font-size:8px;color:var(--text-muted);">${labels[i].slice(0,3)}</span>
        </div>`).join('');
    }
  } catch { /* abaikan */ }
}

// ════════════════════════════════════════════
// BERITA
// ════════════════════════════════════════════
const _beritaMap = {};
const BADGE_BERITA = {
  Pemerintahan:'badge-green', Pengumuman:'badge-sky', Kegiatan:'badge-teal',
  Kesehatan:'badge-sky', Pendidikan:'badge-gold', Lingkungan:'badge-teal',
};

async function loadBerita() {
  const { data, error } = await sb.from('berita').select('*').order('tanggal',{ascending:false});
  const el = document.getElementById('berita-list');
  if (error || !data?.length) {
    _allBerita = [];
    el.innerHTML = '<div class="empty"><i class="fa-solid fa-newspaper"></i>Belum ada berita. Tambahkan di atas.</div>';
    return;
  }
  _allBerita = data;
  data.forEach(b => { _beritaMap[b.id] = b; });
  renderBeritaTable(data);
  // Reset filter
  const s = document.getElementById('berita-search');
  const k = document.getElementById('berita-filter-kat');
  if (s) s.value = '';
  if (k) k.value = '';
  const cnt = document.getElementById('berita-filter-count');
  if (cnt) cnt.textContent = '';
}

async function toggleAktifBerita(id, aktifSekarang) {
  const { data, error } = await sb.from('berita')
    .update({ aktif: !aktifSekarang })
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error || !data?.id) {
    showToast('Gagal mengubah status: ' + (error?.message || 'data tidak ditemukan atau akses ditolak.'), true);
    return;
  }
  showToast(aktifSekarang ? 'Berita dinonaktifkan' : 'Berita diaktifkan');
  loadBerita();
}

function beritaSaveErrorMessage(error) {
  const message = String(error?.message || 'kesalahan tidak diketahui.');
  const code = String(error?.code || '');
  const missingImageColumn = /gambar_url/i.test(message)
    && (code === 'PGRST204' || /schema cache|column/i.test(message));

  if (missingImageColumn) {
    return 'Database belum siap untuk gambar berita. Jalankan file supabase-berita-gambar.sql di Supabase SQL Editor, lalu muat ulang halaman admin.';
  }
  return message;
}

async function simpanBerita() {
  const id    = document.getElementById('berita-id').value;
  const judul = document.getElementById('b-judul').value.trim();
  const isi   = getBeritaEditorHtml();
  const isiTeks = beritaPlainText(isi);
  const kat   = document.getElementById('b-kategori').value;
  const tgl   = document.getElementById('b-tanggal').value;
  const file  = document.getElementById('b-gambar-file').files[0] || null;
  const gambarLama = document.getElementById('b-gambar-current-url').value.trim() || null;
  const hapusGambar = document.getElementById('b-gambar-remove').value === '1';
  if (!judul || !isiTeks) { showToast('Judul dan isi berita wajib diisi', true); return; }
  if (judul.length > 180) { showToast('Judul berita maksimal 180 karakter.', true); return; }
  if (isiTeks.length > 20000 || isi.length > 60000) { showToast('Isi berita maksimal 20.000 karakter.', true); return; }
  if (!tgl || Number.isNaN(Date.parse(tgl))) { showToast('Tanggal berita tidak valid.', true); return; }
  if (file) {
    const validation = validateUploadFile(file, 'berita-image', 5 * 1024 * 1024);
    if (!validation.ok) { showToast(validation.message, true); return; }
  }

  const btn = document.getElementById('btn-simpan-berita');
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';

  let uploadedPath = '';
  try {
    let gambarUrl = hapusGambar ? null : gambarLama;
    if (file) {
      const uploaded = await uploadValidatedFile(file, {
        kind: 'berita-image', folder: 'galeri/berita', maxBytes: 5 * 1024 * 1024,
      });
      uploadedPath = uploaded.storagePath;
      gambarUrl = uploaded.publicUrl;
    }

    // Jangan mengirim updated_at: sebagian instalasi lama tabel berita tidak
    // memiliki kolom tersebut sehingga INSERT/UPDATE selalu gagal.
    const payload = { judul, isi, kategori:kat, tanggal:tgl, gambar_url:gambarUrl };
    const query = id
      ? sb.from('berita').update(payload).eq('id', id)
      : sb.from('berita').insert({ ...payload, aktif:true });
    const { data: saved, error } = await query.select('id').maybeSingle();
    if (error) throw error;
    if (!saved?.id) throw new Error('Data tidak tersimpan. Periksa sesi login dan izin tabel berita.');

    const oldPath = storagePathFromPublicUrl(gambarLama || '');
    if ((file || hapusGambar) && oldPath && oldPath !== uploadedPath) {
      await rollbackUploadedFile(oldPath);
    }
    showToast(id ? 'Berita diperbarui' : 'Berita dipublikasikan');
    showLastSaved('Berita disimpan ' + new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}));
    clearDraft();
    resetBeritaForm();
    await Promise.all([loadBerita(), loadDashboard()]);
  } catch (error) {
    if (uploadedPath) await rollbackUploadedFile(uploadedPath);
    console.error('Gagal menyimpan berita:', error);
    showToast(error instanceof UploadValidationError
      ? error.message
      : 'Berita gagal disimpan: ' + beritaSaveErrorMessage(error), true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Simpan & Publikasikan';
  }
}

function editBerita(id) {
  const b = _beritaMap[id];
  if (!b) { showToast('Data berita tidak ditemukan', true); return; }
  document.getElementById('berita-id').value    = b.id;
  document.getElementById('b-judul').value      = b.judul;
  setBeritaEditorContent(b.isi || '');
  document.getElementById('b-kategori').value   = b.kategori;
  document.getElementById('b-tanggal').value    = b.tanggal;
  resetBeritaImageState(b.gambar_url || '');
  updateCharCount();
  document.getElementById('berita-form-title').textContent = 'Edit berita';
  document.getElementById('panel-berita').scrollIntoView({ behavior:'smooth' });
}

function konfirmasiHapusBerita(id) {
  const b = _beritaMap[id];
  openConfirm(
    'Hapus berita ini?',
    `"${b?.judul || id}" akan dihapus permanen dan tidak bisa dikembalikan.`,
    'Hapus',
    () => hapusBerita(id)
  );
}

async function hapusBerita(id) {
  const storagePath = storagePathFromPublicUrl(_beritaMap[id]?.gambar_url || '');
  const hasil = await hapusBaris('berita', id);
  if (!hasil.ok) { showToast(hasil.pesan, true); return; }
  if (storagePath) await rollbackUploadedFile(storagePath);
  showToast('Berita dihapus'); loadBerita(); loadDashboard();
}

function resetBeritaForm() {
  document.getElementById('berita-id').value     = '';
  document.getElementById('b-judul').value       = '';
  setBeritaEditorContent('');
  resetBeritaImageState();
  document.getElementById('b-tanggal').value     = new Date().toISOString().slice(0,10);
  document.getElementById('b-gambar-preview-wrap').classList.remove('show');
  document.getElementById('berita-form-title').textContent = 'Tambah berita / pengumuman';
  updateCharCount();
}

// ════════════════════════════════════════════
// PREVIEW FOTO
// ════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('b-gambar-file')?.addEventListener('change', function() {
    handleBeritaImageSelection(this);
  });

  // Preview galeri
  document.getElementById('g-file')?.addEventListener('change', function() {
    const file = this.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('preview-img').src = e.target.result;
      document.getElementById('upload-preview').classList.add('show');
    };
    reader.readAsDataURL(file);
  });

  // Preview foto perangkat
  document.getElementById('p-foto-file')?.addEventListener('change', function() {
    const file = this.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('p-foto-preview').src = e.target.result;
      document.getElementById('p-foto-preview-name').textContent = file.name;
      const wrap = document.getElementById('p-foto-preview-wrap');
      wrap.style.display = 'flex';
    };
    reader.readAsDataURL(file);
  });
});

// ════════════════════════════════════════════
// GALERI
// ════════════════════════════════════════════
const _galeriMap = {};

let _galeriUrut = [];

async function loadGaleri() {
  const { data, error } = await sb.from('galeri')
    .select('*').order('urutan',{ascending:true}).order('created_at',{ascending:false});
  const el = document.getElementById('galeri-list');
  if (error) { el.innerHTML = '<div class="empty"><i class="fa-solid fa-triangle-exclamation"></i>Error: '+error.message+'</div>'; return; }
  if (!data?.length) {
    el.innerHTML = '<div class="empty"><i class="fa-solid fa-images"></i>Belum ada foto. Upload di atas.</div>'; return;
  }
  data.forEach(g => { _galeriMap[g.id] = g; });
  _galeriUrut = data.map(g => g.id);
  el.innerHTML = `
  <div class="galeri-drag-hint">
    <i class="fa-solid fa-grip-vertical"></i> Seret foto untuk mengubah urutan tampil di website
  </div>
  <div class="galeri-sort-grid" id="galeri-sort-grid">
    ${data.map((g,i) => `
    <div class="galeri-sort-item" draggable="true" data-id="${escHtml(g.id)}" data-idx="${i}"
         ondragstart="galDragStart(event)" ondragover="galDragOver(event)"
         ondrop="galDrop(event)" ondragend="galDragEnd(event)" ondragleave="galDragLeave(event)">
      <img src="${safeAdminUrl(g.url_foto||'')}" alt="${escHtml(g.judul||'')}" loading="lazy"
           onerror="this.style.display='none'" />
      <div class="galeri-sort-overlay">
        <button class="icon-btn danger" onclick="event.stopPropagation();konfirmasiHapusGaleri('${escHtml(g.id)}')"
          style="background:rgba(255,255,255,.92);" title="Hapus">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
      <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.65));padding:14px 7px 5px;font-size:9.5px;color:#fff;line-height:1.3;pointer-events:none;">
        ${escHtml(g.judul||'')}
      </div>
    </div>`).join('')}
  </div>
  <div style="margin-top:12px;display:flex;justify-content:flex-end;">
    <button class="btn btn-primary" id="btn-simpan-urutan" onclick="simpanUrutanGaleri()" style="display:none;">
      <i class="fa-solid fa-floppy-disk"></i> Simpan urutan
    </button>
  </div>`;
}

// ── Drag & drop galeri ──
let _galDragEl = null;
function galDragStart(e) {
  _galDragEl = e.currentTarget;
  _galDragEl.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}
function galDragOver(e) {
  e.preventDefault();
  const t = e.currentTarget;
  if (t !== _galDragEl) t.classList.add('drag-over');
}
function galDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
function galDrop(e) {
  e.preventDefault();
  const target = e.currentTarget;
  target.classList.remove('drag-over');
  if (!_galDragEl || target === _galDragEl) return;
  const grid = document.getElementById('galeri-sort-grid');
  const anak = [...grid.children];
  const iDrag = anak.indexOf(_galDragEl);
  const iDrop = anak.indexOf(target);
  if (iDrag < iDrop) target.after(_galDragEl);
  else target.before(_galDragEl);
  // Perbarui urutan
  _galeriUrut = [...grid.children].map(el => el.dataset.id);
  document.getElementById('btn-simpan-urutan').style.display = 'inline-flex';
}
function galDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.galeri-sort-item').forEach(el => el.classList.remove('drag-over'));
  _galDragEl = null;
}

async function simpanUrutanGaleri() {
  const btn = document.getElementById('btn-simpan-urutan');
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';
  try {
    let gagal = 0;
    for (let i = 0; i < _galeriUrut.length; i++) {
      const { error } = await sb.from('galeri').update({ urutan: i + 1 }).eq('id', _galeriUrut[i]);
      if (error) gagal++;
    }
    if (gagal) { showToast(`${gagal} foto gagal disimpan`, true); return; }
    showToast('Urutan galeri disimpan');
    btn.style.display = 'none';
  } catch (error) {
    console.error('Gagal menyimpan urutan galeri:', error);
    showToast('Urutan galeri gagal disimpan.', true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan urutan';
  }
}

async function uploadGaleri() {
  const file  = document.getElementById('g-file').files[0];
  const judul = document.getElementById('g-judul').value.trim();
  const ket   = document.getElementById('g-ket').value.trim();
  if (!file)  { showToast('Pilih foto terlebih dahulu', true); return; }
  if (!judul) { showToast('Judul foto wajib diisi', true); return; }
  if (judul.length > 150) { showToast('Judul foto maksimal 150 karakter', true); return; }

  const btn = document.getElementById('btn-upload-galeri');
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengupload...';
  let uploadedPath = '';
  try {
    const uploaded = await uploadValidatedFile(file, {
      kind: 'image', folder: 'galeri', maxBytes: 5 * 1024 * 1024,
    });
    uploadedPath = uploaded.storagePath;
    const { error } = await sb.from('galeri').insert({
      url_foto: uploaded.publicUrl,
      judul,
      keterangan: ket || judul,
      aktif: true,
    });
    if (error) throw error;

    showToast('✓ Foto berhasil diupload!');
    showLastSaved('Foto diupload ' + new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}));
    document.getElementById('g-file').value   = '';
    document.getElementById('g-judul').value  = '';
    document.getElementById('g-ket').value    = '';
    document.getElementById('upload-preview').classList.remove('show');
    await Promise.all([loadGaleri(), loadDashboard()]);
  } catch (error) {
    if (uploadedPath) await rollbackUploadedFile(uploadedPath);
    console.error('Gagal mengunggah galeri:', error);
    showToast(error instanceof UploadValidationError ? error.message : 'Foto gagal diunggah atau disimpan.', true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Upload Foto';
  }
}

function konfirmasiHapusGaleri(id) {
  const g = _galeriMap[id];
  openConfirm('Hapus foto ini?',
    `"${g?.judul || 'Foto ini'}" akan dihapus permanen dari server dan tidak bisa dikembalikan.`,
    'Hapus', () => hapusGaleri(id)
  );
}

async function hapusGaleri(id) {
  const g = _galeriMap[id];
  const hasil = await hapusBaris('galeri', id);
  if (!hasil.ok) { showToast(hasil.pesan, true); return; }
  const storagePath = storagePathFromPublicUrl(g?.url_foto || '');
  if (storagePath) await rollbackUploadedFile(storagePath);
  showToast('Foto dihapus'); loadGaleri(); loadDashboard();
}

// ════════════════════════════════════════════
// PERANGKAT
// ════════════════════════════════════════════
const _perangkatMap = {};
const JABATAN_URUTAN = {
  'Kepala Desa':1,'Sekretaris Desa':2,
  'Kaur TU & Umum':3,'Kaur Keuangan':4,'Kaur Perencanaan':5,
  'Kasi Pemerintahan':6,'Kasi Kesejahteraan':7,'Kasi Pelayanan':8,
  'Kadus Randusari':9,'Kadus Kandeman':10,'Kadus Gandok':11,'Kadus Kaliongkek':12,'Kadus Johosari':13,
};

async function loadPerangkat() {
  const { data } = await sb.from('perangkat').select('*').order('urutan').order('jabatan');
  const el = document.getElementById('perangkat-list');
  if (!data?.length) {
    el.innerHTML = '<tr><td colspan="5"><div class="empty"><i class="fa-solid fa-user-tie"></i>Belum ada data perangkat.</div></td></tr>';
    return;
  }
  data.forEach(p => { _perangkatMap[p.id] = p; });
  el.innerHTML = data.map((p,i) => {
    const fotoHtml = p.foto_url
      ? `<img src="${safeAdminUrl(p.foto_url)}" alt="${escHtml(p.nama || 'Perangkat desa')}" loading="lazy" style="width:34px;height:34px;border-radius:50%;object-fit:cover;border:1.5px solid var(--border);vertical-align:middle;margin-right:8px;" onerror="this.style.display='none'" />`
      : `<span style="display:inline-flex;width:34px;height:34px;border-radius:50%;background:var(--surface);border:1.5px solid var(--border);align-items:center;justify-content:center;color:var(--text-muted);font-size:12px;margin-right:8px;vertical-align:middle;">${escHtml(p.nama.slice(0,2).toUpperCase())}</span>`;
    return `<tr>
      <td>${i+1}</td>
      <td style="white-space:nowrap;">${fotoHtml}<span style="font-weight:500;vertical-align:middle;">${escHtml(p.nama)}</span></td>
      <td>${escHtml(p.jabatan)}</td>
      <td>${p.foto_url ? '<span style="font-size:11px;color:var(--emerald);"><i class="fa-solid fa-image"></i> Ada</span>' : '<span style="font-size:11px;color:var(--text-muted);">—</span>'}</td>
      <td>
        <button class="icon-btn" onclick="editPerangkat('${escHtml(p.id)}')" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
        <button class="icon-btn danger" onclick="konfirmasiHapusPerangkat('${escHtml(p.id)}')" title="Hapus"><i class="fa-solid fa-trash-can"></i></button>
      </td>
    </tr>`;
  }).join('');
}

async function simpanPerangkat() {
  const id      = document.getElementById('p-id').value;
  const nama    = document.getElementById('p-nama').value.trim();
  const jabatan = document.getElementById('p-jabatan').value;
  const urutanRaw = Number(document.getElementById('p-urutan').value);
  const urutan  = Number.isFinite(urutanRaw) ? urutanRaw : (JABATAN_URUTAN[jabatan] || 99);
  if (!nama) { showToast('Nama wajib diisi', true); return; }
  if (nama.length > 150) { showToast('Nama maksimal 150 karakter', true); return; }
  if (urutan < 0) { showToast('Nomor urutan tidak boleh negatif', true); return; }

  const btn = document.getElementById('btn-simpan-perangkat');
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';

  let foto_url = document.getElementById('p-foto-url').value || null;
  const fotoFile = document.getElementById('p-foto-file').files[0];
  let uploadedPath = '';
  try {
    if (fotoFile) {
      const uploaded = await uploadValidatedFile(fotoFile, {
        kind: 'image', folder: 'perangkat', maxBytes: 3 * 1024 * 1024,
      });
      uploadedPath = uploaded.storagePath;
      foto_url = uploaded.publicUrl;
    }

    const payload = { nama, jabatan, urutan, foto_url, updated_at: new Date().toISOString() };
    const { error } = id
      ? await sb.from('perangkat').update(payload).eq('id',id)
      : await sb.from('perangkat').insert({ ...payload, aktif:true });
    if (error) throw error;

    const oldPath = storagePathFromPublicUrl(_perangkatMap[id]?.foto_url || '');
    if (uploadedPath && oldPath && oldPath !== uploadedPath) await rollbackUploadedFile(oldPath);
    showToast('✓ Data perangkat disimpan');
    showLastSaved('Perangkat disimpan ' + new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}));
    resetPerangkatForm();
    await Promise.all([loadPerangkat(), loadDashboard()]);
  } catch (error) {
    if (uploadedPath) await rollbackUploadedFile(uploadedPath);
    console.error('Gagal menyimpan perangkat:', error);
    showToast(error instanceof UploadValidationError ? error.message : 'Data perangkat gagal disimpan.', true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Simpan';
  }
}

function editPerangkat(id) {
  const p = _perangkatMap[id];
  if (!p) { showToast('Data tidak ditemukan', true); return; }
  document.getElementById('p-id').value       = p.id;
  document.getElementById('p-nama').value     = p.nama;
  document.getElementById('p-jabatan').value  = p.jabatan;
  document.getElementById('p-urutan').value   = p.urutan || JABATAN_URUTAN[p.jabatan] || 99;
  document.getElementById('p-foto-url').value = p.foto_url || '';
  const wrap = document.getElementById('p-foto-preview-wrap');
  if (p.foto_url) {
    document.getElementById('p-foto-preview').src = isValidHttpUrl(p.foto_url) ? p.foto_url : '';
    document.getElementById('p-foto-preview-name').textContent = 'Foto tersimpan — upload baru untuk mengganti';
    wrap.style.display = 'flex';
  } else {
    wrap.style.display = 'none';
  }
  document.getElementById('perangkat-form-title').textContent = 'Edit perangkat desa';
  document.getElementById('panel-perangkat').scrollIntoView({ behavior:'smooth' });
}

function konfirmasiHapusPerangkat(id) {
  const p = _perangkatMap[id];
  openConfirm('Hapus perangkat ini?',
    `Data "${p?.nama || id}" akan dihapus permanen.`,
    'Hapus', () => hapusPerangkat(id)
  );
}

async function hapusPerangkat(id) {
  const storagePath = storagePathFromPublicUrl(_perangkatMap[id]?.foto_url || '');
  const hasil = await hapusBaris('perangkat', id);
  if (!hasil.ok) { showToast(hasil.pesan, true); return; }
  if (storagePath) await rollbackUploadedFile(storagePath);
  showToast('Data dihapus'); loadPerangkat(); loadDashboard();
}

function resetPerangkatForm() {
  document.getElementById('p-id').value        = '';
  document.getElementById('p-nama').value      = '';
  document.getElementById('p-urutan').value    = 99;
  document.getElementById('p-foto-url').value  = '';
  document.getElementById('p-foto-file').value = '';
  document.getElementById('p-foto-preview-wrap').style.display = 'none';
  document.getElementById('perangkat-form-title').textContent = 'Tambah perangkat desa';
}

// ════════════════════════════════════════════
// APBDES — format Laporan Realisasi APB Desa (LRA)
// ════════════════════════════════════════════
const FINANCE_DOCUMENT_TYPES = Object.freeze({
  apbdes: { label:'APBDes', icon:'fa-file-invoice-dollar' },
  realisasi_anggaran: { label:'Realisasi Anggaran', icon:'fa-chart-column' },
  laporan_keuangan: { label:'Laporan Keuangan', icon:'fa-book-open' },
  lppd: { label:'LPPD', icon:'fa-landmark' },
});
const FINANCE_DOCUMENT_YEARS = Object.freeze([2024, 2025, 2026]);

const LRA_SECTIONS = {
  pendapatan: [
    ['pad', 'Pendapatan Asli Desa'], ['dana_desa', 'Dana Desa'],
    ['bagi_hasil', 'Bagi Hasil Pajak dan Retribusi'], ['add', 'Alokasi Dana Desa'],
    ['bantuan_provinsi', 'Bantuan Keuangan Provinsi'], ['bantuan_kabupaten', 'Bantuan Keuangan Kabupaten/Kota'],
    ['lain_lain', 'Pendapatan Lain-lain'],
  ],
  belanja: [
    ['penyelenggaraan', 'Bidang Penyelenggaraan Pemerintahan Desa'], ['pelaksanaan', 'Bidang Pelaksanaan Pembangunan Desa'],
    ['pembinaan', 'Bidang Pembinaan Kemasyarakatan'], ['pemberdayaan', 'Bidang Pemberdayaan Masyarakat'],
    ['penanggulangan_bencana', 'Bidang Penanggulangan Bencana, Darurat dan Mendesak Desa'],
  ],
  pembiayaan: [
    ['penerimaan', 'Penerimaan Pembiayaan'], ['pengeluaran', 'Pengeluaran Pembiayaan'],
  ],
};

// Menjaga form APBDes dari respons pemuatan lama yang selesai setelah admin
// mulai mengetik atau setelah proses simpan dimulai.
let _apbdesLoadGeneration = 0;
let _apbdesFormDirty = false;
let _apbdesSaving = false;

function markApbdesFormDirty() {
  if (_apbdesSaving) return;
  _apbdesFormDirty = true;
  _apbdesLoadGeneration += 1;
}

function setApbdesFormBusy(isBusy) {
  _apbdesSaving = Boolean(isBusy);
  document.querySelectorAll('#apb-tahun, .apb-input-row input').forEach(input => {
    input.disabled = Boolean(isBusy);
  });
  const button = document.getElementById('btn-simpan-apb');
  if (button) button.disabled = Boolean(isBusy);
}

const lraNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const lraTotal = (data, section, column) => LRA_SECTIONS[section]
  .reduce((sum, [key]) => sum + lraNumber(data[section]?.[key]?.[column]), 0);

function parseStoredLraData(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

function defaultLraData(record = {}) {
  const lra = parseStoredLraData(record.lra_data);
  const legacyIncome = {
    pad: record.pendapatan_pades, dana_desa: record.pendapatan_dd, bagi_hasil: record.pendapatan_pajak,
    add: record.pendapatan_add, bantuan_provinsi: 0, bantuan_kabupaten: 0, lain_lain: 0,
  };
  const legacyExpense = {
    penyelenggaraan: record.nominal_pemerintahan, pelaksanaan: record.nominal_pembangunan,
    pembinaan: record.nominal_pembinaan, pemberdayaan: record.nominal_pemberdayaan, penanggulangan_bencana: 0,
  };
  const legacyRealization = {
    pendapatan: record.realisasi_pendapatan, belanja: record.realisasi_belanja,
    pelaksanaan: record.realisasi_pembangunan, pemberdayaan: record.realisasi_pemberdayaan,
  };
  legacyRealization.penyelenggaraan = Math.max(0, lraNumber(legacyRealization.belanja) - lraNumber(legacyRealization.pelaksanaan) - lraNumber(legacyRealization.pemberdayaan));
  return Object.fromEntries(Object.entries(LRA_SECTIONS).map(([section, rows]) => [section,
    Object.fromEntries(rows.map(([key]) => [key, {
      anggaran: lraNumber(lra[section]?.[key]?.anggaran ?? (section === 'pendapatan' ? legacyIncome[key] : legacyExpense[key])),
      realisasi: lraNumber(lra[section]?.[key]?.realisasi ?? (section === 'pendapatan' && key === 'pad' ? legacyRealization.pendapatan : section === 'belanja' ? legacyRealization[key] : 0)),
    }]))
  ]));
}

function sameLraData(left, right) {
  return Object.entries(LRA_SECTIONS).every(([section, rows]) => rows.every(([key]) =>
    lraNumber(left?.[section]?.[key]?.anggaran) === lraNumber(right?.[section]?.[key]?.anggaran)
    && lraNumber(left?.[section]?.[key]?.realisasi) === lraNumber(right?.[section]?.[key]?.realisasi)
  ));
}

function renderLraInputs(data = defaultLraData(), options = {}) {
  Object.entries(LRA_SECTIONS).forEach(([section, rows]) => {
    const el = document.getElementById(`apb-${section}-inputs`);
    if (!el) return;
    el.innerHTML = rows.map(([key, label]) => `<div class="apb-input-row">
      <label for="apb-${section}-${key}-anggaran">${escHtml(label)}</label>
      <input type="number" min="0" step="1" id="apb-${section}-${key}-anggaran" value="${data[section][key].anggaran}" oninput="markApbdesFormDirty();updateLraCalculations()" aria-label="Anggaran ${escHtml(label)}" />
      <input type="number" min="0" step="1" id="apb-${section}-${key}-realisasi" value="${data[section][key].realisasi}" oninput="markApbdesFormDirty();updateLraCalculations()" aria-label="Realisasi ${escHtml(label)}" />
    </div>`).join('');
  });
  if (options.markClean !== false) _apbdesFormDirty = false;
  updateLraCalculations();
}

function readLraInputs() {
  return Object.fromEntries(Object.entries(LRA_SECTIONS).map(([section, rows]) => [section,
    Object.fromEntries(rows.map(([key, label]) => {
      const anggaran = Number(document.getElementById(`apb-${section}-${key}-anggaran`).value);
      const realisasi = Number(document.getElementById(`apb-${section}-${key}-realisasi`).value);
      if (!Number.isFinite(anggaran) || !Number.isFinite(realisasi) || anggaran < 0 || realisasi < 0) {
        throw new Error(`Nilai ${label} harus berupa angka nol atau lebih.`);
      }
      return [key, { anggaran, realisasi }];
    }))
  ]));
}

function updateLraCalculations() {
  try {
    const data = readLraInputs();
    const incomeBudget = lraTotal(data, 'pendapatan', 'anggaran');
    const incomeActual = lraTotal(data, 'pendapatan', 'realisasi');
    const transferBudget = ['dana_desa', 'bagi_hasil', 'add', 'bantuan_provinsi', 'bantuan_kabupaten']
      .reduce((sum, key) => sum + data.pendapatan[key].anggaran, 0);
    const transferActual = ['dana_desa', 'bagi_hasil', 'add', 'bantuan_provinsi', 'bantuan_kabupaten']
      .reduce((sum, key) => sum + data.pendapatan[key].realisasi, 0);
    const expenseBudget = lraTotal(data, 'belanja', 'anggaran');
    const expenseActual = lraTotal(data, 'belanja', 'realisasi');
    const financingBudget = data.pembiayaan.penerimaan.anggaran - data.pembiayaan.pengeluaran.anggaran;
    const financingActual = data.pembiayaan.penerimaan.realisasi - data.pembiayaan.pengeluaran.realisasi;
    document.getElementById('apb-total').value = incomeBudget;
    document.getElementById('apb-calculation').innerHTML =
      `<strong>Ringkasan otomatis</strong><br>Pendapatan Transfer: anggaran ${fmtRpShort(transferBudget)} | realisasi ${fmtRpShort(transferActual)}.<br>Anggaran: Pendapatan ${fmtRpShort(incomeBudget)} - Belanja ${fmtRpShort(expenseBudget)} = ${fmtRpShort(incomeBudget - expenseBudget)} (Surplus/(Defisit)).<br>Realisasi: Pendapatan ${fmtRpShort(incomeActual)} - Belanja ${fmtRpShort(expenseActual)} + Pembiayaan Netto ${fmtRpShort(financingActual)} = <strong>${fmtRpShort(incomeActual - expenseActual + financingActual)}</strong> (SiLPA).`;
  } catch (_) {
    document.getElementById('apb-total').value = '';
    document.getElementById('apb-calculation').textContent = 'Lengkapi seluruh nominal dengan angka nol atau lebih untuk melihat ringkasan otomatis.';
  }
}

async function loadApbdes(options = {}) {
  const force = options.force === true;
  if (!force && (_apbdesSaving || _apbdesFormDirty)) return;
  const loadGeneration = ++_apbdesLoadGeneration;
  try {
    // Urutan kedua membuat hasil stabil apabila database lama sempat memiliki
    // lebih dari satu baris pada tahun yang sama.
    const { data, error } = await sb.from('apbdes').select('*')
      .order('tahun',{ascending:false})
      .order('id',{ascending:true})
      .limit(1);
    if (error) throw error;
    if (loadGeneration !== _apbdesLoadGeneration || _apbdesSaving || (!force && _apbdesFormDirty)) return;
    const record = data?.[0] || {};
    document.getElementById('apb-id').value = record.id || '';
    document.getElementById('apb-tahun').value = record.tahun || new Date().getFullYear();
    renderLraInputs(defaultLraData(record));
  } catch (error) {
    if (loadGeneration !== _apbdesLoadGeneration) return;
    console.error('Gagal memuat APBDes:', error);
    showToast('Data APBDes belum dapat dimuat.', true);
    renderLraInputs();
  }
}

function apbdesSaveErrorMessage(error) {
  const detail = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
  if (detail.includes('integer') && (detail.includes('pct') || detail.includes('persentase') || detail.includes('81.97'))) {
    return 'Kolom persentase realisasi APBDes di database masih bertipe bilangan bulat. Jalankan supabase-perbaikan-apbdes-persentase-v2.sql secara penuh di Supabase SQL Editor, lalu hard refresh panel admin.';
  }
  if (detail.includes('lra_data') || detail.includes('schema cache')) {
    return 'Struktur data APBDes belum siap. Jalankan supabase-transparansi-fix.sql di Supabase SQL Editor, lalu muat ulang panel admin.';
  }
  if (detail.includes('row-level security') || detail.includes('permission denied') || error?.code === '42501') {
    return 'Akun ini tidak memiliki izin menyimpan APBDes. Masuk kembali memakai akun admin yang terdaftar.';
  }
  if (detail.includes('duplicate') || error?.code === '23505') {
    return 'Data untuk tahun tersebut sudah ada. Muat ulang data APBDes, lalu simpan kembali sebagai pembaruan.';
  }
  if (detail.includes('constraint') || String(error?.code || '').startsWith('23')) {
    return 'Data APBDes ditolak karena ada nilai yang tidak sesuai. Pastikan semua nominal nol atau lebih dan total alokasi valid.';
  }
  return `Data APBDes gagal disimpan${error?.message ? `: ${error.message}` : '.'}`;
}

async function simpanApbdes() {
  const id = document.getElementById('apb-id').value;
  const tahun = readFiniteNumber('apb-tahun');
  if (!Number.isInteger(tahun) || tahun < 2000 || tahun > 2100) {
    showToast('Tahun APBDes harus berupa empat digit tahun yang valid.', true); return;
  }

  let lraData;
  try { lraData = readLraInputs(); }
  catch (error) { showToast(error.message, true); return; }

  const pendapatanAnggaran = lraTotal(lraData, 'pendapatan', 'anggaran');
  const pendapatanRealisasi = lraTotal(lraData, 'pendapatan', 'realisasi');
  const belanjaAnggaran = lraTotal(lraData, 'belanja', 'anggaran');
  const belanjaRealisasi = lraTotal(lraData, 'belanja', 'realisasi');
  if (pendapatanAnggaran <= 0) { showToast('Total anggaran pendapatan harus lebih besar dari nol.', true); return; }

  // Kolom lama tetap diisi agar data lama dan constraint database tetap kompatibel.
  const legacyExpense = ['penyelenggaraan', 'pelaksanaan', 'pembinaan', 'pemberdayaan'];
  const legacyExpenseBudget = legacyExpense.reduce((sum, key) => sum + lraData.belanja[key].anggaran, 0);
  // Semua persentase disimpan dengan presisi dua digit agar konsisten dengan
  // kolom numeric(8,2) di Supabase dan tidak pernah dikirim sebagai pecahan panjang.
  const roundPercent = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  const legacyPct = legacyExpenseBudget > 0
    ? legacyExpense.map(key => roundPercent((lraData.belanja[key].anggaran / legacyExpenseBudget) * 100))
    : [25, 25, 25, 25];
  legacyPct[3] = roundPercent(100 - legacyPct[0] - legacyPct[1] - legacyPct[2]);

  const btn = document.getElementById('btn-simpan-apb');
  // Batalkan seluruh respons load lama dan kunci input selama payload sedang
  // disimpan. Dengan demikian nilai pada layar selalu sama dengan snapshot
  // yang benar-benar dikirim ke database.
  _apbdesLoadGeneration += 1;
  setApbdesFormBusy(true);
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';
  const payload = {
    tahun, total_anggaran: pendapatanAnggaran, lra_data: lraData,
    pct_pemerintahan: legacyPct[0], pct_pembangunan: legacyPct[1], pct_pembinaan: legacyPct[2], pct_pemberdayaan: legacyPct[3],
    nominal_pemerintahan: lraData.belanja.penyelenggaraan.anggaran,
    nominal_pembangunan: lraData.belanja.pelaksanaan.anggaran,
    nominal_pembinaan: lraData.belanja.pembinaan.anggaran,
    nominal_pemberdayaan: lraData.belanja.pemberdayaan.anggaran,
    pendapatan_dd: lraData.pendapatan.dana_desa.anggaran,
    pendapatan_add: lraData.pendapatan.add.anggaran,
    pendapatan_pajak: lraData.pendapatan.bagi_hasil.anggaran,
    pendapatan_pades: lraData.pendapatan.pad.anggaran + lraData.pendapatan.bantuan_provinsi.anggaran + lraData.pendapatan.bantuan_kabupaten.anggaran + lraData.pendapatan.lain_lain.anggaran,
    realisasi_pendapatan: pendapatanRealisasi, realisasi_belanja: belanjaRealisasi,
    realisasi_pembangunan: lraData.belanja.pelaksanaan.realisasi, realisasi_pemberdayaan: lraData.belanja.pemberdayaan.realisasi,
    realisasi_pct_pendapatan: pendapatanAnggaran ? roundPercent(pendapatanRealisasi / pendapatanAnggaran * 100) : 0,
    realisasi_pct_belanja: belanjaAnggaran ? roundPercent(belanjaRealisasi / belanjaAnggaran * 100) : 0,
    realisasi_pct_pembangunan: lraData.belanja.pelaksanaan.anggaran ? roundPercent(lraData.belanja.pelaksanaan.realisasi / lraData.belanja.pelaksanaan.anggaran * 100) : 0,
    realisasi_pct_pemberdayaan: lraData.belanja.pemberdayaan.anggaran ? roundPercent(lraData.belanja.pemberdayaan.realisasi / lraData.belanja.pemberdayaan.anggaran * 100) : 0,
    aktif: true,
  };

  try {
    const { data: existingRows, error: lookupError } = await sb.from('apbdes')
      .select('id')
      .eq('tahun', tahun);
    if (lookupError) throw lookupError;

    // Instalasi lama dapat memiliki duplikat tahun. Memperbarui berdasarkan
    // tahun menyamakan seluruh salinan sekaligus sehingga nilai Belanja dan
    // Pembiayaan tidak bergantian ketika form dimuat ulang.
    const query = existingRows?.length
      ? sb.from('apbdes').update(payload).eq('tahun', tahun)
      : sb.from('apbdes').insert(payload);
    const { data: savedRows, error } = await query.select('*');
    if (error) throw error;
    const savedList = Array.isArray(savedRows) ? savedRows : (savedRows ? [savedRows] : []);
    if (!savedList.length || !savedList.every(row => row?.id)) {
      throw new Error('Penyimpanan selesai tanpa baris hasil. Periksa kebijakan akses tabel APBDes.');
    }
    if (!savedList.every(row => sameLraData(defaultLraData(row), lraData))) {
      throw new Error('Verifikasi APBDes gagal: data Belanja atau Pembiayaan yang tersimpan berbeda dari input.');
    }

    const saved = savedList.find(row => String(row.id) === String(id)) || savedList[0];
    document.getElementById('apb-id').value = saved.id;
    document.getElementById('apb-tahun').value = saved.tahun || tahun;
    // Jangan bangun ulang elemen input setelah simpan. Nilai yang sedang
    // terlihat adalah snapshot yang sudah diverifikasi dan harus tetap utuh.
    if (!sameLraData(readLraInputs(), lraData)) {
      throw new Error('Form APBDes berubah saat proses simpan. Muat ulang panel lalu coba kembali.');
    }
    _apbdesFormDirty = false;
    showToast('Data LRA APBDes berhasil disimpan');
    showLastSaved('APBDes disimpan ' + new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}));
    await loadDashboard();
  } catch (error) {
    console.error('Gagal menyimpan APBDes:', error);
    showToast(apbdesSaveErrorMessage(error), true);
  } finally {
    setApbdesFormBusy(false);
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Simpan Data APBDes';
  }
}

// ════════════════════════════════════════════
// ARSIP PDF KEUANGAN DESA
// ════════════════════════════════════════════
const _financeDocumentMap = {};

function financeRecordYear(record) {
  const storedYear = Number(record?.tahun);
  if (FINANCE_DOCUMENT_YEARS.includes(storedYear)) return storedYear;
  const titleYear = String(record?.judul || '').match(/\b(2024|2025|2026)\b/);
  return titleYear ? Number(titleYear[1]) : 2026;
}

async function loadFinanceDocuments() {
  const list = document.getElementById('finance-document-list');
  if (!list) return;
  const { data, error } = await sb.from('dokumen').select('*').order('urutan');
  if (error) {
    list.innerHTML = `<div class="empty" style="flex-direction:column;gap:7px;">
      <i class="fa-solid fa-triangle-exclamation" style="color:var(--gold);"></i>
      <div>Arsip keuangan belum dapat dimuat.</div>
      <div style="font-size:10.5px;color:var(--text-muted);">Jalankan migrasi SQL terbaru, lalu muat ulang halaman.</div>
    </div>`;
    return;
  }

  Object.keys(_financeDocumentMap).forEach(id => delete _financeDocumentMap[id]);
  const records = (data || [])
    .filter(record => Object.hasOwn(FINANCE_DOCUMENT_TYPES, record.kategori))
    .sort((a, b) => financeRecordYear(b) - financeRecordYear(a)
      || Object.keys(FINANCE_DOCUMENT_TYPES).indexOf(a.kategori) - Object.keys(FINANCE_DOCUMENT_TYPES).indexOf(b.kategori));
  records.forEach(record => { _financeDocumentMap[record.id] = record; });

  const count = document.getElementById('finance-admin-count');
  if (count) count.textContent = `${records.length} dokumen`;
  if (!records.length) {
    list.innerHTML = '<div class="empty"><i class="fa-solid fa-file-circle-plus"></i>Belum ada PDF keuangan yang dipublikasikan.</div>';
    return;
  }

  list.innerHTML = `<div class="finance-admin-table-wrap"><table class="finance-admin-table">
    <thead><tr><th>Tahun</th><th>Dokumen</th><th>Softfile</th><th style="text-align:right;">Aksi</th></tr></thead>
    <tbody>${records.map(record => {
      const type = FINANCE_DOCUMENT_TYPES[record.kategori];
      const fileUrl = safeAdminUrl(record.file_url);
      return `<tr>
        <td><span class="finance-admin-year">${financeRecordYear(record)}</span></td>
        <td><div class="finance-admin-document"><i class="fa-solid ${type.icon}"></i><div><strong>${escHtml(type.label)}</strong><span>${escHtml(record.keterangan || record.judul || '')}</span></div></div></td>
        <td>${fileUrl ? `<a class="finance-admin-file-link" href="${fileUrl}" target="_blank" rel="noopener noreferrer"><i class="fa-regular fa-eye"></i> Lihat PDF</a>` : '<span style="color:var(--danger);font-size:10px;">File tidak tersedia</span>'}</td>
        <td><div class="finance-admin-actions">
          <button type="button" class="icon-btn" onclick="editFinanceDocument('${escHtml(record.id)}')" title="Edit arsip"><i class="fa-solid fa-pen-to-square"></i></button>
          <button type="button" class="icon-btn danger" onclick="confirmDeleteFinanceDocument('${escHtml(record.id)}')" title="Hapus arsip"><i class="fa-solid fa-trash-can"></i></button>
        </div></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

async function saveFinanceDocument() {
  const id = document.getElementById('fin-id').value;
  const category = document.getElementById('fin-kategori').value;
  const year = Number(document.getElementById('fin-tahun').value);
  const description = document.getElementById('fin-keterangan').value.trim();
  const file = document.getElementById('fin-file').files[0];
  const type = FINANCE_DOCUMENT_TYPES[category];
  if (!type) { showToast('Jenis dokumen tidak valid.', true); return; }
  if (!FINANCE_DOCUMENT_YEARS.includes(year)) { showToast('Tahun dokumen harus 2024, 2025, atau 2026.', true); return; }
  if (description.length > 240) { showToast('Keterangan maksimal 240 karakter.', true); return; }

  const duplicate = Object.values(_financeDocumentMap).find(record =>
    record.id !== id && record.kategori === category && financeRecordYear(record) === year
  );
  if (duplicate) {
    showToast(`${type.label} tahun ${year} sudah tersedia. Edit dokumen tersebut untuk mengganti file.`, true);
    return;
  }

  let fileUrl = _financeDocumentMap[id]?.file_url || '';
  if (!file && !fileUrl) { showToast('Pilih softfile PDF terlebih dahulu.', true); return; }

  const button = document.getElementById('btn-simpan-finance');
  button.disabled = true;
  button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengunggah...';
  let uploadedPath = '';
  try {
    if (file) {
      const uploaded = await uploadValidatedFile(file, {
        kind: 'pdf', folder: 'dokumen/keuangan', maxBytes: 10 * 1024 * 1024,
      });
      uploadedPath = uploaded.storagePath;
      fileUrl = uploaded.publicUrl;
    }

    const typeOrder = Object.keys(FINANCE_DOCUMENT_TYPES).indexOf(category) + 1;
    const payload = {
      judul: `${type.label} Tahun ${year}`,
      kategori: category,
      tahun: year,
      tipe: 'pdf',
      keterangan: description,
      file_url: fileUrl,
      aktif: true,
      urutan: (2026 - year) * 10 + typeOrder,
      updated_at: new Date().toISOString(),
    };
    const { error } = id
      ? await sb.from('dokumen').update(payload).eq('id', id)
      : await sb.from('dokumen').insert(payload);
    if (error) throw error;

    const oldPath = storagePathFromPublicUrl(_financeDocumentMap[id]?.file_url || '');
    if (uploadedPath && oldPath && oldPath !== uploadedPath) await rollbackUploadedFile(oldPath);
    showToast(`${type.label} ${year} berhasil dipublikasikan`);
    resetFinanceDocumentForm();
    await loadFinanceDocuments();
  } catch (error) {
    if (uploadedPath) await rollbackUploadedFile(uploadedPath);
    console.error('Gagal menyimpan arsip keuangan:', error);
    showToast(error instanceof UploadValidationError
      ? error.message
      : 'Arsip gagal disimpan. Pastikan migrasi SQL terbaru sudah dijalankan.', true);
  } finally {
    button.disabled = false;
    button.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Publikasikan PDF';
  }
}

function editFinanceDocument(id) {
  const record = _financeDocumentMap[id];
  if (!record) return;
  document.getElementById('fin-id').value = record.id;
  document.getElementById('fin-kategori').value = record.kategori;
  document.getElementById('fin-tahun').value = String(financeRecordYear(record));
  document.getElementById('fin-keterangan').value = record.keterangan || '';
  document.getElementById('fin-file').value = '';
  const current = document.getElementById('fin-file-current');
  document.getElementById('fin-file-name').textContent = record.judul || 'PDF tersimpan';
  current.classList.toggle('show', Boolean(record.file_url));
  document.getElementById('btn-simpan-finance').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan perubahan';
  document.getElementById('finance-document-form').scrollIntoView({ behavior:'smooth', block:'center' });
}

function confirmDeleteFinanceDocument(id) {
  const record = _financeDocumentMap[id];
  const label = FINANCE_DOCUMENT_TYPES[record?.kategori]?.label || 'Dokumen';
  openConfirm('Hapus arsip keuangan?', `${label} tahun ${financeRecordYear(record)} akan dihapus permanen.`,
    'Hapus', () => deleteFinanceDocument(id));
}

async function deleteFinanceDocument(id) {
  const storagePath = storagePathFromPublicUrl(_financeDocumentMap[id]?.file_url || '');
  const result = await hapusBaris('dokumen', id);
  if (!result.ok) { showToast(result.pesan, true); return; }
  if (storagePath) await rollbackUploadedFile(storagePath);
  showToast('Arsip keuangan dihapus');
  resetFinanceDocumentForm();
  await loadFinanceDocuments();
}

function resetFinanceDocumentForm() {
  ['fin-id', 'fin-keterangan', 'fin-file'].forEach(id => {
    const element = document.getElementById(id);
    if (element) element.value = '';
  });
  document.getElementById('fin-kategori').value = 'apbdes';
  document.getElementById('fin-tahun').value = '2026';
  document.getElementById('fin-file-current').classList.remove('show');
  document.getElementById('btn-simpan-finance').innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Publikasikan PDF';
}

// ════════════════════════════════════════════
// POTENSI — dengan drag-and-drop reorder
// ════════════════════════════════════════════
const _potensiMap = {};
let _potensiOrder = []; // Array of ids in display order

async function loadPotensi() {
  const { data } = await sb.from('potensi').select('*').order('urutan');
  const el = document.getElementById('potensi-list');
  if (!data?.length) {
    el.innerHTML = '<div class="empty"><i class="fa-solid fa-seedling"></i>Belum ada data potensi.</div>'; return;
  }
  data.forEach(p => { _potensiMap[p.id] = p; });
  _potensiOrder = data.map(p => p.id);
  renderPotensiList(data);
}

function renderPotensiList(data) {
  const el = document.getElementById('potensi-list');
  el.innerHTML = data.map(p => `
    <div class="potensi-drag-item" data-id="${escHtml(p.id)}"
         draggable="true"
         ondragstart="onDragStart(event)" ondragover="onDragOver(event)"
         ondrop="onDrop(event)" ondragend="onDragEnd(event)">
      <span class="drag-handle"><i class="fa-solid fa-grip-vertical"></i></span>
      <span style="font-size:22px;">${escHtml(p.emoji)}</span>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:500;">${escHtml(p.nama)}</div>
        <div style="font-size:11px;color:var(--text-muted);">${escHtml(p.kategori)}</div>
      </div>
      <button class="icon-btn" onclick="editPotensi('${escHtml(p.id)}')" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
      <button class="icon-btn danger" onclick="konfirmasiHapusPotensi('${escHtml(p.id)}')" title="Hapus"><i class="fa-solid fa-trash-can"></i></button>
    </div>`).join('');
}

// Drag-and-drop state
let _dragSrcId = null;

function onDragStart(e) {
  _dragSrcId = e.currentTarget.dataset.id;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}
function onDragOver(e) {
  e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.potensi-drag-item').forEach(el => el.classList.remove('drag-over'));
  e.currentTarget.classList.add('drag-over');
}
function onDrop(e) {
  e.preventDefault();
  const targetId = e.currentTarget.dataset.id;
  if (!_dragSrcId || _dragSrcId === targetId) return;
  const srcIdx = _potensiOrder.indexOf(_dragSrcId);
  const tgtIdx = _potensiOrder.indexOf(targetId);
  _potensiOrder.splice(srcIdx, 1);
  _potensiOrder.splice(tgtIdx, 0, _dragSrcId);
  // Re-render in new order and save
  const ordered = _potensiOrder.map(id => _potensiMap[id]).filter(Boolean);
  renderPotensiList(ordered);
  savePotensiOrder();
}
function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.potensi-drag-item').forEach(el => el.classList.remove('drag-over'));
}

async function savePotensiOrder() {
  try {
    const updates = _potensiOrder.map((id, i) =>
      sb.from('potensi').update({ urutan: i+1, updated_at: new Date().toISOString() }).eq('id', id)
    );
    const results = await Promise.all(updates);
    const failed = results.filter(result => result.error);
    if (failed.length) throw failed[0].error;
    showToast('Urutan potensi disimpan');
  } catch (error) {
    console.error('Gagal menyimpan urutan potensi:', error);
    showToast('Urutan potensi gagal disimpan.', true);
    await loadPotensi();
  }
}

async function simpanPotensi() {
  const id    = document.getElementById('pot-id').value;
  const nama  = document.getElementById('pot-nama').value.trim();
  const kat   = document.getElementById('pot-kategori').value;
  const des   = document.getElementById('pot-deskripsi').value.trim();
  const emoji = document.getElementById('pot-emoji').value.trim() || '🌾';
  if (!nama || !des) { showToast('Nama dan deskripsi wajib diisi', true); return; }
  if (nama.length > 150) { showToast('Nama potensi maksimal 150 karakter', true); return; }
  if (des.length > 2000) { showToast('Deskripsi potensi maksimal 2.000 karakter', true); return; }

  const btn = document.getElementById('btn-simpan-potensi');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';
  let foto_url = _potensiMap[id]?.foto_url || null;
  const fotoFile = document.getElementById('pot-foto').files[0];
  let uploadedPath = '';
  try {
    if (fotoFile) {
      const uploaded = await uploadValidatedFile(fotoFile, {
        kind: 'image', folder: 'potensi', maxBytes: 3 * 1024 * 1024,
      });
      uploadedPath = uploaded.storagePath;
      foto_url = uploaded.publicUrl;
    }

    const payload = { nama, kategori:kat, deskripsi:des, emoji, foto_url, updated_at: new Date().toISOString() };
    const { error } = id
      ? await sb.from('potensi').update(payload).eq('id',id)
      : await sb.from('potensi').insert({ ...payload, aktif:true });
    if (error) throw error;

    const oldPath = storagePathFromPublicUrl(_potensiMap[id]?.foto_url || '');
    if (uploadedPath && oldPath && oldPath !== uploadedPath) await rollbackUploadedFile(oldPath);
    showToast('Potensi desa disimpan');
    resetPotensiForm();
    await Promise.all([loadPotensi(), loadDashboard()]);
  } catch (error) {
    if (uploadedPath) await rollbackUploadedFile(uploadedPath);
    console.error('Gagal menyimpan potensi:', error);
    showToast(error instanceof UploadValidationError ? error.message : 'Data potensi gagal disimpan.', true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan';
  }
}

function editPotensi(id) {
  const p = _potensiMap[id];
  if (!p) { showToast('Data tidak ditemukan', true); return; }
  document.getElementById('pot-id').value        = p.id;
  document.getElementById('pot-nama').value      = p.nama;
  document.getElementById('pot-kategori').value  = p.kategori;
  document.getElementById('pot-deskripsi').value = p.deskripsi || '';
  document.getElementById('pot-emoji').value     = p.emoji || '🌾';
  const wrap = document.getElementById('pot-foto-preview-wrap');
  const img  = document.getElementById('pot-foto-preview');
  if (p.foto_url && isValidHttpUrl(p.foto_url)) { img.src = p.foto_url; wrap.classList.add('show'); }
  else wrap.classList.remove('show');
  document.getElementById('potensi-form-title').textContent = 'Edit potensi desa';
  document.getElementById('panel-potensi').scrollIntoView({ behavior:'smooth' });
}

function konfirmasiHapusPotensi(id) {
  const p = _potensiMap[id];
  openConfirm('Hapus potensi ini?',
    `"${p?.nama || id}" akan dihapus permanen.`,
    'Hapus', () => hapusPotensi(id)
  );
}

async function hapusPotensi(id) {
  const storagePath = storagePathFromPublicUrl(_potensiMap[id]?.foto_url || '');
  const hasil = await hapusBaris('potensi', id);
  if (!hasil.ok) { showToast(hasil.pesan, true); return; }
  if (storagePath) await rollbackUploadedFile(storagePath);
  showToast('Data dihapus'); loadPotensi(); loadDashboard();
}

function resetPotensiForm() {
  document.getElementById('pot-id').value        = '';
  document.getElementById('pot-nama').value      = '';
  document.getElementById('pot-deskripsi').value = '';
  document.getElementById('pot-emoji').value     = '🌾';
  const potFoto = document.getElementById('pot-foto');
  if (potFoto) potFoto.value = '';
  const potWrap = document.getElementById('pot-foto-preview-wrap');
  if (potWrap) potWrap.classList.remove('show');
  document.getElementById('potensi-form-title').textContent = 'Tambah / edit potensi desa';
}

// ═══════════════════════════════════════════════
// UMKM
// ═══════════════════════════════════════════════
const _umkmMap = {};
let _umkmExistingPhotoUrls = [];
let _umkmRemovedPhotoUrls = [];
let _umkmNewPhotoFiles = [];
let _umkmPreviewObjectUrls = [];

function getAdminUmkmPhotos(umkm) {
  let gallery = umkm?.foto_urls;
  if (typeof gallery === 'string') {
    try { gallery = JSON.parse(gallery); } catch { gallery = []; }
  }
  return [...new Set([
    ...(Array.isArray(gallery) ? gallery : []),
    umkm?.foto_url,
  ].map(value => String(value || '').trim()).filter(value => value && isValidHttpUrl(value)))];
}

function isGoogleMapsUrl(value) {
  if (!isValidHttpUrl(value)) return false;
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === 'maps.app.goo.gl' || host === 'goo.gl' ||
      host === 'maps.google.com' || host.endsWith('.google.com') ||
      host.endsWith('.google.co.id');
  } catch { return false; }
}

function clearUmkmPreviewObjectUrls() {
  _umkmPreviewObjectUrls.forEach(url => URL.revokeObjectURL(url));
  _umkmPreviewObjectUrls = [];
}

function renderUmkmPhotoPreviews() {
  const grid = document.getElementById('umkm-foto-preview-grid');
  if (!grid) return;
  clearUmkmPreviewObjectUrls();
  const existing = _umkmExistingPhotoUrls.map((url, index) => ({
    src: safeAdminUrl(url), type:'existing', index,
  }));
  const additions = _umkmNewPhotoFiles.map((file, index) => {
    const src = URL.createObjectURL(file);
    _umkmPreviewObjectUrls.push(src);
    return { src: escHtml(src), type:'new', index };
  });
  const photos = [...existing, ...additions];
  grid.innerHTML = photos.map((photo, position) => `
    <div class="umkm-photo-preview-item">
      <img src="${photo.src}" alt="Preview foto UMKM ${position + 1}" />
      <span class="photo-order">${position + 1}</span>
      <button type="button" class="photo-remove"
        onclick="removeUmkmPreviewPhoto('${photo.type}',${photo.index})"
        aria-label="Hapus foto ${position + 1}" title="Hapus foto">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>`).join('');
}

function removeUmkmPreviewPhoto(type, index) {
  if (type === 'existing') {
    const removed = _umkmExistingPhotoUrls.splice(index, 1)[0];
    if (removed) _umkmRemovedPhotoUrls.push(removed);
  } else {
    _umkmNewPhotoFiles.splice(index, 1);
    const input = document.getElementById('umkm-foto');
    if (input) input.value = '';
  }
  renderUmkmPhotoPreviews();
}

async function loadUmkm() {
  const { data, error } = await sb.from('umkm').select('*').order('created_at', { ascending:false });
  const el = document.getElementById('umkm-list');
  if (error) {
    // Tabel mungkin belum dibuat
    el.innerHTML = `<div class="empty" style="flex-direction:column;gap:8px;">
      <i class="fa-solid fa-triangle-exclamation" style="color:var(--gold);"></i>
      <div>Tabel <strong>umkm</strong> belum ada di database.</div>
      <div style="font-size:11px;color:var(--text-muted);">Jalankan file SQL umkm terlebih dahulu di Supabase.</div>
    </div>`;
    return;
  }
  if (!data?.length) {
    el.innerHTML = '<div class="empty"><i class="fa-solid fa-store"></i>Belum ada UMKM terdaftar.</div>'; return;
  }
  data.forEach(u => { _umkmMap[u.id] = u; });
  el.innerHTML = `<table><thead><tr>
    <th>Produk</th><th>Nama Usaha</th><th>Kategori</th><th>WhatsApp</th><th>Aksi</th>
  </tr></thead><tbody>
    ${data.map(u => {
      const photoUrls = getAdminUmkmPhotos(u);
      const thumb = photoUrls.length
        ? `<div style="display:flex;align-items:center;gap:7px;"><img src="${safeAdminUrl(photoUrls[0])}" alt="${escHtml(u.nama || 'UMKM')}" style="width:36px;height:46px;border-radius:8px;object-fit:cover;" onerror="this.style.display='none'" /><span style="font-size:10px;color:var(--text-muted);">${photoUrls.length} foto</span></div>`
        : `<span style="font-size:22px;">${escHtml(u.emoji||'🛒')}</span>`;
      return `<tr>
        <td>${thumb}</td>
        <td style="font-weight:500;">${escHtml(u.nama)}</td>
        <td><span class="badge badge-teal">${escHtml(u.kategori)}</span></td>
        <td style="font-size:12px;">${u.whatsapp ? escHtml(u.whatsapp) : '<span style="color:var(--text-muted)">—</span>'}</td>
        <td style="white-space:nowrap;">
          <button class="icon-btn" onclick="editUmkm('${escHtml(u.id)}')" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
          <button class="icon-btn danger" onclick="konfirmasiHapusUmkm('${escHtml(u.id)}')" title="Hapus"><i class="fa-solid fa-trash-can"></i></button>
        </td>
      </tr>`;
    }).join('')}
  </tbody></table>`;
}

// Preview galeri foto UMKM saat dipilih
document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('umkm-foto');
  if (fileInput) {
    fileInput.addEventListener('change', e => {
      const files = [...e.target.files];
      if (_umkmExistingPhotoUrls.length + files.length > 6) {
        showToast('Maksimal 6 foto untuk setiap UMKM.', true);
        e.target.value = '';
        return;
      }
      for (const file of files) {
        const validation = validateUploadFile(file, 'image', 3 * 1024 * 1024);
        if (!validation.ok) {
          showToast(`${file.name}: ${validation.message}`, true);
          e.target.value = '';
          return;
        }
      }
      _umkmNewPhotoFiles = files;
      renderUmkmPhotoPreviews();
    });
  }
});

async function simpanUmkm() {
  const id    = document.getElementById('umkm-id').value;
  const nama  = document.getElementById('umkm-nama').value.trim();
  const kat   = document.getElementById('umkm-kategori').value;
  const des   = document.getElementById('umkm-deskripsi').value.trim();
  const waRaw = document.getElementById('umkm-wa').value.trim();
  const wa    = waRaw.replace(/[^0-9]/g,'');
  const emoji = document.getElementById('umkm-emoji').value.trim() || '🛒';
  const pemilik = document.getElementById('umkm-pemilik').value.trim();
  const produk  = document.getElementById('umkm-produk').value.trim();
  const lokasi  = document.getElementById('umkm-lokasi').value.trim();
  const jam     = document.getElementById('umkm-jam').value.trim();
  const harga   = document.getElementById('umkm-harga').value.trim();
  const sosial  = document.getElementById('umkm-sosial').value.trim();
  if (!nama || !des) { showToast('Nama dan deskripsi wajib diisi', true); return; }
  if (nama.length > 150) { showToast('Nama UMKM maksimal 150 karakter', true); return; }
  if (des.length > 2000) { showToast('Deskripsi UMKM maksimal 2.000 karakter', true); return; }
  if (waRaw && (!/^[0-9+().\-\s]+$/.test(waRaw) || wa.length < 7 || wa.length > 16)) {
    showToast('Nomor WhatsApp tidak valid', true);
    return;
  }
  if (/^https?:\/\//i.test(lokasi) && !isGoogleMapsUrl(lokasi)) {
    showToast('Link lokasi harus berupa tautan Google Maps. Jika tidak memakai link, ketik alamat manual.', true);
    return;
  }
  if (sosial && !isValidHttpUrl(sosial)) {
    showToast('Link media sosial harus diawali http:// atau https://', true);
    return;
  }
  if (_umkmExistingPhotoUrls.length + _umkmNewPhotoFiles.length > 6) {
    showToast('Maksimal 6 foto untuk setiap UMKM.', true);
    return;
  }

  const btn = document.getElementById('btn-simpan-umkm');
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';

  const uploadedFiles = [];
  try {
    for (const fotoFile of _umkmNewPhotoFiles) {
      const uploaded = await uploadValidatedFile(fotoFile, {
        kind: 'image', folder: 'umkm', maxBytes: 3 * 1024 * 1024,
      });
      uploadedFiles.push(uploaded);
    }

    const fotoUrls = [..._umkmExistingPhotoUrls, ...uploadedFiles.map(file => file.publicUrl)];
    const payload = {
      nama, kategori:kat, deskripsi:des, whatsapp:wa, emoji,
      foto_url: fotoUrls[0] || null, foto_urls: fotoUrls,
      pemilik, produk, lokasi, jam_buka:jam, harga, media_sosial:sosial,
      updated_at: new Date().toISOString()
    };
    const { data: saved, error } = id
      ? await sb.from('umkm').update(payload).eq('id',id).select('id').maybeSingle()
      : await sb.from('umkm').insert({ ...payload, aktif:true }).select('id').single();
    if (error) throw error;
    if (!saved?.id) throw new Error('Data UMKM tidak tersimpan. Periksa izin database dan sesi admin.');

    for (const removedUrl of [...new Set(_umkmRemovedPhotoUrls)]) {
      const removedPath = storagePathFromPublicUrl(removedUrl);
      if (removedPath) await rollbackUploadedFile(removedPath);
    }
    showToast('UMKM disimpan');
    resetUmkmForm();
    await loadUmkm();
  } catch (error) {
    for (const uploaded of uploadedFiles) await rollbackUploadedFile(uploaded.storagePath);
    console.error('Gagal menyimpan UMKM:', error);
    const message = error instanceof UploadValidationError
      ? error.message
      : (error?.message || 'Data UMKM gagal disimpan.');
    showToast(message.includes('foto_urls') || message.includes('media_sosial') || message.includes('lokasi')
      ? 'Database UMKM belum diperbarui. Jalankan supabase-umkm-galeri.sql terlebih dahulu.'
      : message, true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan';
  }
}

function editUmkm(id) {
  const u = _umkmMap[id];
  if (!u) { showToast('Data tidak ditemukan', true); return; }
  document.getElementById('umkm-id').value        = u.id;
  document.getElementById('umkm-nama').value      = u.nama;
  document.getElementById('umkm-kategori').value  = u.kategori;
  document.getElementById('umkm-deskripsi').value = u.deskripsi || '';
  document.getElementById('umkm-wa').value        = u.whatsapp || '';
  document.getElementById('umkm-emoji').value     = u.emoji || '🛒';
  document.getElementById('umkm-pemilik').value   = u.pemilik || '';
  document.getElementById('umkm-produk').value    = u.produk || '';
  document.getElementById('umkm-lokasi').value    = u.lokasi || u.alamat || '';
  document.getElementById('umkm-jam').value       = u.jam_buka || '';
  document.getElementById('umkm-harga').value     = u.harga || '';
  document.getElementById('umkm-sosial').value    = u.media_sosial || (u.instagram ? `https://instagram.com/${String(u.instagram).replace(/^@/,'')}` : '');
  _umkmExistingPhotoUrls = getAdminUmkmPhotos(u);
  _umkmRemovedPhotoUrls = [];
  _umkmNewPhotoFiles = [];
  document.getElementById('umkm-foto').value = '';
  renderUmkmPhotoPreviews();
  document.getElementById('umkm-form-title').textContent = 'Edit UMKM';
  document.getElementById('panel-umkm').scrollIntoView({ behavior:'smooth' });
}

function konfirmasiHapusUmkm(id) {
  const u = _umkmMap[id];
  openConfirm('Hapus UMKM ini?',
    `"${u?.nama || id}" akan dihapus permanen.`,
    'Hapus', () => hapusUmkm(id)
  );
}

async function hapusUmkm(id) {
  const storagePaths = getAdminUmkmPhotos(_umkmMap[id])
    .map(storagePathFromPublicUrl).filter(Boolean);
  const hasil = await hapusBaris('umkm', id);
  if (!hasil.ok) { showToast(hasil.pesan, true); return; }
  for (const storagePath of [...new Set(storagePaths)]) await rollbackUploadedFile(storagePath);
  showToast('UMKM dihapus'); loadUmkm();
}

function resetUmkmForm() {
  ['umkm-id','umkm-nama','umkm-deskripsi','umkm-wa','umkm-foto',
   'umkm-pemilik','umkm-produk','umkm-lokasi','umkm-jam','umkm-harga','umkm-sosial'
  ].forEach(i => { const el = document.getElementById(i); if (el) el.value = ''; });
  document.getElementById('umkm-emoji').value = '🛒';
  _umkmExistingPhotoUrls = [];
  _umkmRemovedPhotoUrls = [];
  _umkmNewPhotoFiles = [];
  renderUmkmPhotoPreviews();
  document.getElementById('umkm-form-title').textContent = 'Tambah / edit UMKM';
}

// ═══════════════════════════════════════════════
// PRESTASI
// ═══════════════════════════════════════════════
const _prestasiMap = {};

// Preview foto potensi & prestasi saat dipilih
document.addEventListener('DOMContentLoaded', () => {
  [['pot-foto','pot-foto-preview-wrap','pot-foto-preview'],
   ['prest-foto','prest-foto-preview-wrap','prest-foto-preview']].forEach(([inp,wrap,img]) => {
    const el = document.getElementById(inp);
    if (el) el.addEventListener('change', e => {
      const file = e.target.files[0];
      const w = document.getElementById(wrap), i = document.getElementById(img);
      if (file) { i.src = URL.createObjectURL(file); w.classList.add('show'); }
      else w.classList.remove('show');
    });
  });
});

async function loadPrestasi() {
  const { data, error } = await sb.from('prestasi').select('*').order('urutan');
  const el = document.getElementById('prestasi-list');
  if (error) {
    el.innerHTML = `<div class="empty" style="flex-direction:column;gap:8px;">
      <i class="fa-solid fa-triangle-exclamation" style="color:var(--gold);"></i>
      <div>Tabel <strong>prestasi</strong> belum ada di database.</div>
      <div style="font-size:11px;color:var(--text-muted);">Jalankan file SQL prestasi terlebih dahulu.</div>
    </div>`;
    return;
  }
  if (!data?.length) {
    el.innerHTML = '<div class="empty"><i class="fa-solid fa-trophy"></i>Belum ada prestasi.</div>'; return;
  }
  data.forEach(p => { _prestasiMap[p.id] = p; });
  const MEDAL = { emas:'🥇', perak:'🥈', perunggu:'🥉' };
  el.innerHTML = `<table><thead><tr>
    <th>Visual</th><th>Judul</th><th>Tahun/Instansi</th><th>Aksi</th>
  </tr></thead><tbody>
    ${data.map(p => {
      const vis = p.foto_url
        ? `<img src="${safeAdminUrl(p.foto_url)}" alt="${escHtml(p.judul || 'Prestasi')}" style="width:38px;height:38px;border-radius:8px;object-fit:cover;" onerror="this.outerHTML='<span style=font-size:20px>${MEDAL[p.medali]||'🏆'}</span>'" />`
        : `<span style="font-size:20px;">${escHtml(p.emoji || MEDAL[p.medali] || '🏆')}</span>`;
      return `<tr>
        <td>${vis}</td>
        <td style="font-weight:500;">${escHtml(p.judul)}</td>
        <td style="font-size:12px;color:var(--text-muted);">${escHtml(p.tahun_info || '—')}</td>
        <td style="white-space:nowrap;">
          <button class="icon-btn" onclick="editPrestasi('${escHtml(p.id)}')" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
          <button class="icon-btn danger" onclick="konfirmasiHapusPrestasi('${escHtml(p.id)}')" title="Hapus"><i class="fa-solid fa-trash-can"></i></button>
        </td>
      </tr>`;
    }).join('')}
  </tbody></table>`;
}

async function simpanPrestasi() {
  const id    = document.getElementById('prest-id').value;
  const judul = document.getElementById('prest-judul').value.trim();
  const des   = document.getElementById('prest-deskripsi').value.trim();
  const tahun = document.getElementById('prest-tahun').value.trim();
  const medali= document.getElementById('prest-medali').value;
  const emoji = document.getElementById('prest-emoji').value.trim() || '🏆';
  if (!judul || !des) { showToast('Judul dan deskripsi wajib diisi', true); return; }
  if (judul.length > 180) { showToast('Judul prestasi maksimal 180 karakter', true); return; }
  if (des.length > 2000) { showToast('Deskripsi prestasi maksimal 2.000 karakter', true); return; }
  if (tahun && !/^(?:19|20)\d{2}(?:\s*[·\-–—].*)?$/.test(tahun)) {
    showToast('Tahun prestasi harus diawali empat digit tahun yang valid', true);
    return;
  }

  const btn = document.getElementById('btn-simpan-prestasi');
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';

  let foto_url = _prestasiMap[id]?.foto_url || null;
  const fotoFile = document.getElementById('prest-foto').files[0];
  let uploadedPath = '';
  try {
    if (fotoFile) {
      const uploaded = await uploadValidatedFile(fotoFile, {
        kind: 'image', folder: 'prestasi', maxBytes: 3 * 1024 * 1024,
      });
      uploadedPath = uploaded.storagePath;
      foto_url = uploaded.publicUrl;
    }

    const payload = { judul, deskripsi:des, tahun_info:tahun, medali, emoji, foto_url, updated_at: new Date().toISOString() };
    const { error } = id
      ? await sb.from('prestasi').update(payload).eq('id',id)
      : await sb.from('prestasi').insert({ ...payload, aktif:true, urutan: Object.keys(_prestasiMap).length + 1 });
    if (error) throw error;

    const oldPath = storagePathFromPublicUrl(_prestasiMap[id]?.foto_url || '');
    if (uploadedPath && oldPath && oldPath !== uploadedPath) await rollbackUploadedFile(oldPath);
    showToast('Prestasi disimpan');
    resetPrestasiForm();
    await loadPrestasi();
  } catch (error) {
    if (uploadedPath) await rollbackUploadedFile(uploadedPath);
    console.error('Gagal menyimpan prestasi:', error);
    showToast(error instanceof UploadValidationError ? error.message : 'Data prestasi gagal disimpan.', true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan';
  }
}

function editPrestasi(id) {
  const p = _prestasiMap[id];
  if (!p) return;
  document.getElementById('prest-id').value        = p.id;
  document.getElementById('prest-judul').value     = p.judul;
  document.getElementById('prest-deskripsi').value = p.deskripsi || '';
  document.getElementById('prest-tahun').value     = p.tahun_info || '';
  document.getElementById('prest-medali').value    = p.medali || 'emas';
  document.getElementById('prest-emoji').value     = p.emoji || '🏆';
  const wrap = document.getElementById('prest-foto-preview-wrap');
  const img  = document.getElementById('prest-foto-preview');
  if (p.foto_url && isValidHttpUrl(p.foto_url)) { img.src = p.foto_url; wrap.classList.add('show'); }
  else wrap.classList.remove('show');
  document.getElementById('prestasi-form-title').textContent = 'Edit prestasi';
  document.getElementById('panel-prestasi').scrollIntoView({ behavior:'smooth' });
}

function konfirmasiHapusPrestasi(id) {
  const p = _prestasiMap[id];
  openConfirm('Hapus prestasi ini?', `"${p?.judul || id}" akan dihapus permanen.`,
    'Hapus', () => hapusPrestasi(id));
}
async function hapusPrestasi(id) {
  const storagePath = storagePathFromPublicUrl(_prestasiMap[id]?.foto_url || '');
  const hasil = await hapusBaris('prestasi', id);
  if (!hasil.ok) { showToast(hasil.pesan, true); return; }
  if (storagePath) await rollbackUploadedFile(storagePath);
  showToast('Prestasi dihapus'); loadPrestasi();
}
function resetPrestasiForm() {
  ['prest-id','prest-judul','prest-deskripsi','prest-tahun','prest-foto'].forEach(i => {
    const el = document.getElementById(i); if (el) el.value = '';
  });
  document.getElementById('prest-emoji').value = '🏆';
  document.getElementById('prest-medali').value = 'emas';
  document.getElementById('prest-foto-preview-wrap').classList.remove('show');
  document.getElementById('prestasi-form-title').textContent = 'Tambah / edit prestasi';
}

// ═══════════════════════════════════════════════
// DOKUMEN & ARSIP
// ═══════════════════════════════════════════════
const _dokumenMap = {};
const GENERAL_DOCUMENT_CATEGORIES = Object.freeze(['perdes', 'sop', 'statistik', 'poster']);

async function loadDokumen() {
  let { data, error } = await sb.from('dokumen').select('*').order('kategori').order('urutan');
  const el = document.getElementById('dokumen-list');
  if (error) {
    el.innerHTML = `<div class="empty" style="flex-direction:column;gap:8px;">
      <i class="fa-solid fa-triangle-exclamation" style="color:var(--gold);"></i>
      <div>Tabel <strong>dokumen</strong> belum ada di database.</div>
      <div style="font-size:11px;color:var(--text-muted);">Jalankan file SQL dokumen terlebih dahulu.</div>
    </div>`;
    return;
  }
  data = (data || []).filter(documentRecord => GENERAL_DOCUMENT_CATEGORIES.includes(documentRecord.kategori));
  Object.keys(_dokumenMap).forEach(id => delete _dokumenMap[id]);
  if (!data?.length) {
    el.innerHTML = '<div class="empty"><i class="fa-solid fa-folder-open"></i>Belum ada dokumen.</div>'; return;
  }
  data.forEach(d => { _dokumenMap[d.id] = d; });
  const KAT = { perdes:'Peraturan Desa', sop:'SOP', statistik:'Statistik', poster:'Poster Edukasi' };
  const TIPE_ICON = { pdf:'fa-file-pdf', excel:'fa-file-excel', word:'fa-file-word', lainnya:'fa-file' };
  el.innerHTML = `<table><thead><tr>
    <th>File</th><th>Judul</th><th>Kategori</th><th>Aksi</th>
  </tr></thead><tbody>
    ${data.map(d => `<tr>
      <td><i class="fa-solid ${TIPE_ICON[d.tipe]||'fa-file'}" style="font-size:18px;color:var(--emerald);"></i></td>
      <td style="font-weight:500;">${escHtml(d.judul)}
        ${d.file_url && isValidHttpUrl(d.file_url) ? `<a href="${safeAdminUrl(d.file_url)}" target="_blank" rel="noopener noreferrer" aria-label="Buka dokumen ${escHtml(d.judul)}" style="font-size:11px;color:var(--text-muted);margin-left:6px;"><i class="fa-solid fa-up-right-from-square"></i></a>` : '<span style="font-size:11px;color:var(--danger);margin-left:6px;">(belum ada file)</span>'}
      </td>
      <td><span class="badge badge-sky">${KAT[d.kategori]||d.kategori}</span></td>
      <td style="white-space:nowrap;">
        <button class="icon-btn" onclick="editDokumen('${escHtml(d.id)}')" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
        <button class="icon-btn danger" onclick="konfirmasiHapusDokumen('${escHtml(d.id)}')" title="Hapus"><i class="fa-solid fa-trash-can"></i></button>
      </td>
    </tr>`).join('')}
  </tbody></table>`;
}

async function simpanDokumen() {
  const id    = document.getElementById('dok-id').value;
  const judul = document.getElementById('dok-judul').value.trim();
  const kat   = document.getElementById('dok-kategori').value;
  const tipe  = document.getElementById('dok-tipe').value;
  const ket   = document.getElementById('dok-keterangan').value.trim();
  if (!judul) { showToast('Judul wajib diisi', true); return; }
  if (!GENERAL_DOCUMENT_CATEGORIES.includes(kat)) { showToast('Kategori dokumen umum tidak valid.', true); return; }
  if (judul.length > 180) { showToast('Judul dokumen maksimal 180 karakter', true); return; }
  if (ket.length > 1000) { showToast('Keterangan dokumen maksimal 1.000 karakter', true); return; }

  const file = document.getElementById('dok-file').files[0];
  let file_url = _dokumenMap[id]?.file_url || null;
  if (!file && !file_url) {
    showToast('Upload file dokumen terlebih dahulu', true);
    return;
  }

  const btn = document.getElementById('btn-simpan-dok');
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';

  let uploadedPath = '';
  try {
    if (file) {
      const uploaded = await uploadValidatedFile(file, {
        kind: 'document', folder: 'dokumen', maxBytes: 10 * 1024 * 1024,
      });
      uploadedPath = uploaded.storagePath;
      file_url = uploaded.publicUrl;
    }

    const payload = { judul, kategori:kat, tipe, keterangan:ket, file_url, updated_at: new Date().toISOString() };
    const { error } = id
      ? await sb.from('dokumen').update(payload).eq('id',id)
      : await sb.from('dokumen').insert({ ...payload, aktif:true, urutan: Object.keys(_dokumenMap).length + 1 });
    if (error) throw error;

    const oldPath = storagePathFromPublicUrl(_dokumenMap[id]?.file_url || '');
    if (uploadedPath && oldPath && oldPath !== uploadedPath) await rollbackUploadedFile(oldPath);
    showToast('Dokumen disimpan');
    resetDokumenForm();
    await loadDokumen();
  } catch (error) {
    if (uploadedPath) await rollbackUploadedFile(uploadedPath);
    console.error('Gagal menyimpan dokumen:', error);
    showToast(error instanceof UploadValidationError ? error.message : 'Dokumen gagal disimpan.', true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan';
  }
}

function editDokumen(id) {
  const d = _dokumenMap[id];
  if (!d) return;
  document.getElementById('dok-id').value         = d.id;
  document.getElementById('dok-judul').value      = d.judul;
  document.getElementById('dok-kategori').value   = d.kategori;
  document.getElementById('dok-tipe').value       = d.tipe || 'pdf';
  document.getElementById('dok-keterangan').value = d.keterangan || '';
  document.getElementById('dok-file').value       = '';
  const cur = document.getElementById('dok-file-current');
  if (d.file_url) {
    document.getElementById('dok-file-name').textContent = 'File tersimpan — kosongkan jika tidak ganti';
    cur.style.display = 'block';
  } else cur.style.display = 'none';
  document.getElementById('dokumen-form-title').textContent = 'Edit dokumen';
  document.getElementById('panel-dokumen').scrollIntoView({ behavior:'smooth' });
}

function konfirmasiHapusDokumen(id) {
  const d = _dokumenMap[id];
  openConfirm('Hapus dokumen ini?', `"${d?.judul || id}" akan dihapus permanen.`,
    'Hapus', () => hapusDokumen(id));
}
async function hapusDokumen(id) {
  const storagePath = storagePathFromPublicUrl(_dokumenMap[id]?.file_url || '');
  const hasil = await hapusBaris('dokumen', id);
  if (!hasil.ok) { showToast(hasil.pesan, true); return; }
  if (storagePath) await rollbackUploadedFile(storagePath);
  showToast('Dokumen dihapus'); loadDokumen();
}
function resetDokumenForm() {
  ['dok-id','dok-judul','dok-keterangan','dok-file'].forEach(i => {
    const el = document.getElementById(i); if (el) el.value = '';
  });
  document.getElementById('dok-kategori').value = 'perdes';
  document.getElementById('dok-tipe').value = 'pdf';
  document.getElementById('dok-file-current').style.display = 'none';
  document.getElementById('dokumen-form-title').textContent = 'Tambah / edit dokumen';
}

// ═══════════════════════════════════════════════
// AGENDA DESA
// ═══════════════════════════════════════════════
const _agendaMap = {};

async function loadAgenda() {
  const { data, error } = await sb.from('agenda').select('*').order('tanggal', { ascending:false });
  const el = document.getElementById('agenda-list');
  if (error) {
    el.innerHTML = `<div class="empty" style="flex-direction:column;gap:8px;">
      <i class="fa-solid fa-triangle-exclamation" style="color:var(--gold);"></i>
      <div>Tabel <strong>agenda</strong> belum ada di database.</div>
      <div style="font-size:11px;color:var(--text-muted);">Jalankan file SQL agenda terlebih dahulu.</div>
    </div>`;
    return;
  }
  if (!data?.length) {
    el.innerHTML = '<div class="empty"><i class="fa-solid fa-calendar-xmark"></i>Belum ada agenda.</div>'; return;
  }
  data.forEach(a => { _agendaMap[a.id] = a; });
  const BADGE = { Rutin:'badge-green', Penting:'badge-gold', Umum:'badge-sky' };
  const kini = new Date(); kini.setHours(0,0,0,0);
  el.innerHTML = `<table><thead><tr>
    <th>Tanggal</th><th>Kegiatan</th><th>Jenis</th><th>Status</th><th>Aksi</th>
  </tr></thead><tbody>
    ${data.map(a => {
      const lewat = new Date(a.tanggal) < kini;
      return `<tr>
        <td style="white-space:nowrap;font-size:12px;">${escHtml(fmtTglAdmin(a.tanggal))}</td>
        <td style="font-weight:500;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(a.judul)}</td>
        <td><span class="badge ${BADGE[a.jenis]||'badge-sky'}">${escHtml(a.jenis||'Umum')}</span></td>
        <td><span style="font-size:11.5px;color:${lewat?'var(--text-muted)':'var(--emerald)'};">${lewat?'Terlaksana':'Mendatang'}</span></td>
        <td style="white-space:nowrap;">
          <button class="icon-btn" onclick="editAgenda('${escHtml(a.id)}')" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
          <button class="icon-btn danger" onclick="konfirmasiHapusAgenda('${escHtml(a.id)}')" title="Hapus"><i class="fa-solid fa-trash-can"></i></button>
        </td>
      </tr>`;
    }).join('')}
  </tbody></table>`;
}

function fmtTglAdmin(str) {
  if (!str) return '—';
  try {
    return new Date(str).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
  } catch { return str; }
}

async function simpanAgenda() {
  const id     = document.getElementById('ag-id').value;
  const judul  = document.getElementById('ag-judul').value.trim();
  const des    = document.getElementById('ag-deskripsi').value.trim();
  const tgl    = document.getElementById('ag-tanggal').value;
  const waktu  = document.getElementById('ag-waktu').value.trim();
  const jenis  = document.getElementById('ag-jenis').value;
  const lokasi = document.getElementById('ag-lokasi').value.trim();
  if (!judul || !tgl) { showToast('Judul dan tanggal wajib diisi', true); return; }
  if (judul.length > 180) { showToast('Judul agenda maksimal 180 karakter.', true); return; }
  if (des.length > 2000) { showToast('Deskripsi agenda maksimal 2.000 karakter.', true); return; }
  if (Number.isNaN(Date.parse(tgl))) { showToast('Tanggal agenda tidak valid.', true); return; }

  const btn = document.getElementById('btn-simpan-ag');
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';

  try {
    const payload = { judul, deskripsi:des, tanggal:tgl, waktu, jenis, lokasi, updated_at:new Date().toISOString() };
    const { error } = id
      ? await sb.from('agenda').update(payload).eq('id',id)
      : await sb.from('agenda').insert({ ...payload, aktif:true });
    if (error) throw error;
    showToast('Agenda disimpan');
    resetAgendaForm();
    await loadAgenda();
  } catch (error) {
    console.error('Gagal menyimpan agenda:', error);
    showToast('Agenda gagal disimpan.', true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan';
  }
}

function editAgenda(id) {
  const a = _agendaMap[id];
  if (!a) return;
  document.getElementById('ag-id').value        = a.id;
  document.getElementById('ag-judul').value     = a.judul;
  document.getElementById('ag-deskripsi').value = a.deskripsi || '';
  document.getElementById('ag-tanggal').value   = a.tanggal ? a.tanggal.slice(0,10) : '';
  document.getElementById('ag-waktu').value     = a.waktu || '';
  document.getElementById('ag-jenis').value     = a.jenis || 'Umum';
  document.getElementById('ag-lokasi').value    = a.lokasi || '';
  document.getElementById('agenda-form-title').textContent = 'Edit agenda';
  document.getElementById('panel-agenda').scrollIntoView({ behavior:'smooth' });
}

function konfirmasiHapusAgenda(id) {
  const a = _agendaMap[id];
  openConfirm('Hapus agenda ini?', `"${a?.judul || id}" akan dihapus permanen.`, 'Hapus', () => hapusAgenda(id));
}
async function hapusAgenda(id) {
  const hasil = await hapusBaris('agenda', id);
  if (!hasil.ok) { showToast(hasil.pesan, true); return; }
  showToast('Agenda dihapus'); loadAgenda();
}
function resetAgendaForm() {
  ['ag-id','ag-judul','ag-deskripsi','ag-tanggal','ag-waktu','ag-lokasi'].forEach(i => {
    const el = document.getElementById(i); if (el) el.value = '';
  });
  document.getElementById('ag-jenis').value = 'Rutin';
  document.getElementById('agenda-form-title').textContent = 'Tambah / edit agenda';
}

// ═══════════════════════════════════════════════
// ASPIRASI WARGA
// ═══════════════════════════════════════════════
let _allAspirasi = [];
const _aspirasiMap = {};

async function loadAspirasi() {
  const { data, error } = await sb.from('aspirasi').select('*').order('created_at', { ascending:false });
  const el = document.getElementById('aspirasi-list');
  if (error) {
    el.innerHTML = `<div class="empty" style="flex-direction:column;gap:8px;">
      <i class="fa-solid fa-triangle-exclamation" style="color:var(--gold);"></i>
      <div>Tabel <strong>aspirasi</strong> belum ada di database.</div>
      <div style="font-size:11px;color:var(--text-muted);">Jalankan file SQL aspirasi terlebih dahulu.</div>
    </div>`;
    return;
  }
  _allAspirasi = data || [];
  data?.forEach(a => { _aspirasiMap[a.id] = a; });
  renderAspirasi(_allAspirasi);
  updateAspBadge();
}

function updateAspBadge() {
  const baru = _allAspirasi.filter(a => a.status === 'baru').length;
  const badge = document.getElementById('asp-badge');
  if (badge) {
    badge.textContent = baru;
    badge.style.display = baru > 0 ? 'inline-block' : 'none';
  }
}

function filterAspirasi() {
  const q    = (document.getElementById('asp-search')?.value || '').toLowerCase();
  const stat = document.getElementById('asp-filter-status')?.value || '';
  const kat  = document.getElementById('asp-filter-kat')?.value || '';
  const hasil = _allAspirasi.filter(a =>
    (!q    || (a.nama||'').toLowerCase().includes(q) || (a.isi||'').toLowerCase().includes(q)) &&
    (!stat || a.status === stat) &&
    (!kat  || a.kategori === kat)
  );
  renderAspirasi(hasil);
  const c = document.getElementById('asp-filter-count');
  if (c) c.textContent = hasil.length < _allAspirasi.length ? `${hasil.length} dari ${_allAspirasi.length}` : '';
}

function renderAspirasi(data) {
  const el = document.getElementById('aspirasi-list');
  if (!data.length) {
    el.innerHTML = '<div class="empty"><i class="fa-solid fa-comment-dots"></i>Tidak ada aspirasi yang cocok.</div>'; return;
  }
  const STATUS = {
    baru:     { c:'badge-gold',  t:'Baru' },
    diproses: { c:'badge-sky',   t:'Diproses' },
    selesai:  { c:'badge-green', t:'Selesai' },
  };
  el.innerHTML = data.map(a => {
    const s = STATUS[a.status] || STATUS.baru;
    const tgl = a.created_at ? new Date(a.created_at).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}) : '—';
    return `
    <div style="border:1px solid var(--border);border-radius:var(--r);padding:16px;margin-bottom:12px;background:${a.status==='baru'?'#FFFDF7':'#fff'};">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px;flex-wrap:wrap;">
        <div>
          <div style="font-weight:600;font-size:14px;">${escHtml(a.nama)}</div>
          <div style="font-size:11.5px;color:var(--text-muted);margin-top:2px;">
            ${escHtml(a.dusun || 'Dusun tidak diisi')} · ${tgl}
            ${a.kontak ? ` · <a href="https://wa.me/62${escHtml(a.kontak.replace(/^0/,''))}" target="_blank" rel="noopener noreferrer" style="color:var(--emerald);">${escHtml(a.kontak)}</a>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          <span class="badge badge-teal">${escHtml(a.kategori||'Lainnya')}</span>
          <span class="badge ${s.c}">${s.t}</span>
        </div>
      </div>
      <p style="font-size:13.5px;line-height:1.7;color:var(--text-sec);margin-bottom:12px;white-space:pre-wrap;">${escHtml(a.isi)}</p>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        ${a.status !== 'diproses' ? `<button class="btn" style="font-size:12px;padding:6px 12px;" onclick="ubahStatusAspirasi('${escHtml(a.id)}','diproses')"><i class="fa-solid fa-spinner"></i> Tandai diproses</button>` : ''}
        ${a.status !== 'selesai' ? `<button class="btn" style="font-size:12px;padding:6px 12px;" onclick="ubahStatusAspirasi('${escHtml(a.id)}','selesai')"><i class="fa-solid fa-check"></i> Tandai selesai</button>` : ''}
        ${a.kontak ? `<a class="btn" style="font-size:12px;padding:6px 12px;text-decoration:none;" href="https://wa.me/62${escHtml(a.kontak.replace(/^0/,''))}?text=${encodeURIComponent('Halo ' + a.nama + ', terima kasih atas aspirasi yang Anda kirimkan ke Desa Kandeman.')}" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-whatsapp"></i> Balas WA</a>` : ''}
        <button class="btn" style="font-size:12px;padding:6px 12px;color:var(--danger);border-color:rgba(192,57,43,.3);" onclick="konfirmasiHapusAspirasi('${escHtml(a.id)}')"><i class="fa-solid fa-trash-can"></i> Hapus</button>
      </div>
    </div>`;
  }).join('');
}

async function ubahStatusAspirasi(id, status) {
  const { error } = await sb.from('aspirasi').update({ status }).eq('id', id);
  if (error) { showToast('Gagal mengubah status: ' + error.message, true); return; }
  showToast('Status diperbarui'); loadAspirasi();
}

function konfirmasiHapusAspirasi(id) {
  const a = _aspirasiMap[id];
  openConfirm('Hapus aspirasi ini?', `Aspirasi dari "${a?.nama || id}" akan dihapus permanen.`, 'Hapus', () => hapusAspirasi(id));
}
async function hapusAspirasi(id) {
  const hasil = await hapusBaris('aspirasi', id);
  if (!hasil.ok) { showToast(hasil.pesan, true); return; }
  showToast('Aspirasi dihapus'); loadAspirasi();
}

// ═══════════════════════════════════════════════
// EXPORT KE CSV (bisa dibuka Excel)
// ═══════════════════════════════════════════════
function exportCSV(rows, namaFile) {
  if (!rows || !rows.length) { showToast('Tidak ada data untuk diekspor', true); return; }
  const kolom = Object.keys(rows[0]);
  const esc = v => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
  };
  const csv = '\uFEFF' + [
    kolom.join(','),
    ...rows.map(r => kolom.map(k => esc(r[k])).join(','))
  ].join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = namaFile + '-' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Data diekspor');
}

async function exportTabel(tabel) {
  const { data, error } = await sb.from(tabel).select('*');
  if (error) { showToast('Gagal mengambil data: ' + error.message, true); return; }
  exportCSV(data, 'sikanda-' + tabel);
}

// ═══════════════════════════════════════════════
// GANTI KATA SANDI
// ═══════════════════════════════════════════════
async function ubahPassword() {
  const baru = prompt('Masukkan kata sandi baru (minimal 8 karakter):');
  if (!baru) return;
  if (baru.length < 8) { showToast('Kata sandi minimal 8 karakter', true); return; }
  const konfirmasi = prompt('Ketik ulang kata sandi baru:');
  if (baru !== konfirmasi) { showToast('Kata sandi tidak cocok', true); return; }
  const { error } = await sb.auth.updateUser({ password: baru });
  if (error) { showToast('Gagal mengubah kata sandi: ' + error.message, true); return; }
  showToast('Kata sandi berhasil diubah');
}
// ═══════════════════════════════════════════════
// STATISTIK WARGA
// ═══════════════════════════════════════════════
const _statistikMap = {};

const ST_FIELD = {
  'st-tahun':'tahun','st-periode':'periode',
  'st-total':'total_penduduk','st-kk':'total_kk','st-laki':'total_laki','st-perempuan':'total_perempuan',
  'st-u09l':'umur_0_9_l','st-u09p':'umur_0_9_p',
  'st-u1019l':'umur_10_19_l','st-u1019p':'umur_10_19_p',
  'st-u2029l':'umur_20_29_l','st-u2029p':'umur_20_29_p',
  'st-u3044l':'umur_30_44_l','st-u3044p':'umur_30_44_p',
  'st-u4559l':'umur_45_59_l','st-u4559p':'umur_45_59_p',
  'st-u60l':'umur_60plus_l','st-u60p':'umur_60plus_p',
  'st-belum-sekolah':'didik_belum_sekolah',
  'st-masih-sd':'didik_masih_sd',
  'st-tamat-sd':'didik_tamat_sd',
  'st-sltp':'didik_sltp',
  'st-slta':'didik_slta',
  'st-diploma-1-2':'didik_diploma_1_2',
  'st-diploma-3':'didik_diploma_3',
  'st-diploma-4-s1':'didik_diploma_4_s1',
  'st-s2':'didik_s2',
  'st-s3':'didik_s3'
};

const ST_GROWTH_FIELD = {
  'st-pertumbuhan-jumlah':'pertumbuhan_penduduk',
  'st-pertumbuhan-persen':'laju_pertumbuhan_persen'
};

const ST_EDUCATION_IDS = [
  'st-belum-sekolah','st-masih-sd','st-tamat-sd','st-sltp','st-slta',
  'st-diploma-1-2','st-diploma-3','st-diploma-4-s1','st-s2','st-s3'
];

function cekJumlahDidik() {
  const t = ST_EDUCATION_IDS.reduce((a,i) => a + (parseInt(document.getElementById(i)?.value, 10) || 0), 0);
  const totalPenduduk = parseInt(document.getElementById('st-total')?.value, 10) || 0;
  const el = document.getElementById('st-didik-sum');
  if (!el) return;
  const pas = totalPenduduk > 0 && t === totalPenduduk;
  el.className = 'pct-sum-indicator ' + (pas ? 'pct-sum-ok' : 'pct-sum-warn');
  el.innerHTML = `<i class="fa-solid fa-${pas ? 'circle-check' : 'triangle-exclamation'}"></i> ` +
    `Total pendidikan: ${t.toLocaleString('id-ID')} jiwa` +
    (pas ? ' — sesuai total penduduk' : ` — harus sama dengan ${totalPenduduk.toLocaleString('id-ID')} jiwa`);
}

async function loadStatistik() {
  const { data, error } = await sb.from('statistik')
    .select('*').order('tahun', { ascending:false }).order('periode', { ascending:false });
  const el = document.getElementById('statistik-list');
  if (error) {
    el.innerHTML = `<div class="empty" style="flex-direction:column;gap:8px;">
      <i class="fa-solid fa-triangle-exclamation" style="color:var(--gold);"></i>
      <div>Tabel <strong>statistik</strong> belum ada di database.</div>
      <div style="font-size:11px;color:var(--text-muted);">Jalankan berkas SQL statistik terlebih dahulu.</div>
    </div>`;
    return;
  }
  if (!data?.length) {
    el.innerHTML = '<div class="empty"><i class="fa-solid fa-chart-pie"></i>Belum ada data statistik.</div>';
    // Prefill tahun & periode berjalan
    const kini = new Date();
    document.getElementById('st-tahun').value = kini.getFullYear();
    document.getElementById('st-periode').value = kini.getMonth() >= 6 ? '7' : '1';
    return;
  }
  data.forEach(s => { _statistikMap[s.id] = s; });

  el.innerHTML = `<table><thead><tr>
    <th>Periode</th><th>Penduduk</th><th>KK</th><th>L / P</th><th>Pertumbuhan</th><th>Aksi</th>
  </tr></thead><tbody>
    ${data.map((s, i) => `<tr>
      <td style="font-weight:500;white-space:nowrap;">
        ${s.periode >= 7 ? 'Juli' : 'Januari'} ${s.tahun}
        ${i === 0 ? '<span class="badge badge-green" style="margin-left:6px;">Tampil</span>' : ''}
      </td>
      <td style="font-family:'DM Mono',monospace;">${Number(s.total_penduduk||0).toLocaleString('id-ID')}</td>
      <td style="font-family:'DM Mono',monospace;">${Number(s.total_kk||0).toLocaleString('id-ID')}</td>
      <td style="font-size:12px;">${Number(s.total_laki||0).toLocaleString('id-ID')} / ${Number(s.total_perempuan||0).toLocaleString('id-ID')}</td>
      <td style="font-size:12px;white-space:nowrap;">
        ${Number(s.pertumbuhan_penduduk||0) > 0 ? '+' : ''}${Number(s.pertumbuhan_penduduk||0).toLocaleString('id-ID')} jiwa<br>
        <span style="color:var(--text-muted);">${Number(s.laju_pertumbuhan_persen||0) > 0 ? '+' : ''}${Number(s.laju_pertumbuhan_persen||0).toLocaleString('id-ID',{maximumFractionDigits:3})}%</span>
      </td>
      <td style="white-space:nowrap;">
        <button class="icon-btn" onclick="editStatistik('${escHtml(s.id)}')" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
        <button class="icon-btn danger" onclick="konfirmasiHapusStatistik('${escHtml(s.id)}')" title="Hapus"><i class="fa-solid fa-trash-can"></i></button>
      </td>
    </tr>`).join('')}
  </tbody></table>`;
}

async function simpanStatistik() {
  const tahun = readFiniteNumber('st-tahun');
  if (!Number.isInteger(tahun) || tahun < 2000 || tahun > 2100) {
    showToast('Tahun statistik harus berupa empat digit tahun yang valid.', true); return;
  }

  const payload = { aktif:true, updated_at: new Date().toISOString() };
  for (const [idEl, kolom] of Object.entries(ST_FIELD)) {
    const value = readFiniteNumber(idEl);
    if (!Number.isFinite(value) || value < 0) {
      showToast('Seluruh nilai statistik harus berupa angka dan tidak boleh negatif.', true); return;
    }
    payload[kolom] = value;
  }
  for (const [idEl, kolom] of Object.entries(ST_GROWTH_FIELD)) {
    const value = readFiniteNumber(idEl);
    if (!Number.isFinite(value)) {
      showToast('Jumlah dan laju pertumbuhan penduduk harus berupa angka.', true); return;
    }
    payload[kolom] = value;
  }
  if (!Number.isInteger(payload.pertumbuhan_penduduk)) {
    showToast('Perubahan jumlah penduduk harus berupa bilangan bulat dalam satuan jiwa.', true); return;
  }
  if (payload.laju_pertumbuhan_persen < -100 || payload.laju_pertumbuhan_persen > 1000) {
    showToast('Laju pertumbuhan harus berada di antara -100% dan 1.000%.', true); return;
  }
  const growthCountDirection = Math.sign(payload.pertumbuhan_penduduk);
  const growthRateDirection = Math.sign(payload.laju_pertumbuhan_persen);
  if (growthCountDirection !== growthRateDirection) {
    showToast('Arah perubahan jumlah penduduk dan persentasenya harus sama. Gunakan positif untuk bertambah, negatif untuk berkurang, atau nol untuk stabil.', true); return;
  }
  if (![1, 7].includes(payload.periode)) {
    showToast('Periode statistik harus Januari atau Juli.', true); return;
  }
  if (payload.total_penduduk !== payload.total_laki + payload.total_perempuan) {
    showToast('Total penduduk harus sama dengan jumlah laki-laki dan perempuan.', true); return;
  }
  if (payload.total_kk > payload.total_penduduk) {
    showToast('Jumlah kepala keluarga tidak boleh melebihi total penduduk.', true); return;
  }

  const ageColumns = [
    'umur_0_9_l','umur_0_9_p','umur_10_19_l','umur_10_19_p',
    'umur_20_29_l','umur_20_29_p','umur_30_44_l','umur_30_44_p',
    'umur_45_59_l','umur_45_59_p','umur_60plus_l','umur_60plus_p'
  ];
  const ageTotal = ageColumns.reduce((sum, column) => sum + payload[column], 0);
  if (ageTotal !== payload.total_penduduk) {
    showToast('Total seluruh kelompok umur harus sama dengan total penduduk.', true); return;
  }

  const educationColumns = [
    'didik_belum_sekolah','didik_masih_sd','didik_tamat_sd','didik_sltp','didik_slta',
    'didik_diploma_1_2','didik_diploma_3','didik_diploma_4_s1','didik_s2','didik_s3'
  ];
  if (educationColumns.some(column => !Number.isInteger(payload[column]))) {
    showToast('Seluruh data tingkat pendidikan harus berupa jumlah jiwa dalam bilangan bulat.', true); return;
  }
  const educationTotal = educationColumns.reduce((sum, column) => sum + payload[column], 0);
  if (educationTotal !== payload.total_penduduk) {
    showToast('Total seluruh kategori pendidikan harus sama dengan total penduduk.', true); return;
  }

  const btn = document.getElementById('btn-simpan-st');
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';

  try {
    const id = document.getElementById('st-id').value;
    const { error } = id
      ? await sb.from('statistik').update(payload).eq('id', id)
      : await sb.from('statistik').insert(payload);
    if (error) throw error;
    showToast('Statistik warga disimpan');
    resetStatistikForm();
    await loadStatistik();
  } catch (error) {
    console.error('Gagal menyimpan statistik:', error);
    const message = String(error?.message || '').toLowerCase();
    const duplicate = message.includes('duplicate');
    const missingGrowthSchema = message.includes('pertumbuhan_penduduk') ||
      message.includes('laju_pertumbuhan_persen');
    const missingEducationSchema = message.includes('didik_belum_sekolah');
    showToast(duplicate
      ? 'Periode ini sudah ada. Gunakan tombol edit pada daftar di bawah.'
      : missingGrowthSchema
        ? 'Kolom laju pertumbuhan belum tersedia. Jalankan supabase-statistik-pertumbuhan.sql terlebih dahulu.'
      : missingEducationSchema
        ? 'Kolom pendidikan baru belum tersedia. Jalankan supabase-statistik-pendidikan.sql terlebih dahulu.'
        : 'Data statistik gagal disimpan: ' + (error?.message || 'kesalahan tidak diketahui'), true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan Statistik';
  }
}

function editStatistik(id) {
  const s = _statistikMap[id];
  if (!s) return;
  document.getElementById('st-id').value = s.id;
  for (const [idEl, kolom] of Object.entries(ST_FIELD)) {
    const el = document.getElementById(idEl);
    if (el) el.value = s[kolom] ?? '';
  }
  for (const [idEl, kolom] of Object.entries(ST_GROWTH_FIELD)) {
    const el = document.getElementById(idEl);
    if (el) el.value = s[kolom] ?? 0;
  }
  document.getElementById('statistik-form-title').textContent =
    'Edit periode ' + (s.periode >= 7 ? 'Juli' : 'Januari') + ' ' + s.tahun;
  cekJumlahDidik();
  document.getElementById('panel-statistik').scrollIntoView({ behavior:'smooth' });
}

function konfirmasiHapusStatistik(id) {
  const s = _statistikMap[id];
  openConfirm('Hapus data periode ini?',
    `Statistik ${s?.periode >= 7 ? 'Juli' : 'Januari'} ${s?.tahun} akan dihapus permanen.`,
    'Hapus', () => hapusStatistik(id));
}
async function hapusStatistik(id) {
  const hasil = await hapusBaris('statistik', id);
  if (!hasil.ok) { showToast(hasil.pesan, true); return; }
  showToast('Data statistik dihapus'); loadStatistik();
}

function resetStatistikForm() {
  document.getElementById('st-id').value = '';
  for (const idEl of Object.keys(ST_FIELD)) {
    const el = document.getElementById(idEl);
    if (el && idEl !== 'st-periode') el.value = '';
  }
  for (const idEl of Object.keys(ST_GROWTH_FIELD)) {
    const el = document.getElementById(idEl);
    if (el) el.value = '0';
  }
  const kini = new Date();
  document.getElementById('st-tahun').value = kini.getFullYear();
  document.getElementById('st-periode').value = kini.getMonth() >= 6 ? '7' : '1';
  document.getElementById('statistik-form-title').textContent = 'Data periode';
  cekJumlahDidik();
}

// ═══════════════════════════════════════════════
// JADWAL KESEHATAN
// ═══════════════════════════════════════════════
const _jadwalMap = {};
const NAMA_BULAN = ['','Januari','Februari','Maret','April','Mei','Juni',
                    'Juli','Agustus','September','Oktober','November','Desember'];

function switchKesTab(id, btn) {
  document.querySelectorAll('#panel-kesehatan .apb-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#panel-kesehatan .apb-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('kes-pane-' + id).classList.add('active');
  btn.classList.add('active');
}

async function loadJadwalKesehatan() {
  const filter = document.getElementById('jk-filter-bulan')?.value;
  let q = sb.from('jadwal_kesehatan').select('*');
  if (filter) q = q.eq('bulan', parseInt(filter));
  const { data, error } = await q.order('tahun', { ascending:false })
                                 .order('bulan', { ascending:false })
                                 .order('urutan');
  const el = document.getElementById('jadwal-list');
  if (error) {
    el.innerHTML = `<div class="empty" style="flex-direction:column;gap:8px;">
      <i class="fa-solid fa-triangle-exclamation" style="color:var(--gold);"></i>
      <div>Tabel <strong>jadwal_kesehatan</strong> belum ada di database.</div>
      <div style="font-size:11px;color:var(--text-muted);">Jalankan berkas SQL statistik &amp; kesehatan dahulu.</div>
    </div>`;
    return;
  }
  if (!data?.length) {
    el.innerHTML = '<div class="empty"><i class="fa-solid fa-calendar-xmark"></i>Belum ada jadwal.</div>';
    const c = document.getElementById('jk-count'); if (c) c.textContent = '';
    return;
  }
  data.forEach(j => { _jadwalMap[j.id] = j; });
  const c = document.getElementById('jk-count');
  if (c) c.textContent = data.length + ' jadwal';

  const kini = new Date();
  const bIni = kini.getMonth() + 1, tIni = kini.getFullYear();

  el.innerHTML = `<table><thead><tr>
    <th>Periode</th><th>Dusun</th><th>Lokasi</th><th>Jadwal</th><th>Jam</th><th>Aksi</th>
  </tr></thead><tbody>
    ${data.map(j => {
      const skrg = j.bulan === bIni && j.tahun === tIni;
      return `<tr>
        <td style="white-space:nowrap;font-size:12px;">
          ${NAMA_BULAN[j.bulan] || j.bulan} ${j.tahun}
          ${skrg ? '<span class="badge badge-green" style="margin-left:5px;">Aktif</span>' : ''}
        </td>
        <td>${escHtml(j.dusun)}</td>
        <td style="font-size:12px;">${escHtml(j.lokasi || '—')}</td>
        <td style="font-size:12px;">${escHtml(formatTanggalJadwal(j.jadwal, j.bulan, j.tahun))}</td>
        <td style="font-size:12px;">${escHtml(j.jam || '09.00 - selesai')}</td>
        <td style="white-space:nowrap;">
          <button class="icon-btn" onclick="editJadwal('${escHtml(j.id)}')" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
          <button class="icon-btn danger" onclick="konfirmasiHapusJadwal('${escHtml(j.id)}')" title="Hapus"><i class="fa-solid fa-trash-can"></i></button>
        </td>
      </tr>`;
    }).join('')}
  </tbody></table>`;
}

async function simpanJadwalKesehatan() {
  // Posyandu & Posbindu kini digabung, jadi kegiatan tidak lagi dipilih
  // manual; kolomnya tetap diisi agar data lama & batasan NOT NULL aman.
  const kegiatan = 'Posyandu & Posbindu';
  const dusun    = document.getElementById('jk-dusun').value;
  const jadwal   = document.getElementById('jk-jadwal').value.trim();
  const lokasi   = document.getElementById('jk-lokasi').value.trim();
  const jam      = document.getElementById('jk-jam').value.trim() || '09.00 - selesai';
  const bulan    = readFiniteNumber('jk-bulan');
  const tahun    = readFiniteNumber('jk-tahun');
  if (!jadwal) { showToast('Jadwal wajib diisi', true); return; }
  if (!Number.isInteger(bulan) || bulan < 1 || bulan > 12) {
    showToast('Bulan jadwal tidak valid.', true); return;
  }
  if (!Number.isInteger(tahun) || tahun < 2000 || tahun > 2100) {
    showToast('Tahun jadwal harus berupa empat digit tahun yang valid.', true); return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jadwal) || Number.isNaN(Date.parse(jadwal))) {
    showToast('Tanggal jadwal tidak valid.', true); return;
  }
  const selectedDate = new Date(jadwal + 'T00:00:00');
  if (selectedDate.getFullYear() !== tahun || selectedDate.getMonth() + 1 !== bulan) {
    showToast('Tanggal jadwal harus sesuai dengan bulan dan tahun yang dipilih.', true); return;
  }
  if (dusun.length > 100 || lokasi.length > 200 || jam.length > 50) {
    showToast('Data jadwal melebihi batas panjang yang diizinkan.', true); return;
  }

  const btn = document.getElementById('btn-simpan-jk');
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';

  try {
    const id = document.getElementById('jk-id').value;
    const payload = { kegiatan, dusun, jadwal, lokasi, jam, bulan, tahun, updated_at:new Date().toISOString() };
    const { error } = id
      ? await sb.from('jadwal_kesehatan').update(payload).eq('id', id)
      : await sb.from('jadwal_kesehatan').insert({ ...payload, aktif:true, urutan: Object.keys(_jadwalMap).length + 1 });
    if (error) throw error;
    showToast('Jadwal disimpan');
    resetJadwalForm();
    await loadJadwalKesehatan();
  } catch (error) {
    console.error('Gagal menyimpan jadwal kesehatan:', error);
    showToast('Jadwal gagal disimpan.', true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan';
  }
}

async function salinJadwalBulanLalu() {
  const bulan = parseInt(document.getElementById('jk-bulan').value);
  const tahun = parseInt(document.getElementById('jk-tahun').value);
  if (!bulan || !tahun) { showToast('Isi bulan dan tahun tujuan dahulu', true); return; }

  const bLalu = bulan === 1 ? 12 : bulan - 1;
  const tLalu = bulan === 1 ? tahun - 1 : tahun;

  const { data } = await sb.from('jadwal_kesehatan')
    .select('*').eq('bulan', bLalu).eq('tahun', tLalu).order('urutan');
  if (!data || !data.length) {
    showToast(`Tidak ada jadwal ${NAMA_BULAN[bLalu]} ${tLalu} untuk disalin`, true);
    return;
  }

  openConfirm('Salin jadwal bulan lalu?',
    `${data.length} jadwal dari ${NAMA_BULAN[bLalu]} ${tLalu} akan disalin ke ${NAMA_BULAN[bulan]} ${tahun}.`,
    'Salin', async () => {
      const baris = data.map(j => ({
        kegiatan:j.kegiatan, dusun:j.dusun, jadwal:j.jadwal, lokasi:j.lokasi, jam:j.jam,
        bulan, tahun, urutan:j.urutan, aktif:true
      }));
      const { error } = await sb.from('jadwal_kesehatan').insert(baris);
      if (error) { showToast('Gagal menyalin: ' + error.message, true); return; }
      showToast(`${baris.length} jadwal disalin`);
      loadJadwalKesehatan();
    });
}

function editJadwal(id) {
  const j = _jadwalMap[id];
  if (!j) return;
  document.getElementById('jk-id').value       = j.id;
  document.getElementById('jk-dusun').value  = j.dusun;
  document.getElementById('jk-jadwal').value = j.jadwal || '';
  document.getElementById('jk-lokasi').value = j.lokasi || '';
  document.getElementById('jk-jam').value    = j.jam || '09.00 - selesai';
  document.getElementById('jk-bulan').value    = j.bulan;
  document.getElementById('jk-tahun').value    = j.tahun;
  document.getElementById('jadwal-form-title').textContent = 'Edit jadwal';
  document.getElementById('panel-kesehatan').scrollIntoView({ behavior:'smooth' });
}


/* Tanggal jadwal disimpan sebagai YYYY-MM-DD (dari <input type="date">).
   Ditampilkan sebagai hari/bulan/tahun. Data lama berupa teks bebas
   (mis. "Tanggal 5") dibiarkan apa adanya agar tidak hilang. */
function formatTanggalJadwal(nilai, bulan, tahun) {
  if (!nilai && nilai !== 0) return '';
  const teks = String(nilai).trim();
  const iso = teks.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(teks)) return teks;
  const angka = teks.match(/^(?:tanggal\s*)?(\d{1,2})$/i);
  if (angka && bulan && tahun) {
    const b = Number(bulan), t = Number(tahun);
    if (b >= 1 && b <= 12 && t > 1900) {
      const h = Math.min(Number(angka[1]), new Date(t, b, 0).getDate());
      return `${String(h).padStart(2,'0')}/${String(b).padStart(2,'0')}/${t}`;
    }
  }
  return teks;
}

function konfirmasiHapusJadwal(id) {
  const j = _jadwalMap[id];
  openConfirm('Hapus jadwal ini?',
    `"${j?.kegiatan} — ${j?.dusun}" akan dihapus permanen.`,
    'Hapus', () => hapusJadwal(id));
}
async function hapusJadwal(id) {
  const hasil = await hapusBaris('jadwal_kesehatan', id);
  if (!hasil.ok) { showToast(hasil.pesan, true); return; }
  showToast('Jadwal dihapus'); loadJadwalKesehatan();
}

function resetJadwalForm() {
  document.getElementById('jk-id').value      = '';
  document.getElementById('jk-jadwal').value = '';
  document.getElementById('jk-lokasi').value = '';
  document.getElementById('jk-jam').value    = '09.00 - selesai';
  const kini = new Date();
  document.getElementById('jk-bulan').value = kini.getMonth() + 1;
  document.getElementById('jk-tahun').value = kini.getFullYear();
  document.getElementById('jadwal-form-title').textContent = 'Tambah / edit jadwal';
}

// ═══════════════════════════════════════════════
// KONTAK KESEHATAN
// ═══════════════════════════════════════════════
const _kontakMap = {};

async function loadKontakKesehatan() {
  const { data, error } = await sb.from('kontak_kesehatan').select('*').order('urutan');
  const el = document.getElementById('kontak-list');
  if (error) {
    el.innerHTML = `<div class="empty" style="flex-direction:column;gap:8px;">
      <i class="fa-solid fa-triangle-exclamation" style="color:var(--gold);"></i>
      <div>Tabel <strong>kontak_kesehatan</strong> belum ada di database.</div>
      <div style="font-size:11px;color:var(--text-muted);">Jalankan berkas SQL statistik &amp; kesehatan dahulu.</div>
    </div>`;
    return;
  }
  if (!data?.length) {
    el.innerHTML = '<div class="empty"><i class="fa-solid fa-phone-volume"></i>Belum ada kontak layanan.</div>';
    return;
  }
  data.forEach(k => { _kontakMap[k.id] = k; });

  const WARNA = { emergency:'badge-gold', bidan:'badge-teal', pusk:'badge-sky' };
  el.innerHTML = `<table><thead><tr>
    <th>Layanan</th><th>Telepon</th><th>Jam</th><th>Lokasi</th><th>Aksi</th>
  </tr></thead><tbody>
    ${data.map(k => `<tr>
      <td>
        <div style="font-weight:500;">${escHtml(k.nama_layanan)}</div>
        ${k.petugas ? `<div style="font-size:11.5px;color:var(--text-muted);margin-top:2px;">${escHtml(k.petugas)}</div>` : ''}
        <span class="badge ${WARNA[k.jenis]||'badge-gold'}" style="margin-top:4px;display:inline-block;">${escHtml(k.jenis||'umum')}</span>
      </td>
      <td style="font-size:12px;white-space:nowrap;">
        ${k.telepon ? escHtml(k.telepon) : '<span style="color:var(--danger);">belum diisi</span>'}
      </td>
      <td style="font-size:12px;">${escHtml(k.jam_layanan || '—')}</td>
      <td style="font-size:12px;max-width:180px;">${escHtml(k.lokasi || '—')}</td>
      <td style="white-space:nowrap;">
        <button class="icon-btn" onclick="editKontak('${escHtml(k.id)}')" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
        <button class="icon-btn danger" onclick="konfirmasiHapusKontak('${escHtml(k.id)}')" title="Hapus"><i class="fa-solid fa-trash-can"></i></button>
      </td>
    </tr>`).join('')}
  </tbody></table>`;
}

async function simpanKontakKesehatan() {
  const nama = document.getElementById('kk-nama').value.trim();
  if (!nama) { showToast('Nama layanan wajib diisi', true); return; }

  const telepon = document.getElementById('kk-telepon').value.trim();
  const urutan = readFiniteNumber('kk-urutan');
  if (nama.length > 150) { showToast('Nama layanan maksimal 150 karakter.', true); return; }
  if (!isValidPhone(telepon)) { showToast('Nomor telepon hanya boleh berisi angka dan tanda telepon yang umum.', true); return; }
  if (!Number.isInteger(urutan) || urutan < 0) { showToast('Nomor urutan harus berupa bilangan bulat non-negatif.', true); return; }

  const btn = document.getElementById('btn-simpan-kk');
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';

  const payload = {
    nama_layanan: nama,
    petugas:      document.getElementById('kk-petugas').value.trim(),
    telepon,
    lokasi:       document.getElementById('kk-lokasi').value.trim(),
    jam_layanan:  document.getElementById('kk-jam').value.trim(),
    jenis:        document.getElementById('kk-jenis').value,
    ikon:         document.getElementById('kk-ikon').value,
    urutan,
    updated_at:   new Date().toISOString()
  };

  try {
    const id = document.getElementById('kk-id').value;
    const { error } = id
      ? await sb.from('kontak_kesehatan').update(payload).eq('id', id)
      : await sb.from('kontak_kesehatan').insert({ ...payload, aktif:true });
    if (error) throw error;
    showToast('Kontak layanan disimpan');
    resetKontakForm();
    await loadKontakKesehatan();
  } catch (error) {
    console.error('Gagal menyimpan kontak layanan:', error);
    showToast('Kontak layanan gagal disimpan.', true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan';
  }
}

function editKontak(id) {
  const k = _kontakMap[id];
  if (!k) return;
  document.getElementById('kk-id').value      = k.id;
  document.getElementById('kk-nama').value    = k.nama_layanan || '';
  document.getElementById('kk-petugas').value = k.petugas || '';
  document.getElementById('kk-telepon').value = k.telepon || '';
  document.getElementById('kk-lokasi').value  = k.lokasi || '';
  document.getElementById('kk-jam').value     = k.jam_layanan || '';
  document.getElementById('kk-jenis').value   = k.jenis || 'emergency';
  document.getElementById('kk-ikon').value    = k.ikon || 'fa-kit-medical';
  document.getElementById('kk-urutan').value  = k.urutan || 1;
  document.getElementById('kontak-form-title').textContent = 'Edit kontak layanan';
  document.getElementById('panel-kesehatan').scrollIntoView({ behavior:'smooth' });
}

function konfirmasiHapusKontak(id) {
  const k = _kontakMap[id];
  openConfirm('Hapus kontak ini?', `"${k?.nama_layanan}" akan dihapus permanen.`,
    'Hapus', () => hapusKontak(id));
}
async function hapusKontak(id) {
  const hasil = await hapusBaris('kontak_kesehatan', id);
  if (!hasil.ok) { showToast(hasil.pesan, true); return; }
  showToast('Kontak dihapus'); loadKontakKesehatan();
}

function resetKontakForm() {
  ['kk-id','kk-nama','kk-petugas','kk-telepon','kk-lokasi','kk-jam'].forEach(i => {
    const el = document.getElementById(i); if (el) el.value = '';
  });
  document.getElementById('kk-jenis').value  = 'emergency';
  document.getElementById('kk-ikon').value   = 'fa-kit-medical';
  document.getElementById('kk-urutan').value = 1;
  document.getElementById('kontak-form-title').textContent = 'Tambah / edit kontak layanan';
}

function enhanceAdminAccessibility(root = document) {
  root.querySelectorAll('button:not([type])').forEach(button => button.setAttribute('type', 'button'));
  root.querySelectorAll('label:not([for])').forEach(label => {
    const control = label.parentElement?.querySelector('input[id], select[id], textarea[id]');
    if (control) label.htmlFor = control.id;
  });
  root.querySelectorAll('button.icon-btn:not([aria-label])').forEach(button => {
    const label = button.getAttribute('title') || button.textContent.trim() || 'Tombol aksi';
    button.setAttribute('aria-label', label);
  });
  root.querySelectorAll('img:not([alt])').forEach(image => image.setAttribute('alt', ''));
}

document.addEventListener('DOMContentLoaded', () => {
  enhanceAdminAccessibility();
  const observer = new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) enhanceAdminAccessibility(node);
    }));
  });
  observer.observe(document.body, { childList:true, subtree:true });
});

window.addEventListener('unhandledrejection', event => {
  console.error('Operasi asynchronous panel admin gagal:', event.reason);
  event.preventDefault();
  showToast('Operasi belum dapat diselesaikan. Silakan coba lagi.', true);
});
