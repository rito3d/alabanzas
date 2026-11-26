// =============================================================
//  Instalar como app (Android e iPhone)
//  - Registra el service worker (funciona sin internet).
//  - Android: muestra un botón "Instalar app".
//  - iPhone: explica cómo añadirla a la pantalla de inicio.
// =============================================================
(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  const yaInstalada = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (yaInstalada) return;

  const guardado = (k, v) => { try { return v === undefined ? localStorage.getItem(k) : localStorage.setItem(k, v); } catch { return null; } };
  if (guardado('instalar-cerrado')) return;

  const css = document.createElement('style');
  css.textContent = `
    #instalar { position: fixed; left: 10px; right: 10px; bottom: calc(10px + env(safe-area-inset-bottom)); z-index: 150;
      max-width: 520px; margin: 0 auto; background: var(--panel, #1a1f2b); border: 1px solid var(--acento, #f2b134);
      border-radius: 14px; padding: 12px 14px; display: flex; gap: 12px; align-items: center;
      box-shadow: 0 8px 30px rgba(0,0,0,.45); font-size: 15px; line-height: 1.35; }
    #instalar img { width: 44px; height: 44px; border-radius: 10px; flex: none; }
    #instalar .txt { flex: 1; }
    #instalar .x { background: none; border: 0; color: var(--tenue, #9aa4b8); font-size: 22px; padding: 4px 6px; }
    #instalar .ico-compartir { display: inline-block; vertical-align: -3px; }
  `;
  document.head.appendChild(css);

  function mostrar(html, conBoton) {
    const d = document.createElement('div');
    d.id = 'instalar';
    d.innerHTML = `<img src="iconos/icono-192.png" alt=""><div class="txt">${html}</div>` +
      (conBoton ? '<button class="prim" id="instalar-si">Instalar</button>' : '') +
      '<button class="x" id="instalar-no" aria-label="Cerrar">×</button>';
    document.body.appendChild(d);
    d.querySelector('#instalar-no').onclick = () => { guardado('instalar-cerrado', '1'); d.remove(); };
    return d;
  }

  // ---------- Android / Chrome / Edge ----------
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    const d = mostrar('<b>Instala Alabanzas</b><br><span class="tenue">Ábrela como app desde tu pantalla de inicio.</span>', true);
    d.querySelector('#instalar-si').onclick = async () => {
      d.remove();
      e.prompt();
      await e.userChoice.catch(() => {});
    };
  });

  // ---------- iPhone / iPad ----------
  const ua = navigator.userAgent;
  const esIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (esIOS) {
    const esSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|GSA|FBAN|FBAV|Instagram/.test(ua);
    const compartir = '<svg class="ico-compartir" width="16" height="18" viewBox="0 0 16 20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 13V1M4 5l4-4 4 4"/><path d="M5 8H2v11h12V8h-3"/></svg>';
    window.addEventListener('load', () => setTimeout(() => {
      mostrar(esSafari
        ? `<b>Instálala en tu iPhone</b><br><span class="tenue">Toca ${compartir} <b>Compartir</b> y luego <b>“Añadir a pantalla de inicio”</b>.</span>`
        : `<b>Para instalarla</b><br><span class="tenue">Abre este enlace en <b>Safari</b>, toca ${compartir} Compartir y “Añadir a pantalla de inicio”.</span>`);
    }, 1500));
  }
})();
