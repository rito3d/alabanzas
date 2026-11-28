// =============================================================
//  Biblia Reina-Valera 1909 (dominio público)
//  El archivo biblia-rv1909.json se baja la primera vez que se abre
//  la Biblia y queda guardado en el teléfono (funciona sin internet).
// =============================================================
let _biblia = null, _cargando = null;
function cargarBiblia() {
  if (_biblia) return Promise.resolve(_biblia);
  if (!_cargando) _cargando = fetch('biblia-rv1909.json').then(r => { if (!r.ok) throw new Error('No se pudo bajar la Biblia'); return r.json(); })
    .then(b => (_biblia = b)).catch(e => { _cargando = null; throw e; });
  return _cargando;
}

// abreviaturas comunes → número de libro (0 = Génesis)
const ABREV_BIBLIA = {
  gn: 0, gen: 0, ex: 1, exo: 1, lv: 2, lev: 2, nm: 3, num: 3, dt: 4, deut: 4, jos: 5, jue: 6, jc: 6, rt: 7,
  '1s': 8, '1sam': 8, '2s': 9, '2sam': 9, '1r': 10, '1re': 10, '2r': 11, '2re': 11, '1cr': 12, '2cr': 13, esd: 14, neh: 15, est: 16,
  sal: 18, salmo: 18, sl: 18, pr: 19, prov: 19, ec: 20, ecl: 20, cnt: 21, cantares: 21, is: 22, isa: 22, jer: 23, lm: 24, lam: 24, ez: 25, eze: 25, dn: 26, dan: 26,
  os: 27, jl: 28, am: 29, abd: 30, jon: 31, mi: 32, miq: 32, nah: 33, hab: 34, sof: 35, hag: 36, zac: 37, mal: 38,
  mt: 39, mat: 39, mr: 40, mc: 40, mar: 40, lc: 41, luc: 41, jn: 42, hch: 43, hech: 43, ro: 44, rom: 44, '1co': 45, '1cor': 45, '2co': 46, '2cor': 46,
  ga: 47, gal: 47, ef: 48, efe: 48, fil: 49, flp: 49, col: 50, '1ts': 51, '1tes': 51, '2ts': 52, '2tes': 52, '1ti': 53, '1tim': 53, '2ti': 54, '2tim': 54,
  tit: 55, flm: 56, he: 57, heb: 57, stg: 58, sant: 58, '1p': 59, '1pe': 59, '1ped': 59, '2p': 60, '2pe': 60, '2ped': 60, '1jn': 61, '2jn': 62, '3jn': 63, jud: 64, ap: 65, apoc: 65
};
function libroDe(biblia, texto) {
  const q = normalizar(texto).replace(/[\s.]/g, '');
  if (!q) return -1;
  if (q in ABREV_BIBLIA) return ABREV_BIBLIA[q];
  const nombres = biblia.map(l => normalizar(l.n).replace(/\s/g, ''));
  let i = nombres.indexOf(q);
  if (i < 0) i = nombres.findIndex(n => n.startsWith(q));
  return i;
}
// "Juan 3:16-18", "sal 23", "1 co 13:4-7", "Romanos 8 28" → { libro, cap, desde, hasta }
function leerCita(biblia, texto) {
  const m = /^\s*([123]?\s*[^\d:]+?)\s*(\d+)(?:\s*[:.,\s]\s*(\d+)(?:\s*-\s*(\d+))?)?\s*$/.exec(String(texto || ''));
  if (!m) return null;
  const libro = libroDe(biblia, m[1]);
  if (libro < 0) return null;
  const caps = biblia[libro].c, cap = +m[2];
  if (cap < 1 || cap > caps.length) return null;
  const total = caps[cap - 1].length;
  let desde = m[3] ? +m[3] : 1, hasta = m[4] ? +m[4] : (m[3] ? desde : total);
  desde = Math.max(1, Math.min(desde, total)); hasta = Math.max(desde, Math.min(hasta, total));
  return { libro, cap, desde, hasta };
}
function textoCita(biblia, c) {
  const vs = biblia[c.libro].c[c.cap - 1];
  const out = [];
  for (let v = c.desde; v <= c.hasta; v++) out.push({ v, t: vs[v - 1] });
  return out;
}
const nombreCita = (biblia, c) => `${biblia[c.libro].n} ${c.cap}` + (c.desde === 1 && c.hasta === biblia[c.libro].c[c.cap - 1].length ? '' : `:${c.desde}${c.hasta > c.desde ? '-' + c.hasta : ''}`);
// buscar palabras en toda la Biblia (máximo "max" resultados)
function buscarEnBiblia(biblia, texto, max = 60) {
  const palabras = normalizar(texto).split(/\s+/).filter(w => w.length > 1);
  if (!palabras.length) return [];
  const res = [];
  for (let l = 0; l < biblia.length && res.length < max; l++)
    for (let c = 0; c < biblia[l].c.length && res.length < max; c++)
      for (let v = 0; v < biblia[l].c[c].length && res.length < max; v++) {
        const t = normalizar(biblia[l].c[c][v]);
        if (palabras.every(p => t.includes(p))) res.push({ libro: l, cap: c + 1, desde: v + 1, hasta: v + 1 });
      }
  return res;
}
