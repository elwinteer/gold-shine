/* Almacenamiento local y utilidades. */
window.GS = window.GS || {};

GS.store = {
  get(key, def) {
    try {
      const v = localStorage.getItem('gs.' + key);
      return v == null ? def : JSON.parse(v);
    } catch (e) {
      return def;
    }
  },
  set(key, val) {
    try {
      localStorage.setItem('gs.' + key, JSON.stringify(val));
      return true;
    } catch (e) {
      return false;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem('gs.' + key);
    } catch (e) {}
  }
};

GS.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

GS.todayISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

GS.fmtNum = (n) =>
  Math.round(Number(n) || 0)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

GS.money = (n) => '$' + GS.fmtNum(n);

GS.parseMoney = (s) => parseInt(String(s == null ? '' : s).replace(/\D/g, ''), 10) || 0;

GS.fmtDate = (iso) => (iso ? String(iso).split('-').reverse().join('/') : '');

GS.esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/* Cálculo del total de un presupuesto. */
GS.computeTotal = (b) => {
  let sum = 0;
  let anyDesde = false;
  let included = 0;
  (b.items || []).forEach((it) => {
    if (it.include) {
      included++;
      sum += (Number(it.price) || 0) * (Number(it.qty) || 1);
      if (it.desde) anyDesde = true;
    }
  });
  const total = b.totalManual ? Number(b.totalValue) || 0 : sum;
  const showDesde = b.totalDesde == null ? !b.totalManual && anyDesde : !!b.totalDesde;
  return { sum, total, showDesde, included, show: total > 0 };
};

GS.itemSubtotal = (it) => (Number(it.price) || 0) * (Number(it.qty) || 1);

/* Normaliza un teléfono para wa.me (Argentina por defecto). */
GS.waPhone = (raw) => {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('54')) return d;
  d = d.replace(/^0+/, '');
  return '549' + d;
};

GS.fileSafe = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

/* Recursos embebidos (solo en la versión de una sola página). */
GS.assetURL = (path) => {
  const e = GS.embedded && GS.embedded[path];
  return e ? 'data:' + e.mime + ';base64,' + e.b64 : path;
};
GS.assetBytes = (path) => {
  const bin = atob(GS.embedded[path].b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
