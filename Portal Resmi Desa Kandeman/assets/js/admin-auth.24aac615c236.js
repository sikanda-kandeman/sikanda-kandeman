(() => {
  'use strict';

  const bootScript = document.currentScript || document.querySelector('script[data-app-src]');
  const appScriptSrc = bootScript?.dataset.appSrc || '';
  const appCssSrc = bootScript?.dataset.appCss || '';
  const sb = window.sb;

  let loginAttempts = 0;
  let loginLockUntil = 0;
  let dashboardLoaded = false;

  const byId = id => document.getElementById(id);

  function setView(view) {
    byId('login-screen').hidden = view !== 'login';
  }

  function showError(id, message) {
    const element = byId(id);
    if (!element) return;
    element.textContent = message;
    element.style.display = message ? 'block' : 'none';
  }

  function setButtonLoading(button, loading, loadingText, idleText) {
    if (!button) return;
    button.disabled = loading;
    const text = button.querySelector('span');
    if (text) text.textContent = loading ? loadingText : idleText;
    button.setAttribute('aria-busy', String(loading));
  }

  async function signOutAndReset(message = '') {
    try { await sb?.auth?.signOut(); } catch (error) { console.error('Logout gagal:', error); }
    if (dashboardLoaded) {
      if (message) sessionStorage.setItem('sikanda-admin-login-message', message);
      window.location.reload();
      return;
    }
    byId('login-form')?.reset();
    showError('login-error', message);
    setView('login');
    byId('login-email')?.focus();
  }

  async function getVerifiedAdminProfile(userId) {
    if (!userId) return null;
    const { data, error } = await sb
      .from('profiles')
      .select('id,role')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    return data?.role === 'admin' ? data : null;
  }

  async function requireVerifiedAdmin(user) {
    try {
      const profile = await getVerifiedAdminProfile(user?.id);
      if (profile) return true;
    } catch (error) {
      console.error('Gagal memverifikasi role admin:', error);
      await signOutAndReset('Role admin belum dapat diverifikasi. Periksa koneksi lalu masuk kembali.');
      return false;
    }
    await signOutAndReset('Akun ini tidak memiliki akses admin yang terverifikasi.');
    return false;
  }

  function loadStylesheet(source) {
    if (!source) return Promise.reject(new Error('Lokasi CSS dashboard tidak tersedia.'));
    if (document.querySelector(`link[href="${source}"]`)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = source;
      link.onload = resolve;
      link.onerror = () => reject(new Error('CSS dashboard gagal dimuat.'));
      document.head.appendChild(link);
    });
  }

  function loadScript(source) {
    if (!source) return Promise.reject(new Error('Lokasi JavaScript dashboard tidak tersedia.'));
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = source;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('JavaScript dashboard gagal dimuat.'));
      document.body.appendChild(script);
    });
  }

  async function loadDashboard(user) {
    if (dashboardLoaded) return;
    dashboardLoaded = true;
    try {
      await loadStylesheet(appCssSrc);
      const template = byId('admin-template');
      if (!template?.content) throw new Error('Template dashboard tidak tersedia.');
      template.replaceWith(template.content.cloneNode(true));
      await loadScript(appScriptSrc);
      if (!window.SikandaAdminApp?.start) throw new Error('Inisialisasi dashboard tidak tersedia.');
      await window.SikandaAdminApp.start(user);
      setView('dashboard');
    } catch (error) {
      dashboardLoaded = false;
      console.error('Dashboard gagal dimuat:', error);
      sessionStorage.setItem('sikanda-admin-login-message', 'Dashboard belum dapat dimuat. Silakan masuk kembali.');
      try { await sb.auth.signOut(); } catch (_) {}
      window.location.reload();
    }
  }

  async function openVerifiedAdminSession() {
    const { data: { user }, error } = await sb.auth.getUser();
    if (error) throw error;
    if (!user) throw new Error('Sesi admin tidak tersedia.');
    if (await requireVerifiedAdmin(user)) await loadDashboard(user);
  }

  async function handleLogin(event) {
    event.preventDefault();
    if (!sb?.auth) {
      showError('login-error', 'Layanan autentikasi belum dapat dimuat. Muat ulang halaman.');
      return;
    }
    if (!event.currentTarget.reportValidity()) return;

    const now = Date.now();
    if (now < loginLockUntil) {
      const seconds = Math.ceil((loginLockUntil - now) / 1000);
      showError('login-error', `Terlalu banyak percobaan. Coba lagi dalam ${seconds} detik.`);
      return;
    }

    const email = byId('login-email').value.trim();
    const password = byId('login-pass').value;
    const button = byId('login-btn');
    showError('login-error', '');
    setButtonLoading(button, true, 'Memverifikasi...', 'Masuk ke Panel Admin');

    try {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        loginAttempts += 1;
        byId('login-pass').value = '';
        if (loginAttempts >= 5) {
          loginLockUntil = Date.now() + 60_000;
          loginAttempts = 0;
          showError('login-error', 'Terlalu banyak percobaan. Login dikunci selama 60 detik.');
        } else {
          showError('login-error', `Email atau password salah. ${5 - loginAttempts} percobaan tersisa.`);
        }
        return;
      }
      loginAttempts = 0;
      await openVerifiedAdminSession();
    } catch (error) {
      console.error('Proses login gagal:', error);
      showError('login-error', 'Login belum dapat diproses. Silakan coba lagi.');
    } finally {
      setButtonLoading(button, false, 'Memverifikasi...', 'Masuk ke Panel Admin');
    }
  }

  function togglePassword(button) {
    const input = byId(button.dataset.passwordToggle);
    if (!input) return;
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    button.setAttribute('aria-pressed', String(!showing));
    button.setAttribute('aria-label', showing
      ? button.getAttribute('aria-label').replace('Sembunyikan', 'Tampilkan')
      : button.getAttribute('aria-label').replace('Tampilkan', 'Sembunyikan'));
    const icon = button.querySelector('i');
    if (icon) icon.className = showing ? 'fa-regular fa-eye' : 'fa-regular fa-eye-slash';
  }

  async function restoreSession() {
    if (!sb?.auth) {
      showError('login-error', 'Layanan autentikasi belum dapat dimuat. Muat ulang halaman.');
      return;
    }
    try {
      const { data: { session }, error } = await sb.auth.getSession();
      if (error) throw error;
      if (session) await openVerifiedAdminSession();
    } catch (error) {
      console.error('Pemulihan sesi gagal:', error);
      await signOutAndReset('Sesi tidak dapat dipulihkan. Silakan masuk kembali.');
    }
  }

  document.addEventListener('click', event => {
    const toggle = event.target.closest('[data-password-toggle]');
    if (toggle) togglePassword(toggle);
  });
  byId('login-form').addEventListener('submit', handleLogin);

  window.SikandaAdminAuth = Object.freeze({
    logout: message => signOutAndReset(message),
  });

  const restoredMessage = sessionStorage.getItem('sikanda-admin-login-message');
  if (restoredMessage) {
    sessionStorage.removeItem('sikanda-admin-login-message');
    showError('login-error', restoredMessage);
  }
  restoreSession();
})();
