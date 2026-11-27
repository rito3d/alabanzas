// =============================================================
//  Conexión de la app de los hermanos con la nube (Firebase)
//  Reemplaza la API local por Firestore, en tiempo real.
// =============================================================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, onSnapshot, setDoc, getDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const local = {
  leer(k) { try { return localStorage.getItem(k); } catch { return null; } },
  poner(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} }
};

// ---------- pantalla para escribir el código del grupo ----------
function pedirCodigo(error) {
  return new Promise(ok => {
    const capa = document.createElement('div');
    capa.style.cssText = 'position:fixed;inset:0;z-index:200;background:var(--fondo);display:flex;align-items:center;justify-content:center;padding:20px';
    capa.innerHTML = `<form style="width:100%;max-width:380px;text-align:center">
      <img src="icono.svg" style="width:76px;height:76px;margin-bottom:8px" alt="">
      <h1 style="margin:0 0 6px;font-size:24px">Alabanzas MMM</h1>
      <p class="tenue" style="margin:0 0 20px;line-height:1.45">Abre el enlace que te mandaron por WhatsApp,<br>o pega aquí el enlace o el código del grupo.</p>
      <input id="cg" placeholder="Enlace o código" autocomplete="off" style="text-align:center;margin-bottom:12px">
      <button class="prim" style="width:100%;padding:14px;font-size:17px">Entrar</button>
      <div style="color:var(--peligro);min-height:22px;margin-top:12px">${error || ''}</div></form>`;
    document.body.appendChild(capa);
    capa.querySelector('form').onsubmit = e => {
      e.preventDefault();
      const v = capa.querySelector('#cg').value.trim();
      const c = v.includes('#') ? v.split('#').pop() : v;
      if (c.length < 20) { capa.querySelector('div:last-child').textContent = 'Ese código no es válido'; return; }
      capa.remove(); ok(c.trim());
    };
  });
}

function obtenerCodigoDeEnlace() {
  const h = decodeURIComponent(location.hash.slice(1)).trim();
  if (h.length >= 20 && h !== 'salir') {
    local.poner('codigoGrupo', h);
    history.replaceState(null, '', location.pathname + location.search);
  }
  return local.leer('codigoGrupo');
}

// ---------- arranque ----------
if (typeof firebaseConfig === 'undefined' || !firebaseConfig.apiKey) {
  document.body.innerHTML = '<div style="padding:30px;text-align:center;font-family:system-ui;color:#eee">Falta configurar <b>config.js</b> con los datos de Firebase (ver LEEME.txt).</div>';
  throw new Error('Falta config.js');
}
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });

await new Promise(ok => { const fin = onAuthStateChanged(auth, u => { if (u) { fin(); ok(); } }); signInAnonymously(auth).catch(() => ok()); });

let codigo = obtenerCodigoDeEnlace();
for (let intento = 0; ; intento++) {
  if (!codigo) codigo = await pedirCodigo(intento ? 'Código incorrecto. Revisa el enlace del grupo.' : '');
  try {
    const info = await getDoc(doc(db, 'grupos', codigo, 'estado', 'info'));
    if (info.exists()) { local.poner('codigoGrupo', codigo); break; }
    local.poner('codigoGrupo', null); codigo = null;
  } catch (e) {
    // sin internet: si ya habíamos entrado antes con este código, seguimos con lo guardado
    if (local.leer('codigoGrupo') === codigo) break;
    codigo = null;
  }
}

const colCanciones = collection(db, 'grupos', codigo, 'canciones');
const docCulto = doc(db, 'grupos', codigo, 'estado', 'culto');
const docEnVivo = doc(db, 'grupos', codigo, 'estado', 'envivo');

let canciones = [], todas = new Map(), estado = { listaCulto: [], cancionId: null, seccion: 0 };
const oyentes = [];
const disparar = (tipo, datos) => { for (const m of oyentes) if (m[tipo]) { try { m[tipo](datos); } catch (e) { console.error(e); } } };
const fallo = e => { console.error(e); window.aviso && aviso('No se pudo guardar en la nube: ' + (e.code || e.message), true); };

let listoCanciones;
const primeraCarga = new Promise(ok => listoCanciones = ok);
onSnapshot(colCanciones, { includeMetadataChanges: true }, snap => {
  todas = new Map(snap.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
  canciones = [...todas.values()].filter(c => !c.borrada).map(({ sello, borrada, ...c }) => c);
  listoCanciones();
  disparar('canciones', {});
  disparar('conexion', !snap.metadata.fromCache);
}, e => { console.error(e); listoCanciones(); disparar('conexion', false); });

onSnapshot(docCulto, s => {
  const d = s.data() || {};
  estado.listaCulto = Array.isArray(d.lista) ? d.lista : [];
  disparar('estado', { ...estado });
});
onSnapshot(docEnVivo, s => {
  const d = s.data() || {};
  estado.cancionId = d.cancionId || null; estado.seccion = +d.seccion || 0;
  disparar('estado', { ...estado });
});
window.addEventListener('online', () => disparar('conexion', true));
window.addEventListener('offline', () => disparar('conexion', false));

// ---------- misma API que la versión de la PC ----------
const limpiar = c => ({
  titulo: String(c.titulo || '').trim().slice(0, 150), cantante: String(c.cantante || '').trim().slice(0, 80),
  tono: String(c.tono || '').trim().slice(0, 12), autor: String(c.autor || '').trim().slice(0, 100),
  letra: String(c.letra || '').replace(/\r\n/g, '\n').slice(0, 30000), notas: String(c.notas || '').trim().slice(0, 500)
});
function guardarCulto(lista) {
  estado.listaCulto = lista;
  // no se espera a la nube: si no hay internet, se guarda en el celular y se sube después
  setDoc(docCulto, { lista, actualizada: new Date().toISOString(), sello: serverTimestamp() }).catch(fallo);
  disparar('estado', { ...estado });
  return { ...estado };
}

window.API = {
  async canciones() { await primeraCarga; return canciones.slice(); },
  async estado() { return { ...estado }; },
  async cambiarEstado(c) {
    if (!('listaCulto' in c)) throw new Error('Solo se puede cambiar desde la PC de la iglesia');
    const lista = (c.listaCulto || []).filter((id, i, a) => a.indexOf(id) === i && canciones.some(x => x.id === id));
    return guardarCulto(lista);
  },
  async guardarCancion(c) {
    const datos = limpiar(c);
    if (!datos.titulo) throw new Error('Falta el título');
    const ref = c.id ? doc(colCanciones, c.id) : doc(colCanciones);
    const antes = todas.get(ref.id);
    const ahora = new Date().toISOString();
    const completo = { ...datos, creada: (antes && antes.creada) || ahora, actualizada: ahora, borrada: false };
    setDoc(ref, { ...completo, sello: serverTimestamp() }).catch(fallo);
    // se muestra al instante, aunque la nube todavía no haya respondido
    todas.set(ref.id, { id: ref.id, ...completo });
    canciones = [...todas.values()].filter(x => !x.borrada).map(({ sello, borrada, ...x }) => x);
    return { id: ref.id, ...completo };
  },
  async borrarCancion(id) {
    const antes = todas.get(id);
    if (!antes) return { ok: false };
    const { sello, id: _id, ...resto } = antes;
    setDoc(doc(colCanciones, id), { ...resto, borrada: true, actualizada: new Date().toISOString(), sello: serverTimestamp() }).catch(fallo);
    if (estado.listaCulto.includes(id)) guardarCulto(estado.listaCulto.filter(x => x !== id));
    return { ok: true };
  },
  async get() { return {}; }
};

window.escucharEventos = m => { oyentes.push(m); m.conexion && m.conexion(navigator.onLine); m.estado && m.estado({ ...estado }); };
window.irALogin = () => {};

// "Cerrar sesión" = olvidar el código del grupo en este celular
document.addEventListener('click', e => {
  const a = e.target.closest('a[href="#salir"]');
  if (!a) return;
  e.preventDefault();
  if (confirm('¿Salir del grupo en este celular? Tendrás que volver a abrir el enlace del grupo.')) {
    local.poner('codigoGrupo', null); location.reload();
  }
});
