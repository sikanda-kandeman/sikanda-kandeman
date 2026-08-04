/* Konfigurasi frontend: hanya publishable key, bukan service role key. */
(() => {
  'use strict';

  const config = Object.freeze({
    url: 'https://ibzgfrmhxmxdyoevghav.supabase.co',
    publishableKey: 'sb_publishable_75voCsBIt8Xtma1_LLIGBg_SDLGJKbe',
  });

  window.SIKANDA_SUPABASE_CONFIG = config;

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('Supabase SDK gagal dimuat.');
    window.sb = null;
    return;
  }

  window.sb = window.supabase.createClient(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
})();
