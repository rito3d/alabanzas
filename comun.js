// =============================================================
//  Funciones compartidas: acordes, secciones, transposición, API
// =============================================================
// Si la sesión venció o no hay clave, se vuelve a la página de entrada
function irALogin() { location.href = '/login?volver=' + encodeURIComponent(location.pathname); }
async function respuesta(r) {
  if (r.status === 401) { irALogin(); throw new Error('Debes entrar con la clave'); }
  let j = {}; try { j = await r.json(); } catch {}
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}
var API = {
  async get(url) { return respuesta(await fetch(url, { cache: 'no-store' })); },
  async post(url, datos) {
    return respuesta(await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) }));
  },
  async borrar(url) { return respuesta(await fetch(url, { method: 'DELETE' })); },
  canciones() { return this.get('/api/canciones'); },
  estado() { return this.get('/api/estado'); },
  cambiarEstado(c) { return this.post('/api/estado', c); },
  guardarCancion(c) { return this.post('/api/canciones', c); },
  borrarCancion(id) { return this.borrar('/api/canciones/' + id); },
  fondos() { return this.get('/api/fondos'); },
  programa() { return this.get('/api/programa'); },
  guardarCulto(c) { return this.post('/api/cultos', c); },
  borrarCulto(id) { return this.borrar('/api/cultos/' + id); },
  guardarTurno(t) { return this.post('/api/turnos', t); },
  borrarTurno(id) { return this.borrar('/api/turnos/' + id); },
  guardarParticipacion(x) { return this.post('/api/participaciones', x); },
  borrarParticipacion(id) { return this.borrar('/api/participaciones/' + id); }
};

// ---------- Hermanos y funciones ----------
const ROLES = ['Dirige la alabanza', 'Canta', 'Coros', 'Guitarra', 'Guitarra eléctrica', 'Bajo', 'Piano / Teclado', 'Batería', 'Percusión', 'Violín', 'Sonido', 'Pantalla LED'];
// todos los nombres que aparecen en la app, sin repetir (sin importar mayúsculas o tildes)
function nombresHermanos(canciones, prog) {
  const m = new Map();
  const add = n => { n = String(n || '').trim(); if (n && !m.has(normalizar(n))) m.set(normalizar(n), n); };
  (canciones || []).forEach(c => add(c.cantante));
  ((prog && prog.turnos) || []).forEach(t => add(t.cantante));
  ((prog && prog.participaciones) || []).forEach(x => add(x.nombre));
  return [...m.values()].sort((a, b) => a.localeCompare(b, 'es'));
}
const mismoNombre = (a, b) => !!a && !!b && normalizar(a).trim() === normalizar(b).trim();
function participacionesDe(prog, cultoId) { return ((prog && prog.participaciones) || []).filter(x => x.cultoId === cultoId); }

// ---------- Tonos ----------
// semitonos para pasar del tono "de" al tono "a" (ej. G → A = +2). null si no se entiende.
function semitonos(de, a) {
  const m1 = RE_ACORDE.exec(String(de || '').trim()), m2 = RE_ACORDE.exec(String(a || '').trim());
  if (!m1 || !m2) return null;
  const v1 = VALOR_NOTA[m1[1] + m1[2]], v2 = VALOR_NOTA[m2[1] + m2[2]];
  if (v1 === undefined || v2 === undefined) return null;
  let d = ((v2 - v1) % 12 + 12) % 12; if (d > 6) d -= 12;
  return d;
}
// el tono que tiene que usar este turno; si no tiene, el último tono que ese hermano usó con esa alabanza, o el original
function tonoSugerido(prog, cancion, cantante) {
  const previos = ((prog && prog.turnos) || []).filter(t => t.cancionId === cancion.id && t.tono && mismoNombre(t.cantante, cantante))
    .sort((a, b) => String(b.actualizada).localeCompare(String(a.actualizada)));
  return previos.length ? previos[0].tono : (cancion.tono || '');
}
const tonoTurno = (t, c) => (t && t.tono) || (c && c.tono) || '';

// ---------- Cultos por fecha ----------
function hoyISO() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function fechaBonita(f, corta) {
  if (!f) return '';
  const d = new Date(f + 'T12:00:00');
  let t = d.toLocaleDateString('es', corta ? { weekday: 'short', day: 'numeric', month: 'short' } : { weekday: 'long', day: 'numeric', month: 'long' });
  t = t.charAt(0).toUpperCase() + t.slice(1);
  const hoy = hoyISO();
  const man = new Date(Date.now() + 864e5); const manISO = man.getFullYear() + '-' + String(man.getMonth() + 1).padStart(2, '0') + '-' + String(man.getDate()).padStart(2, '0');
  return f === hoy ? 'Hoy · ' + t : f === manISO ? 'Mañana · ' + t : t;
}
const nombreCulto = c => c ? `${fechaBonita(c.fecha)} — ${c.nombre}` : '';
// próximos (desde hoy) ordenados; los pasados al final, del más reciente al más antiguo
function cultosOrdenados(prog) {
  const hoy = hoyISO(), l = (prog && prog.cultos) || [];
  return { proximos: l.filter(c => c.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha)), pasados: l.filter(c => c.fecha < hoy).sort((a, b) => b.fecha.localeCompare(a.fecha)) };
}
// el culto de hoy; si no hay, el próximo; si no, el último que hubo
function cultoDeHoy(prog) { const o = cultosOrdenados(prog); return o.proximos[0] || o.pasados[0] || null; }
// Cada culto se divide en Adoración y Coros. "primero" dice qué parte va antes; las que no tienen parte van al final.
const TIPOS = { adoracion: { nombre: 'Adoración', icono: '🙏' }, coros: { nombre: 'Coros', icono: '🎉' } };
function ordenTipos(cu) { return cu && cu.primero === 'coros' ? ['coros', 'adoracion', ''] : ['adoracion', 'coros', '']; }
function turnosDe(prog, cultoId) {
  const cu = ((prog && prog.cultos) || []).find(c => c.id === cultoId);
  const rango = ordenTipos(cu), r = t => { const i = rango.indexOf(t.tipo || ''); return i < 0 ? 2 : i; };
  return ((prog && prog.turnos) || []).filter(t => t.cultoId === cultoId).sort((a, b) => r(a) - r(b) || a.orden - b.orden);
}
// mover una alabanza arriba/abajo dentro de su parte (Adoración o Coros). Devuelve los turnos con su nuevo "orden".
function moverTurno(lista, turnoId, dir) {
  const i = lista.findIndex(t => t.id === turnoId), j = i + dir;
  if (i < 0 || j < 0 || j >= lista.length || (lista[j].tipo || '') !== (lista[i].tipo || '')) return [];
  const nueva = lista.slice(); [nueva[i], nueva[j]] = [nueva[j], nueva[i]];
  const base = Date.now();
  return nueva.map((t, k) => ({ ...t, orden: base + k }));
}
// agrupa la lista ya ordenada en partes, para pintar encabezados
function partesDe(lista) {
  const partes = [];
  for (const t of lista) { const k = t.tipo || ''; if (!partes.length || partes[partes.length - 1].tipo !== k) partes.push({ tipo: k, turnos: [] }); partes[partes.length - 1].turnos.push(t); }
  return partes;
}
const nombreTipo = k => k && TIPOS[k] ? TIPOS[k].icono + ' ' + TIPOS[k].nombre : '• Sin clasificar';

// Conexión en vivo con reconexión automática
function escucharEventos(manejadores) {
  let es;
  const conectar = () => {
    es = new EventSource('/eventos');
    for (const [tipo, fn] of Object.entries(manejadores)) if (tipo !== 'conexion')
      es.addEventListener(tipo, e => fn(JSON.parse(e.data)));
    es.onopen = () => manejadores.conexion && manejadores.conexion(true);
    es.onerror = () => {
      manejadores.conexion && manejadores.conexion(false); es.close();
      fetch('/api/info', { cache: 'no-store' }).then(r => { if (r.status === 401) irALogin(); }).catch(() => {});
      setTimeout(conectar, 3000);
    };
  };
  conectar();
}

// ---------- Acordes ----------
const NOTAS_EN = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const NOTAS_ES = ['Do', 'Do#', 'Re', 'Mib', 'Mi', 'Fa', 'Fa#', 'Sol', 'Lab', 'La', 'Sib', 'Si'];
const VALOR_NOTA = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4, 'E#': 5, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11, 'B#': 0,
  Do: 0, 'Do#': 1, Reb: 1, Re: 2, 'Re#': 3, Mib: 3, Mi: 4, Fa: 5, 'Fa#': 6, Solb: 6, Sol: 7, 'Sol#': 8, Lab: 8, La: 9, 'La#': 10, Sib: 10, Si: 11
};
const RAIZ = '(Do|Re|Mi|Fa|Sol|La|Si|[A-G])([#b]?)';
const RE_ACORDE = new RegExp('^' + RAIZ + '((?:maj|min|dim|aug|sus|add|m|M|°|º|\\+|-)?[0-9]*(?:(?:sus|add|maj|b|#)?[0-9]+)*(?:\\([^)]*\\))?)(?:\\/' + RAIZ + ')?$');

function esAcorde(t) { return RE_ACORDE.test(t); }

// Una línea es de acordes si TODAS sus palabras son acordes (o separadores como | - x2)
function esLineaAcordes(linea) {
  const tokens = linea.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  let acordes = 0;
  for (const t of tokens) {
    if (/^(\||-|\/|x\d+|\(x\d+\)|%)$/i.test(t)) continue;
    if (!esAcorde(t)) return false;
    acordes++;
  }
  return acordes > 0;
}

function transponerNota(raiz, alt, pasos, latino) {
  const v = VALOR_NOTA[raiz + alt];
  if (v === undefined) return raiz + alt;
  const n = ((v + pasos) % 12 + 12) % 12;
  return (latino ? NOTAS_ES : NOTAS_EN)[n];
}
function transponerAcorde(acorde, pasos, aLatino) {
  if (!pasos && aLatino === undefined) return acorde;
  const m = RE_ACORDE.exec(acorde);
  if (!m) return acorde;
  const latino = aLatino !== undefined ? aLatino : /^(Do|Re|Mi|Fa|Sol|La|Si)/.test(m[1]);
  let r = transponerNota(m[1], m[2], pasos, latino) + m[3];
  if (m[4]) r += '/' + transponerNota(m[4], m[5], pasos, latino);
  return r;
}
// Transpone una línea de acordes manteniendo las columnas
function transponerLineaAcordes(linea, pasos, aLatino) {
  let salida = '';
  const re = /\S+/g; let m;
  while ((m = re.exec(linea))) {
    const nuevo = esAcorde(m[0]) ? transponerAcorde(m[0], pasos, aLatino) : m[0];
    let col = m.index;
    if (salida.length > col) col = salida.length + (salida.length ? 1 : 0);
    salida = salida.padEnd(col, ' ') + nuevo;
  }
  return salida;
}

// ---------- Secciones ----------
// Etiquetas: "Coro:", "[Coro]", "Verso 1:", "Puente:", "Intro:", etc.
const RE_ETIQUETA = /^\s*(?:\[([^\]]+)\]|((?:intro|verso|estrofa|coro|pre-?coro|precoro|puente|final|outro|interludio|instrumental|tag|solo|vamp|refr[aá]n)[^:]{0,20}):)\s*$/i;

function etiquetaDe(linea) {
  const m = RE_ETIQUETA.exec(linea);
  if (!m) return null;
  const t = (m[1] || m[2]).trim();
  if (m[1] && esLineaAcordes(t.replace(/\]\s*\[/g, ' '))) return null; // "[G]" es acorde, no etiqueta
  return t;
}

// Convierte "[G]Cristo [D]vive" en {acordes:'G     D', letra:'Cristo vive'}
function separarEnLinea(linea) {
  if (!/\[[^\]]+\]/.test(linea)) return null;
  let letra = '', acordes = '';
  const partes = linea.split(/(\[[^\]]+\])/);
  for (const p of partes) {
    const m = /^\[([^\]]+)\]$/.exec(p);
    if (m && esAcorde(m[1].trim())) {
      let col = letra.length;
      if (acordes.length > col) col = acordes.length + 1;
      acordes = acordes.padEnd(col, ' ') + m[1].trim();
      if (letra.length < col) letra = letra.padEnd(col, ' ');
    } else letra += p;
  }
  return { acordes, letra };
}

/**
 * Analiza la letra completa y devuelve secciones:
 * [{ etiqueta, lineas:[{acordes, letra}] }]
 * Cada bloque separado por una línea en blanco = una diapositiva.
 */
function analizarLetra(texto) {
  const secciones = [];
  let actual = null;
  const nueva = (etq) => { actual = { etiqueta: etq || '', lineas: [] }; secciones.push(actual); };
  const lineas = String(texto || '').replace(/\r\n/g, '\n').split('\n');
  let acordesPendientes = null;
  for (const linea of lineas) {
    if (!linea.trim()) {
      if (acordesPendientes !== null && actual) actual.lineas.push({ acordes: acordesPendientes, letra: '' });
      acordesPendientes = null;
      if (actual && actual.lineas.length) actual = null;
      continue;
    }
    const etq = etiquetaDe(linea);
    if (etq) {
      if (acordesPendientes !== null && actual) actual.lineas.push({ acordes: acordesPendientes, letra: '' });
      acordesPendientes = null;
      nueva(etq); continue;
    }
    if (!actual) nueva('');
    if (esLineaAcordes(linea)) {
      if (acordesPendientes !== null) actual.lineas.push({ acordes: acordesPendientes, letra: '' });
      acordesPendientes = linea.replace(/\s+$/, '');
      continue;
    }
    const enLinea = separarEnLinea(linea);
    if (enLinea) { actual.lineas.push(enLinea); acordesPendientes = null; continue; }
    actual.lineas.push({ acordes: acordesPendientes || '', letra: linea.replace(/\s+$/, '') });
    acordesPendientes = null;
  }
  if (acordesPendientes !== null && actual) actual.lineas.push({ acordes: acordesPendientes, letra: '' });
  return secciones.filter(s => s.lineas.length);
}

// Diapositivas para la LED: solo letra, sin acordes
function diapositivas(cancion) {
  return analizarLetra(cancion && cancion.letra)
    .map(s => ({ etiqueta: s.etiqueta, texto: s.lineas.map(l => l.letra.trim()).filter(Boolean) }))
    .filter(d => d.texto.length);
}

// HTML de una sección con acordes encima (vista de músicos)
function htmlSeccionAcordes(sec, pasos, aLatino) {
  const esc = escaparHTML;
  let h = '';
  if (sec.etiqueta) h += `<div class="etq">${esc(sec.etiqueta)}</div>`;
  for (const l of sec.lineas) {
    if (l.acordes) h += `<div class="acordes">${esc(transponerLineaAcordes(l.acordes, pasos, aLatino))}</div>`;
    if (l.letra) h += `<div class="letra">${esc(l.letra)}</div>`;
  }
  return h;
}

function escaparHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function normalizar(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

function aviso(msg, error) {
  let t = document.getElementById('aviso');
  if (!t) { t = document.createElement('div'); t.id = 'aviso'; document.body.appendChild(t); }
  t.textContent = msg; t.className = 'visible' + (error ? ' error' : '');
  clearTimeout(t._t); t._t = setTimeout(() => t.className = '', 2600);
}
