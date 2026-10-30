/* Gold Shine – presupuestos. Lógica de la app. */
(function () {
  'use strict';

  const { esc, money, fmtNum, parseMoney, fmtDate, uid, store: S } = GS;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  let settings;
  let templates;
  let budgets;
  const state = { tab: 'new', budget: null, search: '', open: new Set(), pdf: null, dirty: false };

  /* ======================= datos ======================= */
  function newBudget() {
    return {
      id: uid(),
      number: null,
      date: GS.todayISO(),
      client: '',
      phone: '',
      vehicle: '',
      condition: '',
      items: [],
      notes: '',
      totalManual: false,
      totalValue: 0,
      totalDesde: null,
      closing: settings.closing,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  function load() {
    settings = Object.assign({}, GS.DEFAULT_SETTINGS, S.get('settings', {}));
    templates = S.get('templates', []);
    const seen = S.get('seenBuiltins', []);
    GS.BUILTIN_TEMPLATES.forEach((bt) => {
      if (!seen.includes(bt.id)) {
        templates.push(Object.assign({}, bt, { benefits: bt.benefits.slice() }));
        seen.push(bt.id);
      }
    });
    S.set('templates', templates);
    S.set('seenBuiltins', seen);
    budgets = S.get('budgets', []);
    const draft = S.get('draft', null);
    state.budget = draft && Array.isArray(draft.items) ? draft : newBudget();
  }

  const saveSettings = () => S.set('settings', settings);
  const saveTemplates = () => S.set('templates', templates);
  let draftTimer;
  function touch() {
    state.budget.updatedAt = Date.now();
    state.dirty = true;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => S.set('draft', state.budget), 300);
  }

  function ensureNumber(b) {
    if (!b.number) {
      b.number = (settings.prefix || '') + String(settings.nextNumber || 1).padStart(4, '0');
      settings.nextNumber = (Number(settings.nextNumber) || 1) + 1;
      saveSettings();
    }
  }

  function saveBudget(b) {
    ensureNumber(b);
    b.updatedAt = Date.now();
    const i = budgets.findIndex((x) => x.id === b.id);
    const copy = JSON.parse(JSON.stringify(b));
    if (i >= 0) budgets[i] = copy;
    else budgets.unshift(copy);
    S.set('budgets', budgets);
    S.set('draft', b);
    state.dirty = false;
  }

  const hasContent = (b) => b.items.length || b.client || b.vehicle || b.condition || b.notes;

  /* ======================= utilidades UI ======================= */
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.remove('out', 'pop');
    t.hidden = false;
    void t.offsetWidth;
    t.classList.add('pop');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => {
        if (t.classList.contains('out')) t.hidden = true;
      }, 250);
    }, 2600);
  }

  // Confirmación propia (los diálogos del navegador no funcionan en todos los entornos)
  function ask(msg, okLabel) {
    return new Promise((resolve) => {
      const box = $('#confirm');
      $('#confirm-msg').textContent = msg;
      $('#confirm-yes').textContent = okLabel || 'Aceptar';
      box.hidden = false;
      const done = (v) => {
        box.hidden = true;
        resolve(v);
      };
      $('#confirm-yes').onclick = () => done(true);
      $('#confirm-no').onclick = () => done(false);
    });
  }

  // Guardar un archivo: usa la función de la plataforma si existe, o la descarga normal
  async function saveFile(filename, data, mime) {
    let dl = null;
    try {
      dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
    } catch (e) {}
    if (dl) {
      try {
        await dl.save({ filename, data });
        return 'saved';
      } catch (err) {
        if (err && err.code === 'declined') return 'declined';
        console.warn(err);
        toast('No se pudo guardar el archivo');
        return 'error';
      }
    }
    const url = URL.createObjectURL(new Blob([data], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return 'saved';
  }

  let sheetToken = 0;
  function openSheet(html) {
    sheetToken++;
    $('#overlay').classList.remove('closing');
    $('#sheet').innerHTML = html;
    $('#overlay').hidden = false;
    $('#sheet').scrollTop = 0;
  }
  function closeSheet() {
    const ov = $('#overlay');
    state.pdf = null;
    if (ov.hidden) return;
    const token = ++sheetToken;
    ov.classList.add('closing');
    setTimeout(() => {
      if (token !== sheetToken) return;
      ov.hidden = true;
      ov.classList.remove('closing');
      $('#sheet').innerHTML = '';
    }, reduceMotion ? 0 : 230);
  }

  // Cierra un bloque con una animación de colapso suave
  function collapseOut(el) {
    return new Promise((res) => {
      if (!el || reduceMotion) return res();
      el.style.height = el.offsetHeight + 'px';
      el.style.overflow = 'hidden';
      void el.offsetWidth;
      el.classList.add('leaving');
      setTimeout(res, 330);
    });
  }

  const ic = {
    up: '<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    share: '<svg viewBox="0 0 24 24"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v13M7 8l5-5 5 5"/></svg>',
    save: '<svg viewBox="0 0 24 24"><path d="M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6"/></svg>',
    download: '<svg viewBox="0 0 24 24"><path d="M12 3v13M7 11l5 5 5-5M5 21h14"/></svg>',
    wa: '<svg viewBox="0 0 24 24"><path d="M3 21l1.6-4.7A8.5 8.5 0 1 1 8 19.6z"/><path d="M9 9.5c.4 2 2.5 4.1 5 5l1.3-1.2-1.8-1-.8.7c-.8-.4-1.5-1.1-1.9-1.9l.7-.8-1-1.8z"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  /* ======================= vistas ======================= */
  function playPage(main) {
    Array.from(main.children).forEach((c, i) => c.style.setProperty('--i', Math.min(i, 9)));
    main.classList.remove('page-in');
    void main.offsetWidth;
    main.classList.add('page-in');
  }

  function render(animate) {
    const main = $('#main');
    $('#nav').style.setProperty('--tab-i', ['new', 'history', 'templates', 'settings'].indexOf(state.tab));
    document.body.classList.toggle('has-bar', state.tab === 'new');
    $$('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === state.tab));
    if (state.tab === 'new') main.innerHTML = viewEditor();
    else if (state.tab === 'history') main.innerHTML = viewHistory();
    else if (state.tab === 'templates') main.innerHTML = viewTemplates();
    else main.innerHTML = viewSettings();
    renderBar();
    if (state.tab === 'new') {
      updateTotals();
      autoGrowAll();
    }
    if (animate !== false) playPage(main);
  }

  function setTab(tab) {
    state.tab = tab;
    render();
    window.scrollTo(0, 0);
  }

  /* ---------- editor ---------- */
  function viewEditor() {
    const b = state.budget;
    return `
    <div class="page-title">
      <h1>${b.number ? 'Presupuesto <em>' + esc(b.number) + '</em>' : 'Nuevo presupuesto'}</h1>
      <button type="button" class="btn-link" data-action="reset">Empezar de cero</button>
    </div>

    <section class="card">
      <h2>Cliente y vehículo</h2>
      <label class="f"><span>Nombre del cliente</span>
        <input type="text" data-bind="client" value="${esc(b.client)}" placeholder="Ej: Juan Pérez" autocomplete="off" autocapitalize="words"></label>
      <label class="f"><span>Teléfono del cliente (opcional, para WhatsApp)</span>
        <input type="tel" data-bind="phone" value="${esc(b.phone)}" placeholder="Con código de área, ej: 2944123456" inputmode="tel" autocomplete="off"></label>
      <label class="f"><span>Vehículo</span>
        <input type="text" data-bind="vehicle" value="${esc(b.vehicle)}" placeholder="Ej: VW Gol Trend 2015" autocomplete="off" autocapitalize="words"></label>
      <label class="f"><span>Fecha</span>
        <input type="date" data-bind="date" value="${esc(b.date)}"></label>
      <label class="f"><span>Estado de las ópticas</span>
        <textarea data-bind="condition" id="condition" rows="2" placeholder="Ej: Muy opacas y amarillentas">${esc(b.condition)}</textarea></label>
      <div class="chips" id="chips">${conditionChips()}</div>
    </section>

    <section>
      <h2>Servicios</h2>
      <div id="items">${itemsHTML()}</div>
      <div class="add-row">
        <button type="button" class="btn ghost block" data-action="add-menu">${ic.plus} Agregar servicio</button>
      </div>
    </section>

    <section class="card" style="margin-top:14px">
      <h2>Observaciones</h2>
      <textarea data-bind="notes" rows="3" placeholder="Notas para el cliente (opcional)">${esc(b.notes)}</textarea>
    </section>

    <section class="card">
      <h2>Total</h2>
      <div id="totalWrap">${totalHTML()}</div>
    </section>

    <section class="card">
      <h2>Texto de cierre</h2>
      <textarea data-bind="closing" rows="3" placeholder="Ej: Consultame y coordinamos turno sin compromiso">${esc(b.closing)}</textarea>
      <button type="button" class="btn-link" data-action="closing-reset">Restaurar texto predeterminado</button>
    </section>`;
  }

  function conditionChips() {
    const cur = state.budget.condition.split(/\s*,\s*/).map((x) => x.toLowerCase());
    return GS.CONDITIONS.map(
      (c) => `<button type="button" class="chip ${cur.includes(c.toLowerCase()) ? 'on' : ''}" data-action="chip" data-v="${esc(c)}">${esc(c)}</button>`
    ).join('');
  }

  function itemsHTML() {
    const items = state.budget.items;
    if (!items.length)
      return `<div class="card empty">Todavía no hay servicios.<br>Tocá <b style="color:var(--gold2)">Agregar servicio</b> para elegir una plantilla.</div>`;
    return items.map((it, i) => itemCard(it, i, items.length)).join('');
  }

  function itemCard(it, i, n) {
    const open = state.open.has(it.id) ? 'open' : '';
    return `
    <article class="item ${it.include ? '' : 'alt'}" data-id="${it.id}">
      <div class="item-h">
        <textarea rows="1" class="item-name" data-iid="${it.id}" data-f="name" placeholder="Nombre del servicio">${esc(it.name)}</textarea>
        <div class="item-tools">
          <button type="button" class="icon-btn" data-action="item-up" data-iid="${it.id}" ${i === 0 ? 'disabled' : ''} aria-label="Subir">${ic.up}</button>
          <button type="button" class="icon-btn" data-action="item-down" data-iid="${it.id}" ${i === n - 1 ? 'disabled' : ''} aria-label="Bajar">${ic.down}</button>
          <button type="button" class="icon-btn del" data-action="item-del" data-iid="${it.id}" aria-label="Quitar">${ic.trash}</button>
        </div>
      </div>
      <div class="price-row">
        <label class="tog ${it.desde ? 'on' : ''}"><input type="checkbox" data-iid="${it.id}" data-f="desde" ${it.desde ? 'checked' : ''}>Desde</label>
        <div class="money"><span>$</span><input type="text" inputmode="numeric" data-iid="${it.id}" data-f="price" value="${it.price ? fmtNum(it.price) : ''}" placeholder="0"></div>
        <input type="text" data-iid="${it.id}" data-f="unit" value="${esc(it.unit)}" placeholder="el par" aria-label="Unidad">
      </div>
      <div class="item-row2">
        <div class="stepper">
          <button type="button" data-action="qty-" data-iid="${it.id}" aria-label="Menos">−</button>
          <b id="qty-${it.id}">${it.qty}</b>
          <button type="button" data-action="qty+" data-iid="${it.id}" aria-label="Más">+</button>
        </div>
        <label class="tog ${it.include ? 'on' : ''}"><input type="checkbox" data-iid="${it.id}" data-f="include" ${it.include ? 'checked' : ''}>Suma al total</label>
        <div class="sub" id="sub-${it.id}">${subHTML(it)}</div>
      </div>
      <details class="more" data-iid="${it.id}" ${open}>
        <summary>Descripción, beneficios y duración</summary>
        <label class="f"><span>Descripción</span><textarea rows="2" data-iid="${it.id}" data-f="description">${esc(it.description)}</textarea></label>
        <label class="f"><span>Beneficios (uno por línea)</span><textarea rows="3" data-iid="${it.id}" data-f="benefits">${esc((it.benefits || []).join('\n'))}</textarea></label>
        <label class="f"><span>Duración</span><input type="text" data-iid="${it.id}" data-f="duration" value="${esc(it.duration)}" placeholder="Ej: 6 a 10 meses"></label>
        <button type="button" class="btn small dark" data-action="item-save-tpl" data-iid="${it.id}">${ic.save} Guardar como plantilla</button>
      </details>
    </article>`;
  }

  function subHTML(it) {
    if (!it.include) return 'Opción alternativa<br><strong>no suma</strong>';
    return (Number(it.qty) > 1 ? 'Subtotal<br>' : 'Importe<br>') + '<strong>' + money(GS.itemSubtotal(it)) + '</strong>';
  }

  function totalHTML() {
    const b = state.budget;
    const t = GS.computeTotal(b);
    return `
      <div class="seg">
        <button type="button" data-action="total-mode" data-mode="auto" class="${b.totalManual ? '' : 'on'}">Automático</button>
        <button type="button" data-action="total-mode" data-mode="manual" class="${b.totalManual ? 'on' : ''}">A elección</button>
      </div>
      ${
        b.totalManual
          ? `<label class="f"><span>Total a mostrar</span><div class="money"><span>$</span><input type="text" inputmode="numeric" data-bind-money="totalValue" value="${b.totalValue ? fmtNum(b.totalValue) : ''}" placeholder="0"></div></label>`
          : `<p class="hint" style="margin-top:0">Suma de los servicios marcados “Suma al total”: <b id="autoSum" style="color:var(--gold2)">${money(t.sum)}</b></p>`
      }
      <label class="check"><input type="checkbox" id="chk-desde" ${t.showDesde ? 'checked' : ''}> Mostrar “desde” en el total</label>
      <div class="total-big" id="totalBig"><small>TOTAL</small><span><span class="d" id="tbDesde" hidden>DESDE</span><strong id="tbAmt">—</strong></span></div>`;
  }

  const reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  // Muestra un importe y lo hace "contar" hasta el nuevo valor
  function animateMoney(el, to, prefix) {
    if (!el) return;
    prefix = prefix || '';
    const from = el.dataset.v == null ? to : Number(el.dataset.v);
    el.dataset.v = to;
    cancelAnimationFrame(el._raf);
    if (from === to || reduceMotion) {
      el.textContent = prefix + money(to);
      return;
    }
    const t0 = performance.now();
    const dur = 520;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = prefix + money(from + (to - from) * e);
      if (k < 1) el._raf = requestAnimationFrame(step);
    };
    el._raf = requestAnimationFrame(step);
  }

  function updateTotals() {
    const b = state.budget;
    const t = GS.computeTotal(b);
    const amt = $('#tbAmt');
    if (amt) {
      $('#tbDesde').hidden = !t.showDesde;
      if (t.show) animateMoney(amt, t.total);
      else {
        cancelAnimationFrame(amt._raf);
        amt.dataset.v = 0;
        amt.textContent = '—';
      }
    }
    const bar = $('#barTotal');
    if (bar) {
      if (t.show) animateMoney(bar, t.total, t.showDesde ? 'Desde ' : '');
      else {
        cancelAnimationFrame(bar._raf);
        bar.dataset.v = 0;
        bar.textContent = '—';
      }
    }
    const sum = $('#autoSum');
    if (sum) animateMoney(sum, t.sum);
    const chk = $('#chk-desde');
    if (chk) chk.checked = t.showDesde;
  }

  function autoGrow(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 2 + 'px';
  }
  function autoGrowAll() {
    $$('.item-name').forEach(autoGrow);
  }

  function updateSub(it) {
    const s = $('#sub-' + it.id);
    if (s) s.innerHTML = subHTML(it);
    const q = $('#qty-' + it.id);
    if (q) q.textContent = it.qty;
  }

  function renderItems() {
    $('#items').innerHTML = itemsHTML();
    updateTotals();
    autoGrowAll();
  }

  function renderBar() {
    const bar = $('#actionbar');
    if (state.tab !== 'new') {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    bar.innerHTML = `
      <div class="tot"><small>Total</small><strong id="barTotal">—</strong></div>
      <button type="button" class="btn dark icon-only" data-action="save" aria-label="Guardar en el historial">${ic.save}</button>
      <button type="button" class="btn gold" data-action="share">${ic.eye || ic.share} Vista previa / Enviar</button>`;
    updateTotals();
  }

  /* ---------- historial ---------- */
  function viewHistory() {
    return `
    <div class="page-title"><h1>Historial</h1><span class="hint" style="margin:0">${budgets.length} guardado${budgets.length === 1 ? '' : 's'}</span></div>
    <input type="search" id="hist-search" placeholder="Buscar por cliente, vehículo o número" value="${esc(state.search)}" style="margin-bottom:14px">
    <div id="hist-list">${historyList()}</div>`;
  }

  function historyList() {
    const q = state.search.trim().toLowerCase();
    const list = budgets
      .filter((b) => !q || [b.client, b.vehicle, b.number].join(' ').toLowerCase().includes(q))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    if (!list.length) return `<div class="empty">${budgets.length ? 'No hay resultados.' : 'Todavía no guardaste presupuestos.<br>Se guardan solos al generar el PDF o con “Guardar”.'}</div>`;
    return list
      .map((b) => {
        const t = GS.computeTotal(b);
        return `
      <article class="list-card">
        <div class="top">
          <div><div class="num">${esc(b.number || '')} · ${esc(fmtDate(b.date))}</div>
            <div class="name">${esc(b.client || 'Sin nombre')}</div>
            <div class="meta">${esc(b.vehicle || 'Vehículo sin datos')} · ${b.items.length} servicio${b.items.length === 1 ? '' : 's'}</div></div>
          <div class="amt">${t.show ? (t.showDesde ? '<small style="font-weight:500;font-size:10px">DESDE </small>' : '') + money(t.total) : '—'}</div>
        </div>
        <div class="acts">
          <button type="button" class="btn small gold" data-action="hist-share" data-id="${b.id}">${ic.share} PDF</button>
          <button type="button" class="btn small ghost" data-action="hist-open" data-id="${b.id}">Abrir</button>
          <button type="button" class="btn small dark" data-action="hist-dup" data-id="${b.id}">Duplicar</button>
          <button type="button" class="btn small danger" data-action="hist-del" data-id="${b.id}" aria-label="Eliminar">${ic.trash}</button>
        </div>
      </article>`;
      })
      .join('');
  }

  /* ---------- plantillas ---------- */
  function viewTemplates() {
    return `
    <div class="page-title"><h1>Plantillas</h1>
      <button type="button" class="btn small gold" data-action="tpl-new">${ic.plus} Nueva</button></div>
    <p class="hint" style="margin:-6px 2px 14px">Son los servicios que elegís al armar un presupuesto. Podés cambiar textos y precios base.</p>
    ${
      templates.length
        ? templates
            .map(
              (t) => `
      <article class="list-card">
        <div class="top">
          <div><div class="name" style="color:var(--gold2)">${esc(t.name)}</div>
            <div class="meta">${esc(t.description || '')}</div></div>
          <div class="amt tpl-price">${t.desde ? '<small style="font-weight:500;font-size:10px">DESDE </small>' : ''}${t.price > 0 ? money(t.price) : 'Consultar'}</div>
        </div>
        ${(t.benefits || []).filter((x) => x.trim()).length ? `<ul class="tpl-benefits">${t.benefits.filter((x) => x.trim()).map((x) => '<li>' + esc(x) + '</li>').join('')}</ul>` : ''}
        ${t.duration ? `<div class="meta" style="margin-top:6px">Duración: ${esc(t.duration)}</div>` : ''}
        <div class="acts">
          <button type="button" class="btn small gold" data-action="tpl-use" data-id="${t.id}">${ic.plus} Usar</button>
          <button type="button" class="btn small ghost" data-action="tpl-edit" data-id="${t.id}">Editar</button>
          <button type="button" class="btn small danger" data-action="tpl-del" data-id="${t.id}" aria-label="Eliminar">${ic.trash}</button>
        </div>
      </article>`
            )
            .join('')
        : '<div class="empty">No hay plantillas.</div>'
    }
    <button type="button" class="btn-link" data-action="tpl-restore">Restaurar plantillas originales</button>`;
  }

  function tplForm(t) {
    const isNew = !t.id;
    return `
    <div class="sheet-h"><h3>${isNew ? 'Nueva plantilla' : 'Editar plantilla'}</h3>
      <button type="button" class="icon-btn" data-action="sheet-close" aria-label="Cerrar">${ic.close}</button></div>
    <label class="f"><span>Nombre del servicio</span><input type="text" id="tp-name" value="${esc(t.name || '')}"></label>
    <label class="f"><span>Descripción</span><textarea id="tp-desc" rows="2">${esc(t.description || '')}</textarea></label>
    <label class="f"><span>Beneficios (uno por línea)</span><textarea id="tp-ben" rows="4">${esc((t.benefits || []).join('\n'))}</textarea></label>
    <label class="f"><span>Duración</span><input type="text" id="tp-dur" value="${esc(t.duration || '')}"></label>
    <div class="price-row" style="margin-bottom:14px">
      <label class="tog ${t.desde ? 'on' : ''}"><input type="checkbox" id="tp-desde" ${t.desde ? 'checked' : ''} data-tog>Desde</label>
      <div class="money"><span>$</span><input type="text" inputmode="numeric" id="tp-price" value="${t.price ? fmtNum(t.price) : ''}" data-fmt placeholder="0"></div>
      <input type="text" id="tp-unit" value="${esc(t.unit != null ? t.unit : 'el par')}" placeholder="el par">
    </div>
    <button type="button" class="btn gold block" data-action="tpl-save" data-id="${t.id || ''}">Guardar plantilla</button>`;
  }

  /* ---------- ajustes ---------- */
  function viewSettings() {
    const fld = (label, key, extra = '') =>
      `<label class="f"><span>${label}</span><input type="text" data-set="${key}" value="${esc(settings[key])}" ${extra}></label>`;
    return `
    <div class="page-title"><h1>Ajustes</h1></div>
    <section class="card"><h2>Negocio</h2>
      ${fld('Nombre', 'businessName')}
      ${fld('Nombre del dueño (saludo de inicio)', 'ownerName')}
      ${fld('Subtítulo', 'tagline')}
    </section>
    <section class="card"><h2>Contacto (pie del PDF)</h2>
      ${fld('Instagram (usuario)', 'instagram')}
      ${fld('Instagram (enlace)', 'instagramUrl', 'inputmode="url"')}
      ${fld('Facebook (texto que se muestra)', 'facebookLabel')}
      ${fld('Facebook (enlace)', 'facebookUrl', 'inputmode="url"')}
      ${fld('WhatsApp (texto que se muestra)', 'whatsappDisplay')}
      ${fld('WhatsApp (número solo con dígitos, para el enlace)', 'whatsappNumber', 'inputmode="numeric"')}
    </section>
    <section class="card"><h2>Numeración</h2>
      <div class="grid2">
        ${fld('Prefijo', 'prefix')}
        <label class="f"><span>Próximo número</span><input type="text" inputmode="numeric" data-set="nextNumber" value="${esc(settings.nextNumber)}"></label>
      </div>
    </section>
    <section class="card"><h2>Texto de cierre predeterminado</h2>
      <textarea data-set="closing" rows="4">${esc(settings.closing)}</textarea>
      <p class="hint">Se usa en los presupuestos nuevos.</p>
    </section>
    <section class="card"><h2>Copia de seguridad</h2>
      <p class="hint" style="margin-top:0">Los datos se guardan en este teléfono. Hacé una copia de vez en cuando o para pasarlos a otro dispositivo.</p>
      <div class="stack" style="margin-top:12px">
        <button type="button" class="btn dark block" data-action="backup-export">${ic.download} Exportar copia</button>
        <button type="button" class="btn dark block" data-action="backup-import">Importar copia</button>
      </div>
    </section>
    ${GS.hosted ? '' : '<section class="card"><h2>Aplicación</h2><button type="button" class="btn ghost block" data-action="app-refresh">Buscar actualización</button><p class="hint">Descarga de nuevo los archivos de la app. No borra tus presupuestos.</p></section>'}
    <div class="ver">Gold Shine Presupuestos · v${GS.VERSION}</div>`;
  }

  /* ======================= compartir / PDF ======================= */
  const pdfName = (b) =>
    'Presupuesto-' + GS.fileSafe(b.number || 'GS') + (b.client ? '-' + GS.fileSafe(b.client) : '') + '.pdf';

  function previewHTML(b) {
    const t = GS.computeTotal(b);
    return `
    <img src="${GS.assetURL('img/logo.png')}" alt="">
    <div class="pv-h"><span>PRESUPUESTO ${esc(b.number || '')}</span><span>${esc(fmtDate(b.date))}</span></div>
    ${b.client ? `<div class="l">Cliente</div><div class="v">${esc(b.client)}</div>` : ''}
    ${b.vehicle ? `<div class="l">Vehículo</div><div class="v">${esc(b.vehicle)}</div>` : ''}
    ${b.condition ? `<div class="l">Estado de las ópticas</div><div class="v">${esc(b.condition)}</div>` : ''}
    ${b.items
      .map(
        (it) => `<div class="it"><span class="p">${it.desde ? 'desde ' : ''}${money(it.price)}${it.unit ? ' ' + esc(it.unit) : ''}</span><b>${esc(it.name)}</b>
        ${it.qty > 1 ? '<div>Cantidad: ' + it.qty + ' = ' + money(GS.itemSubtotal(it)) + '</div>' : ''}
        ${it.include ? '' : '<div style="color:var(--gold)"><i>Opción alternativa</i></div>'}</div>`
      )
      .join('')}
    ${t.show ? `<div class="tot"><span>TOTAL</span><span>${t.showDesde ? 'desde ' : ''}${money(t.total)}</span></div>` : ''}
    ${b.notes ? `<div class="l" style="margin-top:10px">Observaciones</div><div class="v">${esc(b.notes)}</div>` : ''}
    ${b.closing ? `<div class="cl">${esc(b.closing)}</div>` : ''}
    <div class="ft">${esc(settings.instagram)} · ${esc(settings.whatsappDisplay)}</div>`;
  }

  /* ---- vista previa real del PDF (pdf.js, con respaldo en HTML) ---- */
  let pdfjsP = null;
  function pdfjsURL(path) {
    return GS.hosted
      ? URL.createObjectURL(new Blob([GS.assetBytes(path)], { type: 'text/javascript' }))
      : new URL(path, document.baseURI).href;
  }
  function loadPdfjs() {
    if (!pdfjsP) {
      pdfjsP = import(pdfjsURL('vendor/pdfjs/pdf.min.mjs')).then((lib) => {
        lib.GlobalWorkerOptions.workerSrc = pdfjsURL('vendor/pdfjs/pdf.worker.min.mjs');
        return lib;
      });
      pdfjsP.catch(() => (pdfjsP = null));
    }
    return pdfjsP;
  }

  async function renderPdfPages(bytes, host, isCurrent) {
    const lib = await loadPdfjs();
    const doc = await lib.getDocument({ data: bytes.slice() }).promise;
    const wrap = document.createElement('div');
    wrap.className = 'pv-pages';
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const cssW = Math.max(280, host.clientWidth - 2);
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      if (!isCurrent()) return false;
      const v0 = page.getViewport({ scale: 1 });
      const sc = (cssW * dpr * 1.6) / v0.width; // 1.6 = margen para hacer zoom
      const vp = page.getViewport({ scale: sc });
      const cv = document.createElement('canvas');
      cv.width = Math.round(vp.width);
      cv.height = Math.round(vp.height);
      cv.className = 'pv-page';
      cv.dataset.action = 'pv-zoom';
      cv.style.aspectRatio = v0.width + ' / ' + v0.height;
      await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
      const fig = document.createElement('div');
      fig.className = 'pv-sheet';
      fig.appendChild(cv);
      const lab = document.createElement('span');
      lab.className = 'pv-n';
      lab.textContent = n + ' / ' + doc.numPages;
      fig.appendChild(lab);
      wrap.appendChild(fig);
    }
    if (!isCurrent()) return false;
    host.replaceChildren(wrap);
    host.classList.add('real');
    return true;
  }

  async function openShare(b, persist) {
    if (!b.items.length) {
      toast('Agregá al menos un servicio');
      return;
    }
    if (persist) saveBudget(b);
    else ensureNumber(b);
    state.shareId = b.id;
    state.pdf = null;
    state.shareBudget = b;
    openSheet(`
      <div class="sheet-h"><h3>Vista previa · ${esc(b.number)}</h3>
        <button type="button" class="icon-btn" data-action="sheet-close" aria-label="Cerrar">${ic.close}</button></div>
      <div class="pv" id="pv-host">${previewHTML(b)}</div>
      <p class="hint pv-tip" id="pv-tip" hidden>Tocá una página para acercarla o alejarla.</p>
      <div class="stack">
        <button type="button" class="btn gold block" data-action="pdf-share" disabled>${ic.share} Compartir PDF (WhatsApp)</button>
        <button type="button" class="btn dark block" data-action="pdf-download" disabled>${ic.download} Descargar PDF</button>
        <a class="btn ghost block" href="${esc(waUrl(b))}" target="_blank" rel="noopener">${ic.wa} Enviar solo texto por WhatsApp</a>
      </div>
      <p class="hint" id="pdf-status">Generando PDF…</p>`);
    if (persist && state.tab === 'new') {
      const h = $('.page-title h1');
      if (h) h.innerHTML = 'Presupuesto <em>' + esc(b.number) + '</em>';
    }
    try {
      const bytes = await GS.buildPdf(b, settings);
      if (state.shareId !== b.id || $('#overlay').hidden) return;
      state.pdf = { bytes, name: pdfName(b) };
      $$('#sheet [data-action^="pdf-"]').forEach((x) => (x.disabled = false));
      const st = $('#pdf-status');
      if (st) st.textContent = 'PDF listo (' + Math.max(1, Math.round(bytes.length / 1024)) + ' KB).';
      renderPdfPages(bytes, $('#pv-host'), () => state.shareId === b.id && !$('#overlay').hidden && state.pdf && state.pdf.bytes === bytes)
        .then((ok) => {
          if (ok) $('#pv-tip').hidden = false;
        })
        .catch((e) => console.warn('Vista previa real no disponible', e));
    } catch (err) {
      console.error(err);
      const st = $('#pdf-status');
      if (st) st.textContent = 'No se pudo generar el PDF: ' + (err && err.message ? err.message : err);
    }
  }

  function pdfBlob() {
    return new Blob([state.pdf.bytes], { type: 'application/pdf' });
  }

  function downloadPdf() {
    return saveFile(state.pdf.name, state.pdf.bytes, 'application/pdf');
  }

  async function sharePdf() {
    if (!state.pdf) return;
    if (GS.hosted) {
      const r = await downloadPdf();
      if (r === 'saved') toast('PDF guardado. Adjuntalo desde WhatsApp.');
      return;
    }
    const file = new File([pdfBlob()], state.pdf.name, { type: 'application/pdf' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: state.pdf.name });
        return;
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      console.warn(err);
    }
    await downloadPdf();
    toast('Se descargó el PDF. Adjuntalo desde WhatsApp.');
  }

  function waText(b) {
    const t = GS.computeTotal(b);
    const L = [];
    L.push('*' + settings.businessName.toUpperCase() + '* – Presupuesto ' + (b.number || ''));
    if (b.client) L.push('Cliente: ' + b.client);
    if (b.vehicle) L.push('Vehículo: ' + b.vehicle);
    L.push('Fecha: ' + fmtDate(b.date));
    if (b.condition) L.push('Estado de las ópticas: ' + b.condition);
    L.push('');
    b.items.forEach((it) => {
      L.push('✨ *' + it.name + '* – ' + (it.desde ? 'desde ' : '') + money(it.price) + (it.unit ? ' ' + it.unit : ''));
      (it.benefits || []).filter((x) => x.trim()).forEach((x) => L.push('✔ ' + x.trim()));
      if (it.duration) L.push('✔ Duración: ' + it.duration);
      if (it.qty > 1 && it.include) L.push('Cantidad: ' + it.qty + ' = ' + money(GS.itemSubtotal(it)));
      if (!it.include) L.push('_(opción alternativa)_');
      L.push('');
    });
    if (t.show) L.push('💰 *TOTAL: ' + (t.showDesde ? 'desde ' : '') + money(t.total) + '*', '');
    if (b.notes) L.push(b.notes, '');
    if (b.closing) L.push(b.closing, '');
    L.push('📲 WhatsApp: https://wa.me/' + settings.whatsappNumber);
    L.push('📷 Instagram: ' + settings.instagram);
    return L.join('\n');
  }

  function waUrl(b) {
    return 'https://wa.me/' + GS.waPhone(b.phone) + '?text=' + encodeURIComponent(waText(b));
  }

  /* ======================= acciones ======================= */
  function addItemFromTemplate(t) {
    state.budget.items.push({
      id: uid(),
      name: t.name,
      description: t.description || '',
      benefits: (t.benefits || []).slice(),
      duration: t.duration || '',
      price: Number(t.price) || 0,
      desde: !!t.desde,
      unit: t.unit != null ? t.unit : 'el par',
      qty: 1,
      include: true
    });
  }

  function addMenu() {
    openSheet(`
      <div class="sheet-h"><h3>Agregar servicio</h3>
        <button type="button" class="icon-btn" data-action="sheet-close" aria-label="Cerrar">${ic.close}</button></div>
      ${templates
        .map(
          (t) => `<button type="button" class="pick" data-action="add-tpl" data-id="${t.id}">
        <b>${esc(t.name)}</b><small>${t.desde ? 'desde ' : ''}${money(t.price)}${t.unit ? ' ' + esc(t.unit) : ''}</small></button>`
        )
        .join('')}
      <button type="button" class="pick" data-action="add-custom"><b>＋ Ítem personalizado</b><small>Un servicio o producto en blanco</small></button>`);
  }

  function afterAdd() {
    closeSheet();
    touch();
    if (state.tab !== 'new') setTab('new');
    else renderItems();
    const last = $$('#items .item').pop();
    if (last) {
      last.classList.add('enter');
      last.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function itemById(id) {
    return state.budget.items.find((i) => i.id === id);
  }

  function moveItem(id, dir) {
    const arr = state.budget.items;
    const i = arr.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    touch();
    renderItems();
    const moved = $('#items .item[data-id="' + id + '"]');
    if (moved) moved.classList.add('enter');
  }

  const actions = {
    'sheet-close': closeSheet,
    'go-home': () => showHome(),
    'home-go'(el) {
      const tab = el.dataset.tab;
      hideHome(() => setTab(tab));
    },
    async reset() {
      if (hasContent(state.budget) && !(await ask('¿Empezar un presupuesto nuevo? Se descarta lo que no guardaste.', 'Empezar de cero'))) return;
      state.budget = newBudget();
      state.dirty = false;
      S.set('draft', state.budget);
      render();
      window.scrollTo(0, 0);
    },
    'add-menu': addMenu,
    'add-tpl'(el) {
      const t = templates.find((x) => x.id === el.dataset.id);
      if (t) addItemFromTemplate(t);
      afterAdd();
    },
    'add-custom'() {
      state.budget.items.push({ id: uid(), name: '', description: '', benefits: [], duration: '', price: 0, desde: false, unit: '', qty: 1, include: true });
      state.open.add(state.budget.items[state.budget.items.length - 1].id);
      afterAdd();
      const inp = $$('#items .item-name').pop();
      if (inp) inp.focus();
    },
    'item-up': (el) => moveItem(el.dataset.iid, -1),
    'item-down': (el) => moveItem(el.dataset.iid, 1),
    async 'item-del'(el) {
      const it = itemById(el.dataset.iid);
      if (!it || !(await ask('¿Quitar “' + (it.name || 'este ítem') + '” del presupuesto?', 'Quitar'))) return;
      await collapseOut(el.closest('.item'));
      state.budget.items = state.budget.items.filter((x) => x.id !== it.id);
      touch();
      renderItems();
    },
    'qty+'(el) {
      const it = itemById(el.dataset.iid);
      it.qty = Math.min(99, (Number(it.qty) || 1) + 1);
      touch();
      updateSub(it);
      updateTotals();
    },
    'qty-'(el) {
      const it = itemById(el.dataset.iid);
      it.qty = Math.max(1, (Number(it.qty) || 1) - 1);
      touch();
      updateSub(it);
      updateTotals();
    },
    'item-save-tpl'(el) {
      const it = itemById(el.dataset.iid);
      if (!it || !it.name.trim()) return toast('Ponele un nombre al servicio primero');
      templates.push({
        id: uid(),
        name: it.name,
        description: it.description,
        benefits: (it.benefits || []).slice(),
        duration: it.duration,
        price: it.price,
        desde: it.desde,
        unit: it.unit
      });
      saveTemplates();
      toast('Guardado en Plantillas');
    },
    'total-mode'(el) {
      const b = state.budget;
      const manual = el.dataset.mode === 'manual';
      if (manual && !b.totalManual) b.totalValue = GS.computeTotal(b).sum;
      b.totalManual = manual;
      b.totalDesde = null;
      touch();
      $('#totalWrap').innerHTML = totalHTML();
      updateTotals();
    },
    chip(el) {
      const b = state.budget;
      const v = el.dataset.v;
      let parts = b.condition.split(/\s*,\s*/).filter(Boolean);
      const idx = parts.findIndex((x) => x.toLowerCase() === v.toLowerCase());
      if (idx >= 0) parts.splice(idx, 1);
      else parts.push(v);
      b.condition = parts.join(', ');
      $('#condition').value = b.condition;
      el.classList.toggle('on', idx < 0);
      touch();
    },
    'closing-reset'() {
      state.budget.closing = settings.closing;
      touch();
      $('[data-bind="closing"]').value = settings.closing;
    },
    save() {
      const b = state.budget;
      if (!hasContent(b)) return toast('No hay nada para guardar todavía');
      saveBudget(b);
      const h = $('.page-title h1');
      if (h) h.innerHTML = 'Presupuesto <em>' + esc(b.number) + '</em>';
      toast('Guardado en el historial (' + b.number + ')');
    },
    share: () => openShare(state.budget, true),
    'pdf-share': sharePdf,
    'pv-zoom'(el) {
      const host = $('#pv-host');
      const on = !host.classList.contains('zoomed');
      host.classList.toggle('zoomed', on);
      if (on) {
        const r = el.getBoundingClientRect();
        host.scrollLeft = Math.max(0, (host.scrollWidth - host.clientWidth) / 2);
      }
    },
    'pdf-download'() {
      if (state.pdf) downloadPdf();
    },
    /* historial */
    'hist-share'(el) {
      const b = budgets.find((x) => x.id === el.dataset.id);
      if (b) openShare(JSON.parse(JSON.stringify(b)), false);
    },
    async 'hist-open'(el) {
      const b = budgets.find((x) => x.id === el.dataset.id);
      if (!b) return;
      if (hasContent(state.budget) && state.dirty && !(await ask('Tenés cambios sin guardar en el presupuesto actual. ¿Abrir este igual?', 'Abrir'))) return;
      state.budget = JSON.parse(JSON.stringify(b));
      state.dirty = false;
      S.set('draft', state.budget);
      setTab('new');
    },
    'hist-dup'(el) {
      const b = budgets.find((x) => x.id === el.dataset.id);
      if (!b) return;
      const c = JSON.parse(JSON.stringify(b));
      c.id = uid();
      c.number = null;
      c.date = GS.todayISO();
      c.items.forEach((i) => (i.id = uid()));
      c.createdAt = c.updatedAt = Date.now();
      state.budget = c;
      state.dirty = true;
      S.set('draft', c);
      setTab('new');
      toast('Copia lista para editar');
    },
    async 'hist-del'(el) {
      const b = budgets.find((x) => x.id === el.dataset.id);
      if (!b || !(await ask('¿Eliminar el presupuesto ' + (b.number || '') + ' de ' + (b.client || 'sin nombre') + '?', 'Eliminar'))) return;
      await collapseOut(el.closest('.list-card'));
      budgets = budgets.filter((x) => x.id !== b.id);
      S.set('budgets', budgets);
      render(false);
    },
    /* plantillas */
    'tpl-new': () => openSheet(tplForm({ benefits: [], desde: true, unit: 'el par' })),
    'tpl-edit'(el) {
      const t = templates.find((x) => x.id === el.dataset.id);
      if (t) openSheet(tplForm(t));
    },
    'tpl-save'(el) {
      const name = $('#tp-name').value.trim();
      if (!name) return toast('Poné un nombre');
      const data = {
        name,
        description: $('#tp-desc').value.trim(),
        benefits: $('#tp-ben').value.split('\n').map((x) => x.trim()).filter(Boolean),
        duration: $('#tp-dur').value.trim(),
        price: parseMoney($('#tp-price').value),
        desde: $('#tp-desde').checked,
        unit: $('#tp-unit').value.trim()
      };
      const id = el.dataset.id;
      const t = id && templates.find((x) => x.id === id);
      if (t) Object.assign(t, data);
      else templates.push(Object.assign({ id: uid() }, data));
      saveTemplates();
      closeSheet();
      render(false);
    },
    async 'tpl-del'(el) {
      const t = templates.find((x) => x.id === el.dataset.id);
      if (!t || !(await ask('¿Eliminar la plantilla “' + t.name + '”?', 'Eliminar'))) return;
      await collapseOut(el.closest('.list-card'));
      templates = templates.filter((x) => x.id !== t.id);
      saveTemplates();
      render(false);
    },
    'tpl-use'(el) {
      const t = templates.find((x) => x.id === el.dataset.id);
      if (!t) return;
      addItemFromTemplate(t);
      touch();
      setTab('new');
      toast('Servicio agregado');
    },
    'tpl-restore'() {
      let n = 0;
      GS.BUILTIN_TEMPLATES.forEach((bt) => {
        if (!templates.some((t) => t.id === bt.id)) {
          templates.push(Object.assign({}, bt, { benefits: bt.benefits.slice() }));
          n++;
        }
      });
      saveTemplates();
      render(false);
      toast(n ? 'Plantillas restauradas' : 'Ya están todas las originales');
    },
    /* ajustes */
    'backup-export'() {
      const data = { app: 'gold-shine-presupuestos', version: GS.VERSION, exportedAt: new Date().toISOString(), settings, templates, budgets, draft: state.budget, seenBuiltins: S.get('seenBuiltins', []) };
      saveFile('gold-shine-copia-' + GS.todayISO() + '.json', JSON.stringify(data, null, 1), 'application/json');
    },
    'backup-import': () => $('#import-file').click(),
    async 'app-refresh'() {
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
        if (window.caches) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch (e) {}
      location.reload();
    }
  };

  /* ======================= eventos ======================= */
  document.addEventListener('click', (e) => {
    const nav = e.target.closest('#nav button');
    if (nav) return setTab(nav.dataset.tab);
    if (e.target.id === 'overlay') return closeSheet();
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const fn = actions[el.dataset.action];
    if (fn) fn(el);
  });

  document.addEventListener('input', (e) => {
    const t = e.target;
    const b = state.budget;
    if (t.dataset.bind) {
      b[t.dataset.bind] = t.value;
      if (t.dataset.bind === 'condition') {
        const c = $('#chips');
        if (c) c.innerHTML = conditionChips();
      }
      touch();
    } else if (t.dataset.bindMoney) {
      const n = parseMoney(t.value);
      t.value = n ? fmtNum(n) : '';
      b[t.dataset.bindMoney] = n;
      touch();
      updateTotals();
    } else if (t.dataset.f && t.dataset.iid && t.type !== 'checkbox') {
      const it = itemById(t.dataset.iid);
      if (!it) return;
      const f = t.dataset.f;
      if (f === 'price') {
        const n = parseMoney(t.value);
        t.value = n ? fmtNum(n) : '';
        it.price = n;
      } else if (f === 'benefits') it.benefits = t.value.split('\n');
      else it[f] = t.value;
      if (t.classList.contains('item-name')) autoGrow(t);
      touch();
      updateSub(it);
      updateTotals();
    } else if (t.dataset.set) {
      const k = t.dataset.set;
      settings[k] = k === 'nextNumber' ? Math.max(1, parseInt(t.value.replace(/\D/g, ''), 10) || 1) : t.value;
      saveSettings();
    } else if (t.id === 'hist-search') {
      state.search = t.value;
      $('#hist-list').innerHTML = historyList();
    } else if (t.dataset.fmt !== undefined) {
      const n = parseMoney(t.value);
      t.value = n ? fmtNum(n) : '';
    }
  });

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.type === 'checkbox' && t.closest('.tog')) t.closest('.tog').classList.toggle('on', t.checked);
    if (t.dataset.f && t.dataset.iid && t.type === 'checkbox') {
      const it = itemById(t.dataset.iid);
      if (!it) return;
      it[t.dataset.f] = t.checked;
      touch();
      if (t.dataset.f === 'include') {
        const art = t.closest('.item');
        if (art) art.classList.toggle('alt', !t.checked);
      }
      updateSub(it);
      updateTotals();
    } else if (t.id === 'chk-desde') {
      state.budget.totalDesde = t.checked;
      touch();
      updateTotals();
    } else if (t.id === 'import-file') {
      importBackup(t.files && t.files[0]);
      t.value = '';
    }
  });

  document.addEventListener(
    'toggle',
    (e) => {
      const d = e.target;
      if (d.matches && d.matches('details.more') && d.dataset.iid) {
        if (d.open) state.open.add(d.dataset.iid);
        else state.open.delete(d.dataset.iid);
      }
    },
    true
  );

  function importBackup(file) {
    if (!file) return;
    const r = new FileReader();
    r.onload = async () => {
      try {
        const d = JSON.parse(r.result);
        if (!d || d.app !== 'gold-shine-presupuestos') throw new Error('formato');
        if (!(await ask('Esto reemplaza los datos actuales de la app por los de la copia. ¿Continuar?', 'Importar'))) return;
        S.set('settings', d.settings || {});
        S.set('templates', d.templates || []);
        S.set('budgets', d.budgets || []);
        S.set('seenBuiltins', d.seenBuiltins || []);
        if (d.draft) S.set('draft', d.draft);
        location.reload();
      } catch (err) {
        toast('El archivo no es una copia válida');
      }
    };
    r.readAsText(file);
  }

  /* ======================= PWA ======================= */
  function setupSW() {
    if (GS.hosted || !('serviceWorker' in navigator)) return;
    let refreshing = false;
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // En la primera instalación el SW toma el control sin recargar; solo recargamos en actualizaciones.
      if (refreshing || !hadController) return;
      refreshing = true;
      location.reload();
    });
    navigator.serviceWorker
      .register('sw.js')
      .then((reg) => {
        const offer = (worker) => {
          $('#update-banner').hidden = false;
          $('#update-btn').onclick = () => worker.postMessage('skipWaiting');
        };
        if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) offer(nw);
          });
        });
        reg.update().catch(() => {});
      })
      .catch(() => {});
  }

  /* ======================= brillo al tocar ======================= */
  const FX_SEL = '.btn, .chip, .tog, .icon-btn, .nav button, .pick, .seg button, .stepper button, .tile, .btn-link, .topbar-sub, .topbar-logo-btn, .update-banner button';
  function initFx() {
    document.addEventListener(
      'pointerdown',
      (e) => {
        const el = e.target.closest && e.target.closest(FX_SEL);
        if (!el || el.disabled || reduceMotion) return;
        const r = el.getBoundingClientRect();
        const sh = document.createElement('span');
        sh.className = 'fx-shine';
        const rp = document.createElement('span');
        rp.className = 'fx-ripple';
        rp.style.left = e.clientX - r.left + 'px';
        rp.style.top = e.clientY - r.top + 'px';
        el.appendChild(rp);
        el.appendChild(sh);
        setTimeout(() => {
          sh.remove();
          rp.remove();
        }, 700);
      },
      { passive: true }
    );
  }

  /* ======================= destellos de fondo ======================= */
  const Sparkles = (function () {
    let cv, ctx, w = 0, h = 0, dpr = 1, raf = 0, last = 0, sprite;
    let parts = [];
    let glints = [];
    function makeSprite() {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,246,208,1)');
      gr.addColorStop(0.28, 'rgba(240,206,100,.55)');
      gr.addColorStop(1, 'rgba(201,162,39,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
      return c;
    }
    function resize() {
      if (!cv) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = cv.clientWidth;
      h = cv.clientHeight;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function spawn(initial) {
      return {
        x: Math.random() * w,
        y: initial ? Math.random() * h : h + 12,
        r: 0.7 + Math.random() * 1.9,
        vy: 7 + Math.random() * 18,
        vx: (Math.random() - 0.5) * 6,
        ph: Math.random() * 6.28,
        tw: Math.random() * 6.28,
        sp: 0.9 + Math.random() * 2.2,
        a: 0.3 + Math.random() * 0.6
      };
    }
    function newGlint(first) {
      return { x: 20 + Math.random() * (w - 40), y: 30 + Math.random() * h * 0.8, s: 9 + Math.random() * 17, t: -(first ? Math.random() * 2600 : 400 + Math.random() * 2400), dur: 950 + Math.random() * 900 };
    }
    function star(x, y, s, a) {
      ctx.globalAlpha = a;
      const g = s * 2.8;
      ctx.drawImage(sprite, x - g / 2, y - g / 2, g, g);
      ctx.fillStyle = '#fff7d6';
      ctx.beginPath();
      ctx.moveTo(x - s, y);
      ctx.quadraticCurveTo(x, y, x, y - s);
      ctx.quadraticCurveTo(x, y, x + s, y);
      ctx.quadraticCurveTo(x, y, x, y + s);
      ctx.quadraticCurveTo(x, y, x - s, y);
      ctx.fill();
    }
    function draw(t, dt) {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      parts.forEach((p, i) => {
        p.y -= p.vy * dt;
        p.x += (p.vx + Math.sin(t / 1400 + p.ph) * 5) * dt;
        p.tw += dt * p.sp;
        if (p.y < -14) parts[i] = spawn(false);
        const s = p.r * 7;
        ctx.globalAlpha = Math.max(0, p.a * (0.55 + 0.45 * Math.sin(p.tw)));
        ctx.drawImage(sprite, p.x - s / 2, p.y - s / 2, s, s);
      });
      glints.forEach((g, i) => {
        g.t += dt * 1000;
        if (g.t < 0) return;
        if (g.t > g.dur) {
          glints[i] = newGlint(false);
          return;
        }
        const e = Math.sin(Math.PI * (g.t / g.dur));
        star(g.x, g.y, g.s * (0.35 + 0.65 * e), 0.95 * e);
      });
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    function frame(t) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016);
      last = t;
      draw(t, dt);
    }
    return {
      init(el) {
        cv = el;
        ctx = cv.getContext('2d');
        sprite = makeSprite();
        window.addEventListener('resize', () => {
          if (raf) resize();
        });
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) this.stop();
          else if (!$('#home').hidden) this.start();
        });
      },
      start() {
        if (raf || !cv) return;
        resize();
        const n = Math.max(38, Math.min(90, Math.round((w * h) / 9500)));
        parts = Array.from({ length: n }, () => spawn(true));
        glints = Array.from({ length: 7 }, () => newGlint(true));
        last = 0;
        if (reduceMotion) {
          glints.forEach((g) => (g.t = g.dur / 2));
          draw(0, 0);
          return;
        }
        raf = requestAnimationFrame(frame);
      },
      stop() {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      }
    };
  })();

  /* ======================= pantalla de inicio ======================= */
  const homeIcons = {
    new: '<path d="M12 5v14M5 12h14"/>',
    history: '<path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/>',
    templates: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>'
  };
  const svgI = (p) => '<svg viewBox="0 0 24 24">' + p + '</svg>';

  function greeting() {
    const h = new Date().getHours();
    return h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
  }

  function renderHome() {
    const name = String(settings.ownerName || '').trim();
    $('#home-greet').textContent = greeting();
    $('#home-welcome').textContent = name ? 'Bienvenido,' : 'Bienvenido';
    const nm = $('#home-name');
    nm.setAttribute('aria-label', name);
    nm.innerHTML = Array.from(name)
      .map((c, i) => '<span class="ch" style="--i:' + i + '">' + (c === ' ' ? '&nbsp;' : esc(c)) + '</span>')
      .join('');
    const cur = hasContent(state.budget);
    const tiles = [
      { tab: 'new', cls: 'feature', title: cur ? 'Continuar presupuesto' : 'Nuevo presupuesto', sub: cur ? (state.budget.client || 'En curso') : 'Armá uno en un minuto' },
      { tab: 'history', title: 'Historial', sub: budgets.length + (budgets.length === 1 ? ' guardado' : ' guardados') },
      { tab: 'templates', title: 'Plantillas', sub: templates.length + (templates.length === 1 ? ' servicio' : ' servicios') },
      { tab: 'settings', title: 'Ajustes', sub: 'Contacto y copias', span: true }
    ];
    $('#home-tiles').innerHTML = tiles
      .map(
        (t, i) =>
          '<button type="button" class="tile ' + (t.cls || '') + '" style="--i:' + i + (t.span ? ';grid-column:1/-1' : '') + '" data-action="home-go" data-tab="' + t.tab + '">' +
          '<span class="ti">' + svgI(homeIcons[t.tab]) + '</span>' +
          '<span><b>' + esc(t.title) + '</b><small>' + esc(t.sub) + '</small></span>' +
          (t.cls ? '<span class="go">' + svgI('<path d="M5 12h14M13 6l6 6-6 6"/>') + '</span>' : '') +
          '</button>'
      )
      .join('');
    $('#home-foot').textContent = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    $('.home-logo').style.setProperty('--logo', 'url("' + GS.assetURL('img/logo.png') + '")');
  }

  function showHome() {
    const home = $('#home');
    renderHome();
    home.classList.remove('leaving', 'play');
    home.hidden = false;
    home.scrollTop = 0;
    void home.offsetWidth;
    home.classList.add('play');
    document.body.classList.add('on-home');
    Sparkles.start();
  }

  function hideHome(cb) {
    const home = $('#home');
    if (home.hidden) return cb && cb();
    home.classList.add('leaving');
    setTimeout(() => cb && cb(), reduceMotion ? 0 : 260);
    setTimeout(() => {
      home.hidden = true;
      home.classList.remove('leaving', 'play');
      document.body.classList.remove('on-home');
      Sparkles.stop();
    }, reduceMotion ? 0 : 520);
  }

  /* ======================= arranque ======================= */
  load();
  render(false);
  initFx();
  Sparkles.init($('#sparkles'));
  showHome();
  setupSW();
})();
