/* Generación del PDF (negro, dorado y fibra de carbono) con pdf-lib. */
window.GS = window.GS || {};

GS.buildPdf = async function (b, s) {
  const { PDFDocument, StandardFonts, rgb, degrees, PDFName, PDFString } = PDFLib;

  const doc = await PDFDocument.create();
  doc.setTitle('Presupuesto ' + (b.number || '') + ' - ' + s.businessName);
  doc.setAuthor(s.businessName);
  doc.setCreator('Gold Shine Presupuestos');

  const fR = await doc.embedFont(StandardFonts.Helvetica);
  const fB = await doc.embedFont(StandardFonts.HelveticaBold);
  const fI = await doc.embedFont(StandardFonts.HelveticaOblique);

  const load = async (url) => {
    if (GS.embedded && GS.embedded[url]) return GS.assetBytes(url);
    const r = await fetch(url);
    if (!r.ok) throw new Error('No se pudo cargar ' + url);
    return r.arrayBuffer();
  };
  const [logoB, headB, slimB, footB] = await Promise.all([
    load('img/logo-pdf.png'),
    load('img/pdf-header.jpg'),
    load('img/pdf-header-slim.jpg'),
    load('img/pdf-footer.jpg')
  ]);
  const logo = await doc.embedPng(logoB);
  const imgHead = await doc.embedJpg(headB);
  const imgSlim = await doc.embedJpg(slimB);
  const imgFoot = await doc.embedJpg(footB);

  // ---- colores ----
  const BLACK = rgb(0, 0, 0);
  const GOLD = rgb(0.788, 0.635, 0.153);
  const GOLD2 = rgb(0.91, 0.784, 0.353);
  const GOLDD = rgb(0.56, 0.43, 0.07);
  const PANEL = rgb(0.06, 0.06, 0.06);
  const PANEL2 = rgb(0.095, 0.095, 0.095);
  const LINE = rgb(0.17, 0.17, 0.17);
  const WHITE = rgb(0.96, 0.96, 0.96);
  const GRAY = rgb(0.68, 0.68, 0.68);

  // ---- medidas ----
  const W = 595.28;
  const H = 841.89;
  const M = 40;
  const CW = W - 2 * M;
  const HEAD_H = 136;
  const SLIM_H = 56;
  const FOOT_H = 90;
  const FOOT_TOP = FOOT_H + 10; // el contenido no baja de esta altura

  // ---- texto seguro (Helvetica estándar no tiene emojis, etc.) ----
  const charset = new Set(fR.getCharacterSet());
  const clean = (t) =>
    Array.from(
      String(t == null ? '' : t)
        .replace(/\r/g, '')
        .replace(/\t/g, ' ')
        .replace(/[✓✔✅]/g, '')
    )
      .filter((ch) => ch === '\n' || charset.has(ch.codePointAt(0)))
      .join('');

  const wrap = (text, font, size, maxW) => {
    const out = [];
    for (const para of clean(text).split('\n')) {
      const words = para.split(/\s+/).filter(Boolean);
      if (!words.length) {
        out.push('');
        continue;
      }
      let line = '';
      for (const w of words) {
        const t = line ? line + ' ' + w : w;
        if (font.widthOfTextAtSize(t, size) <= maxW) {
          line = t;
        } else {
          if (line) out.push(line);
          if (font.widthOfTextAtSize(w, size) > maxW) {
            let chunk = '';
            for (const ch of w) {
              if (font.widthOfTextAtSize(chunk + ch, size) > maxW) {
                out.push(chunk);
                chunk = ch;
              } else chunk += ch;
            }
            line = chunk;
          } else line = w;
        }
      }
      out.push(line);
    }
    return out;
  };

  let page;
  let y;

  // ---- primitivas de dibujo ----
  const text = (t, x, yy, o) => {
    const str = clean(t);
    if (!str) return;
    const opt = { x, y: yy, font: o.font || fR, size: o.size || 10, color: o.color || WHITE };
    if (o.skew) opt.ySkew = degrees(o.skew);
    if (o.opacity != null) opt.opacity = o.opacity;
    page.drawText(str, opt);
  };
  const textRight = (t, xr, yy, o) => {
    const str = clean(t);
    const w = (o.font || fR).widthOfTextAtSize(str, o.size || 10);
    text(str, xr - w, yy, o);
    return w;
  };
  const textCenter = (t, xc, yy, o) => {
    const str = clean(t);
    const w = (o.font || fR).widthOfTextAtSize(str, o.size || 10);
    text(str, xc - w / 2, yy, o);
  };
  const spaced = (t, x, yy, o) => {
    const sp = o.spacing || 1.5;
    let cx = x;
    for (const ch of clean(t)) {
      text(ch, cx, yy, o);
      cx += (o.font || fR).widthOfTextAtSize(ch, o.size || 10) + sp;
    }
    return cx - x;
  };
  const spacedWidth = (t, o) =>
    Array.from(clean(t)).reduce((a, ch) => a + (o.font || fR).widthOfTextAtSize(ch, o.size || 10) + (o.spacing || 1.5), 0);

  const rect = (x, yy, w, h, color, opacity) =>
    page.drawRectangle({ x, y: yy, width: w, height: h, color, opacity: opacity == null ? 1 : opacity });
  const hline = (x1, x2, yy, th, color, opacity) =>
    page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness: th, color, opacity: opacity == null ? 1 : opacity });

  // polígono en coordenadas absolutas del PDF
  const poly = (pts, o) =>
    page.drawSvgPath(
      'M' + pts.map((p) => p[0].toFixed(2) + ',' + (H - p[1]).toFixed(2)).join(' L') + ' Z',
      Object.assign({ x: 0, y: H }, o)
    );
  // trazo SVG con origen arriba-izquierda (x, yTop)
  const svg = (path, x, yTop, scale, o) =>
    page.drawSvgPath(path, Object.assign({ x, y: yTop, scale }, o));

  // paralelogramo (inclinado a la derecha)
  const para = (x, yy, w, h, slant, o) =>
    poly([[x + slant, yy + h], [x + w + slant, yy + h], [x + w, yy], [x, yy]], o);

  // panel con esquina superior derecha cortada
  const chamfer = (x, top, w, h, c, o) =>
    poly([[x, top], [x + w - c, top], [x + w, top - c], [x + w, top - h], [x, top - h]], o);

  // degradé dorado metálico
  const stops = [
    [0, [0.56, 0.43, 0.07]],
    [0.3, [0.92, 0.79, 0.36]],
    [0.55, [0.79, 0.64, 0.15]],
    [0.8, [0.95, 0.84, 0.46]],
    [1, [0.6, 0.46, 0.09]]
  ];
  const goldAt = (t) => {
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        const [t0, c0] = stops[i - 1];
        const [t1, c1] = stops[i];
        const k = (t - t0) / (t1 - t0);
        return rgb(c0[0] + (c1[0] - c0[0]) * k, c0[1] + (c1[1] - c0[1]) * k, c0[2] + (c1[2] - c0[2]) * k);
      }
    }
    return rgb(0.6, 0.46, 0.09);
  };
  const metalBar = (x, yy, w, h, slant, n) => {
    const k = n || 40;
    const sw = w / k;
    for (let i = 0; i < k; i++) {
      para(x + i * sw, yy, sw + 0.7, h, slant, { color: goldAt(i / (k - 1)) });
    }
    // brillo y sombra para efecto metal pulido
    para(x, yy + h - 1.6, w, 1.6, slant, { color: rgb(1, 0.95, 0.75), opacity: 0.45 });
    para(x, yy, w, 2, slant, { color: rgb(0.2, 0.14, 0), opacity: 0.35 });
    for (let yl = yy + 3.5; yl < yy + h - 2; yl += 2.2) {
      const t = (yl - yy) / h;
      page.drawLine({
        start: { x: x + slant * t + 2, y: yl },
        end: { x: x + w + slant * t - 2, y: yl },
        thickness: 0.35,
        color: rgb(1, 1, 1),
        opacity: 0.05
      });
    }
  };
  // línea que se desvanece hacia un lado
  const fadeLine = (x1, x2, yy, th, color, dir) => {
    const k = 28;
    const sw = (x2 - x1) / k;
    for (let i = 0; i < k; i++) {
      const t = dir === 'right' ? 1 - i / k : i / k;
      hline(x1 + i * sw, x1 + (i + 1) * sw + 0.4, yy, th, color, Math.max(0.04, t));
    }
  };

  const link = (x, yy, w, h, url) => {
    const ctx = doc.context;
    const annot = ctx.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [x, yy, x + w, yy + h],
      Border: [0, 0, 0],
      A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) }
    });
    const ref = ctx.register(annot);
    const annots = page.node.Annots();
    if (annots) annots.push(ref);
    else page.node.set(PDFName.of('Annots'), ctx.obj([ref]));
  };

  // ---- íconos vectoriales ----
  const stroke = (c, w) => ({ borderColor: c, borderWidth: w, borderOpacity: 1 });
  const iconHeadlight = (x, yTop, sc, col) => {
    const c = col || GOLD;
    svg('M3,4.5 C3,2 6,1 10,1 L15,1 C20,1 23,5 23,9 C23,13 20,17 15,17 L10,17 C6,17 3,16 3,13.5 Z', x, yTop, sc, stroke(c, 1.3));
    svg('M13,9 m-3.4,0 a3.4,3.4 0 1,0 6.8,0 a3.4,3.4 0 1,0 -6.8,0', x, yTop, sc, stroke(c, 1.1));
    svg('M25.5,4.5 L31,3 M25.5,9 L32,9 M25.5,13.5 L31,15', x, yTop, sc, stroke(c, 1.3));
  };
  const iconCar = (x, yTop, sc, col) => {
    const c = col || GOLD;
    svg('M1,10 L1,6.5 L5.5,5.5 L9.5,1.5 L19,1.5 L23.5,5.5 L28,7 L28,10 Z', x, yTop, sc, stroke(c, 1.3));
    svg('M9,10 m-2.4,0 a2.4,2.4 0 1,0 4.8,0 a2.4,2.4 0 1,0 -4.8,0', x, yTop, sc, Object.assign({ color: BLACK }, stroke(c, 1.3)));
    svg('M21,10 m-2.4,0 a2.4,2.4 0 1,0 4.8,0 a2.4,2.4 0 1,0 -4.8,0', x, yTop, sc, Object.assign({ color: BLACK }, stroke(c, 1.3)));
  };
  const iconPerson = (x, yTop, sc, col) => {
    const c = col || GOLD;
    svg('M7,4.2 m-2.8,0 a2.8,2.8 0 1,0 5.6,0 a2.8,2.8 0 1,0 -5.6,0', x, yTop, sc, stroke(c, 1.3));
    svg('M1.5,13.5 C1.5,9.5 4,8.3 7,8.3 C10,8.3 12.5,9.5 12.5,13.5', x, yTop, sc, stroke(c, 1.3));
  };
  const iconClock = (x, yTop, sc, col) => {
    const c = col || GOLD;
    svg('M6,6 m-5,0 a5,5 0 1,0 10,0 a5,5 0 1,0 -10,0', x, yTop, sc, stroke(c, 1.2));
    svg('M6,3 L6,6 L8.2,7.4', x, yTop, sc, stroke(c, 1.2));
  };
  const iconInstagram = (x, yTop, sc) => {
    svg('M4,1 h6 a3,3 0 0 1 3,3 v6 a3,3 0 0 1 -3,3 h-6 a3,3 0 0 1 -3,-3 v-6 a3,3 0 0 1 3,-3 z', x, yTop, sc, stroke(GOLD, 1.3));
    svg('M7,7 m-2.6,0 a2.6,2.6 0 1,0 5.2,0 a2.6,2.6 0 1,0 -5.2,0', x, yTop, sc, stroke(GOLD, 1.3));
    svg('M10.6,3.4 m-0.7,0 a0.7,0.7 0 1,0 1.4,0 a0.7,0.7 0 1,0 -1.4,0', x, yTop, sc, { color: GOLD });
  };
  const iconFacebook = (x, yTop, sc) => {
    svg('M7,7 m-6.2,0 a6.2,6.2 0 1,0 12.4,0 a6.2,6.2 0 1,0 -12.4,0', x, yTop, sc, stroke(GOLD, 1.3));
    svg('M8,12.6 L8,7.8 L9.6,7.8 L9.8,6.2 L8,6.2 L8,5.2 C8,4.6 8.4,4.4 9,4.4 L9.9,4.4 L9.9,3 C9.5,2.9 9,2.9 8.5,2.9 C7,2.9 6.2,3.8 6.2,5.2 L6.2,6.2 L4.8,6.2 L4.8,7.8 L6.2,7.8 L6.2,12.6 Z', x, yTop, sc, { color: GOLD });
  };
  const iconWhatsapp = (x, yTop, sc) => {
    svg('M7,0.9 C3.5,0.9 0.9,3.6 0.9,7 C0.9,8.2 1.2,9.2 1.8,10.2 L0.8,13.2 L3.9,12.3 C4.8,12.8 5.9,13.1 7,13.1 C10.5,13.1 13.1,10.4 13.1,7 C13.1,3.6 10.5,0.9 7,0.9 Z', x, yTop, sc, stroke(GOLD, 1.3));
    svg('M4.6,4.5 C4.3,7.7 6.4,9.9 9.5,9.6 L9.9,8.4 L8.5,7.7 L7.9,8.3 C7.2,8 6.6,7.4 6.3,6.7 L6.9,6.1 L6.2,4.7 Z', x, yTop, sc, { color: GOLD });
  };

  // ---- fondo decorativo (rayas de velocidad muy sutiles) ----
  const drawBackdrop = () => {
    rect(0, 0, W, H, BLACK);
    const stripes = [
      [300, 22, 0.05],
      [345, 9, 0.06],
      [372, 34, 0.035],
      [430, 12, 0.05],
      [468, 5, 0.07],
      [500, 26, 0.04]
    ];
    stripes.forEach(([sx, sw, op]) => {
      poly([[sx, 120], [sx + sw, 120], [sx + sw + 330, 760], [sx + 330, 760]], { color: GOLD, opacity: op });
    });
  };

  // ---- pie de página (en cada hoja) ----
  const drawFooter = () => {
    page.drawImage(imgFoot, { x: 0, y: 0, width: W, height: FOOT_H });
    // tira de bandera a cuadros al pie
    const sq = 5;
    const n = Math.ceil(W / sq);
    for (let i = 0; i < n; i++) {
      rect(i * sq, 0, sq, sq / 2, (i % 2 ? GOLD : BLACK));
      rect(i * sq, sq / 2, sq, sq / 2, (i % 2 ? BLACK : GOLD));
    }
    metalBar(0, FOOT_H - 1, W, 2.2, 0, 24);
    const widths = [128, 222, 165];
    const cols = [
      { icon: iconInstagram, label: 'INSTAGRAM', value: s.instagram, url: s.instagramUrl },
      { icon: iconFacebook, label: 'FACEBOOK', value: s.facebookLabel, url: s.facebookUrl },
      {
        icon: iconWhatsapp,
        label: 'WHATSAPP',
        value: s.whatsappDisplay,
        url: 'https://wa.me/' + String(s.whatsappNumber || '').replace(/\D/g, '')
      }
    ];
    let cxp = M;
    cols.forEach((c, i) => {
      const x = cxp + (i ? 14 : 0);
      c.icon(x, 64, 1.15);
      spaced(c.label, x + 21, 55, { font: fB, size: 7, color: GOLD, spacing: 1.3 });
      text(c.value, x + 21, 42, { font: fB, size: 8.6, color: WHITE });
      const w = fB.widthOfTextAtSize(clean(c.value), 8.6);
      if (c.url) link(x, 35, Math.min(w + 22, widths[i] - 6), 32, c.url);
      if (i) para(cxp - 2, 36, 0.8, 32, 6, { color: GOLD, opacity: 0.55 });
      cxp += widths[i];
    });
    textCenter(s.businessName.toUpperCase() + '   ·   ' + s.tagline.toUpperCase(), W / 2, 17, { font: fR, size: 6.4, color: GRAY });
  };

  const newPage = (first) => {
    page = doc.addPage([W, H]);
    drawBackdrop();
    drawFooter();
    if (first) {
      page.drawImage(imgHead, { x: 0, y: H - HEAD_H, width: W, height: HEAD_H });
      const logoW = 182;
      const logoH = (logoW * logo.height) / logo.width;
      page.drawImage(logo, { x: M, y: H - 22 - logoH, width: logoW, height: logoH });
      // placa con número y fecha (derecha)
      const xr = W - M;
      const nLabel = b.number ? 'N° ' + b.number : 'SIN NÚMERO';
      const nw = fB.widthOfTextAtSize(clean(nLabel), 10.5) + 26;
      para(xr - nw, H - 83, nw, 20, 8, { color: PANEL2, borderColor: GOLD, borderWidth: 0.9 });
      text(nLabel, xr - nw + 14, H - 76.5, { font: fB, size: 10.5, color: GOLD2 });
      textRight('Fecha: ' + GS.fmtDate(b.date), xr, H - 99, { font: fR, size: 9.5, color: GRAY });
      y = H - HEAD_H - 24;
    } else {
      page.drawImage(imgSlim, { x: 0, y: H - SLIM_H, width: W, height: SLIM_H });
      const lw = 80;
      const lh = (lw * logo.height) / logo.width;
      page.drawImage(logo, { x: M, y: H - SLIM_H / 2 - lh / 2 - 1, width: lw, height: lh });
      textRight('PRESUPUESTO ' + (b.number ? 'N° ' + b.number : ''), W - M, H - 26, { font: fB, size: 10, color: GOLD2, skew: 12 });
      if (b.client) textRight(b.client, W - M, H - 40, { size: 8.5, color: GRAY });
      y = H - SLIM_H - 22;
    }
  };

  const ensure = (h) => {
    if (y - h < FOOT_TOP) newPage(false);
  };

  const heading = (label) => {
    ensure(44);
    para(M, y - 2, 5, 12, 4, { color: GOLD });
    para(M + 8, y - 2, 2.5, 12, 4, { color: GOLD, opacity: 0.6 });
    const o = { font: fB, size: 10, color: GOLD2, spacing: 2.6 };
    const w = spaced(label, M + 20, y, o);
    fadeLine(M + 20 + w + 10, W - M, y + 4, 0.7, GOLD, 'right');
    y -= 18;
  };

  // ---- datos del cliente ----
  const drawClient = () => {
    const pad = 16;
    const colW = (CW - pad * 2 - 20) / 2;
    const tx = 26; // sangría del texto respecto del ícono
    const cName = wrap(b.client || '-', fB, 12, colW - tx);
    const cVeh = wrap(b.vehicle || '-', fB, 12, colW - tx);
    const rowH1 = 14 + Math.max(cName.length, cVeh.length) * 15;
    const condLines = b.condition ? wrap(b.condition, fR, 10.5, CW - pad * 2 - tx) : [];
    const rowH2 = condLines.length ? 20 + condLines.length * 14 : 0;
    const h = pad + rowH1 + rowH2 + pad - 6;
    ensure(h + 14);
    const top = y;
    chamfer(M, top, CW, h, 16, { color: PANEL, borderColor: rgb(0.2, 0.2, 0.2), borderWidth: 0.7 });
    para(M, top - h, 5, h, 0, { color: GOLD });
    const x1 = M + pad + 4;
    const x2 = x1 + colW + 20;
    let cy = top - pad - 4;
    iconPerson(x1, cy + 8, 1.15);
    iconCar(x2, cy + 5, 0.72);
    spaced('CLIENTE', x1 + tx, cy, { font: fB, size: 7.2, color: GOLD, spacing: 1.5 });
    spaced('VEHÍCULO', x2 + tx, cy, { font: fB, size: 7.2, color: GOLD, spacing: 1.5 });
    para(x2 - 12, top - 14 - rowH1 + 10, 0.8, rowH1 - 6, 6, { color: GOLD, opacity: 0.35 });
    cName.forEach((l, i) => text(l, x1 + tx, cy - 16 - i * 15, { font: fB, size: 12, color: WHITE }));
    cVeh.forEach((l, i) => text(l, x2 + tx, cy - 16 - i * 15, { font: fB, size: 12, color: WHITE }));
    cy -= rowH1;
    if (condLines.length) {
      fadeLine(M + pad, W - M - pad, cy + 6, 0.5, GOLD, 'right');
      cy -= 10;
      iconHeadlight(x1 - 1, cy + 7, 0.62);
      spaced('ESTADO DE LAS ÓPTICAS', x1 + tx, cy, { font: fB, size: 7.2, color: GOLD, spacing: 1.5 });
      condLines.forEach((l, i) => text(l, x1 + tx, cy - 16 - i * 14, { size: 10.5, color: WHITE }));
    }
    y = top - h - 22;
  };

  // ---- un servicio / ítem ----
  const renderItem = (it, yTop, draw) => {
    const padX = 20;
    const x0 = M + padX;
    const xr = M + CW - 16;
    const priceW = 124;
    const leftW = CW - padX - 16 - priceW - 16;
    const iconIndent = 36;
    const topPad = 14;
    let ly = yTop - topPad;

    // izquierda
    const nameLines = wrap(it.name || 'Servicio', fB, 12.5, leftW - iconIndent);
    ly -= 10;
    if (draw) iconHeadlight(x0, ly + 10, 0.9, it.include ? GOLD : GRAY);
    nameLines.forEach((l) => {
      if (draw) text(l, x0 + iconIndent, ly, { font: fB, size: 12.5, color: it.include ? GOLD2 : WHITE });
      ly -= 15;
    });
    ly += 15 - 4;
    if (nameLines.length === 1) ly -= 6;

    if (it.description) {
      wrap(it.description, fR, 9.5, leftW).forEach((l) => {
        ly -= 13.5;
        if (draw) text(l, x0, ly, { size: 9.5, color: GRAY });
      });
      ly -= 5;
    }
    (it.benefits || []).filter((x) => String(x).trim()).forEach((bn) => {
      const lines = wrap(bn, fR, 9.5, leftW - 20);
      lines.forEach((l, i) => {
        ly -= 14;
        if (draw) {
          if (i === 0) {
            page.drawCircle({ x: x0 + 5.5, y: ly + 3.6, size: 5.4, color: GOLD, opacity: 0.16 });
            const o = { thickness: 1.2, color: GOLD };
            page.drawLine({ start: { x: x0 + 2.6, y: ly + 3.6 }, end: { x: x0 + 4.8, y: ly + 1.5 }, ...o });
            page.drawLine({ start: { x: x0 + 4.8, y: ly + 1.5 }, end: { x: x0 + 8.6, y: ly + 6.2 }, ...o });
          }
          text(l, x0 + 18, ly, { size: 9.5, color: WHITE });
        }
      });
    });
    if (it.duration) {
      ly -= 19;
      if (draw) {
        iconClock(x0, ly + 9, 1.0);
        spaced('DURACIÓN', x0 + 16, ly, { font: fB, size: 7.2, color: GOLD, spacing: 1.4 });
        text(it.duration, x0 + 16 + 56, ly, { font: fB, size: 9.5, color: WHITE });
      }
    }
    const leftBottom = ly;

    // derecha: placa de precio
    const hasUnit = !!it.unit;
    const boxH = (it.desde ? 15 : 6) + 22 + (hasUnit ? 14 : 4) + 8;
    const boxTop = yTop - topPad;
    if (draw) {
      para(xr - priceW, boxTop - boxH, priceW - 8, boxH, 8, { color: PANEL2, borderColor: it.include ? GOLD : rgb(0.3, 0.3, 0.3), borderWidth: 0.9 });
    }
    const cx = xr - priceW / 2 + 4 - 4 + 4;
    let ry = boxTop - 8;
    if (it.desde) {
      ry -= 7;
      if (draw) spaced('DESDE', cx - spacedWidth('DESDE', { font: fB, size: 7, spacing: 1.6 }) / 2, ry, { font: fB, size: 7, color: GRAY, spacing: 1.6 });
      ry -= 8;
    } else ry -= 4;
    ry -= 16;
    if (draw) textCenter(Number(it.price) > 0 ? GS.money(it.price) : 'Consultar', cx, ry, { font: fB, size: Number(it.price) > 0 ? 17 : 13, color: it.include ? WHITE : GRAY });
    if (hasUnit) {
      ry -= 13;
      if (draw) textCenter(it.unit, cx, ry, { size: 8.5, color: GRAY });
    }
    let rBottom = boxTop - boxH;
    const qty = Number(it.qty) || 1;
    if (!it.include) {
      rBottom -= 14;
      if (draw) textCenter('Opción alternativa', cx, rBottom + 3, { font: fI, size: 8.5, color: GOLD });
    } else if (qty > 1) {
      rBottom -= 14;
      if (draw) textCenter('x' + qty + ' = ' + GS.money(GS.itemSubtotal(it)), cx, rBottom + 3, { font: fB, size: 9.5, color: GOLD });
    }
    const bottom = Math.min(leftBottom - 4, rBottom) - 12;
    return yTop - bottom;
  };

  const drawItem = (it) => {
    const h = renderItem(it, 0, false);
    ensure(h + 12);
    const top = y;
    chamfer(M, top, CW, h, 14, { color: PANEL, borderColor: rgb(0.19, 0.19, 0.19), borderWidth: 0.7 });
    para(M, top - h, 4.5, h, 0, { color: it.include ? GOLD : rgb(0.28, 0.28, 0.28) });
    renderItem(it, top, true);
    y = top - h - 10;
  };

  // ================= armado =================
  newPage(true);
  drawClient();

  if (b.items && b.items.length) {
    heading('SERVICIOS');
    b.items.forEach(drawItem);
  }

  // total
  const tot = GS.computeTotal(b);
  if (tot.show) {
    ensure(76);
    y -= 4;
    const h = 54;
    const slant = 14;
    metalBar(M, y - h, CW - slant, h, slant, 90);
    // franjas oscuras decorativas a la izquierda
    para(M + 112, y - h, 5, h, slant, { color: BLACK, opacity: 0.16 });
    para(M + 124, y - h, 2, h, slant, { color: BLACK, opacity: 0.16 });
    spaced('TOTAL', M + 26, y - h / 2 - 5, { font: fB, size: 16, color: BLACK, spacing: 4, skew: 12 });
    const amt = GS.money(tot.total);
    const xr = M + CW - slant - 22;
    const aw = textRight(amt, xr, y - h / 2 - 10, { font: fB, size: 29, color: BLACK });
    if (tot.showDesde) {
      spaced('DESDE', xr - aw - 12 - spacedWidth('DESDE', { font: fB, size: 9.5, spacing: 1.8 }), y - h / 2 - 3, { font: fB, size: 9.5, color: BLACK, spacing: 1.8 });
    }
    y -= h + 16;
  }

  // observaciones (panel con etiqueta interna)
  if (b.notes && b.notes.trim()) {
    const lines = wrap(b.notes, fR, 10, CW - 44);
    const lh = 13.5;
    ensure(46 + Math.min(lines.length, 2) * lh);
    let i = 0;
    while (i < lines.length) {
      const fit = Math.max(1, Math.floor((y - FOOT_TOP - 40) / lh));
      const chunk = lines.slice(i, i + Math.min(fit, lines.length - i));
      const h = chunk.length * lh + 34;
      chamfer(M, y, CW, h, 12, { color: PANEL, borderColor: rgb(0.19, 0.19, 0.19), borderWidth: 0.7 });
      para(M, y - h, 4.5, h, 0, { color: GOLD, opacity: 0.8 });
      para(M + 20, y - 17, 4, 9, 3, { color: GOLD });
      spaced('OBSERVACIONES', M + 31, y - 15, { font: fB, size: 7.2, color: GOLD, spacing: 1.6 });
      chunk.forEach((l, k) => text(l, M + 20, y - 32 - k * lh, { size: 10, color: WHITE }));
      y -= h + 8;
      i += chunk.length;
      if (i < lines.length) newPage(false);
    }
    y -= 2;
  }

  // cierre
  if (b.closing && b.closing.trim()) {
    const lines = wrap(b.closing, fI, 10.5, CW - 30);
    ensure(24 + lines.length * 14);
    y -= 2;
    fadeLine(M + 60, W / 2 - 14, y, 0.8, GOLD, 'left');
    fadeLine(W / 2 + 14, W - M - 60, y, 0.8, GOLD, 'right');
    poly([[W / 2, y + 5], [W / 2 + 5, y], [W / 2, y - 5], [W / 2 - 5, y]], { color: GOLD });
    y -= 17;
    lines.forEach((l) => {
      ensure(16);
      textCenter(l, W / 2, y, { font: fI, size: 10.5, color: GOLD2 });
      y -= 14;
    });
  }

  return await doc.save();
};
