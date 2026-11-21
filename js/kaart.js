// Lichte kaartmotor in RD-meters: twee canvassen (ondergrond + bewegende laag),
// tegels van PDOK of de Kadaster-tijdreiskaart, pannen en zoomen met muis en vingers.
import { ACHTERGRONDEN, kaartjaarVoor } from './geo.js';

export class Kaart {
  constructor(houder) {
    this.houder = houder;
    this.onder = document.createElement('canvas');
    this.boven = document.createElement('canvas');
    for (const c of [this.onder, this.boven]) { c.className = 'kaartlaag'; houder.appendChild(c); }
    this.co = this.onder.getContext('2d');
    this.cb = this.boven.getContext('2d');
    this.cx = 155000; this.cy = 463000; this.res = 400; // meter per schermpixel
    this.achtergrond = 'grijs'; this.jaar = 2026;
    this.tegels = new Map();
    this.vuil = true;
    this.lagenOnder = []; // functies(ctx, kaart) die de ondergrond tekenen
    this.lagenBoven = [];
    this.bijKlik = null; this.bijBeweeg = null;
    this.maat();
    addEventListener('resize', () => { this.maat(); this.vuil = true; });
    this.invoer();
  }
  maat() {
    this.dpr = Math.min(2, devicePixelRatio || 1);
    const r = this.houder.getBoundingClientRect();
    this.W = r.width; this.H = r.height;
    for (const c of [this.onder, this.boven]) { c.width = this.W * this.dpr; c.height = this.H * this.dpr; }
  }
  // wereld -> scherm (CSS-pixels)
  sx(x) { return (x - this.cx) / this.res + this.W / 2; }
  sy(y) { return (this.cy - y) / this.res + this.H / 2; }
  wx(px) { return (px - this.W / 2) * this.res + this.cx; }
  wy(py) { return this.cy - (py - this.H / 2) * this.res; }
  zicht(marge = 0) {
    const m = marge * this.res;
    return [this.wx(0) - m, this.wy(this.H) - m, this.wx(this.W) + m, this.wy(0) + m];
  }
  // transformatie zodat je direct in RD-meters kunt tekenen
  wereldTransform(ctx) {
    const s = this.dpr / this.res;
    ctx.setTransform(s, 0, 0, -s, this.dpr * (this.W / 2 - this.cx / this.res), this.dpr * (this.H / 2 + this.cy / this.res));
  }
  schermTransform(ctx) { ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); }

  zoomNaar(factor, px, py) {
    const wx = this.wx(px), wy = this.wy(py);
    this.res = Math.min(1500, Math.max(0.25, this.res * factor));
    this.cx = wx - (px - this.W / 2) * this.res;
    this.cy = wy + (py - this.H / 2) * this.res;
    this.vuil = true;
  }
  vliegNaar(x, y, res) { this.cx = x; this.cy = y; if (res) this.res = res; this.vuil = true; }

  invoer() {
    const el = this.boven;
    const pointers = new Map();
    let sleep = null, knijp = null, bewogen = 0;
    el.addEventListener('pointerdown', e => {
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      bewogen = 0;
      if (pointers.size === 1) sleep = { x: e.offsetX, y: e.offsetY, cx: this.cx, cy: this.cy };
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        knijp = { d: Math.hypot(a.x - b.x, a.y - b.y), res: this.res };
        sleep = null;
      }
    });
    el.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) { this.bijBeweeg?.(e.offsetX, e.offsetY); return; }
      pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      if (knijp && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const doel = knijp.res * knijp.d / d;
        this.zoomNaar(doel / this.res, (a.x + b.x) / 2, (a.y + b.y) / 2);
        bewogen = 99;
      } else if (sleep) {
        const dx = e.offsetX - sleep.x, dy = e.offsetY - sleep.y;
        bewogen = Math.max(bewogen, Math.hypot(dx, dy));
        if (bewogen > 4) {
          this.cx = sleep.cx - dx * this.res; this.cy = sleep.cy + dy * this.res; this.vuil = true;
        }
      }
    });
    const eind = e => {
      const was = pointers.has(e.pointerId);
      pointers.delete(e.pointerId);
      if (pointers.size < 2) knijp = null;
      if (was && pointers.size === 0 && bewogen <= 4 && e.type === 'pointerup') this.bijKlik?.(e.offsetX, e.offsetY, e);
      if (pointers.size === 0) sleep = null;
    };
    el.addEventListener('pointerup', eind);
    el.addEventListener('pointercancel', eind);
    el.addEventListener('wheel', e => { e.preventDefault(); this.zoomNaar(Math.exp(e.deltaY * 0.0015), e.offsetX, e.offsetY); }, { passive: false });
  }

  tegel(schema, z, x, y, jaar) {
    const sleutel = `${this.achtergrond}/${jaar}/${z}/${x}/${y}`;
    let t = this.tegels.get(sleutel);
    if (!t) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      t = { img, ok: false, fout: false, gebruikt: 0 };
      img.onload = () => { t.ok = true; this.vuil = true; };
      img.onerror = () => { t.fout = true; };
      img.src = schema.url(z, x, y, jaar);
      this.tegels.set(sleutel, t);
      if (this.tegels.size > 500) {
        const oud = [...this.tegels.entries()].sort((a, b) => a[1].gebruikt - b[1].gebruikt).slice(0, 150);
        for (const [k] of oud) this.tegels.delete(k);
      }
    }
    t.gebruikt = performance.now();
    return t;
  }

  tekenTegels() {
    const schema = ACHTERGRONDEN[this.achtergrond];
    if (!schema || !schema.res.length) return;
    const jaar = kaartjaarVoor(this.jaar);
    const doel = this.res / this.dpr * 1.2;
    let z = 0;
    for (let i = 0; i < schema.res.length; i++) if (schema.res[i] >= doel) z = i;
    const ctx = this.co;
    this.schermTransform(ctx);
    const teken = (z, metOuder) => {
      const tr = schema.res[z] * 256;
      const [x0, y0, x1, y1] = this.zicht();
      const i0 = Math.floor((x0 - schema.ox) / tr), i1 = Math.floor((x1 - schema.ox) / tr);
      const j0 = Math.floor((schema.oy - y1) / tr), j1 = Math.floor((schema.oy - y0) / tr);
      if ((i1 - i0 + 1) * (j1 - j0 + 1) > 400) return;
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const t = this.tegel(schema, z, i, j, jaar);
        const wx = schema.ox + i * tr, wy = schema.oy - j * tr;
        const px = this.sx(wx), py = this.sy(wy), pw = tr / this.res;
        if (t.ok) ctx.drawImage(t.img, px, py, pw + 0.5, pw + 0.5);
        else if (metOuder && z > 0) {
          // grovere tegel als tijdelijke vulling
          const tp = schema.res[z - 1] * 256;
          const pi = Math.floor((wx + tr / 2 - schema.ox) / tp), pj = Math.floor((schema.oy - wy + tr / 2) / tp);
          const ouder = this.tegels.get(`${this.achtergrond}/${jaar}/${z - 1}/${pi}/${pj}`);
          if (ouder?.ok) {
            const sx = ((wx - (schema.ox + pi * tp)) / tp) * 256, sy = (((schema.oy - pj * tp) - wy) / tp) * 256;
            ctx.drawImage(ouder.img, sx, sy, 128, 128, px, py, pw + 0.5, pw + 0.5);
          }
        }
      }
    };
    teken(z, true);
  }

  render() {
    if (this.vuil) {
      this.vuil = false;
      const ctx = this.co;
      this.schermTransform(ctx);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--kaartgrond') || '#e8ecea';
      ctx.fillRect(0, 0, this.W, this.H);
      this.tekenTegels();
      for (const laag of this.lagenOnder) { ctx.save(); laag(ctx, this); ctx.restore(); }
    }
    const cb = this.cb;
    this.schermTransform(cb);
    cb.clearRect(0, 0, this.W, this.H);
    for (const laag of this.lagenBoven) { cb.save(); laag(cb, this); cb.restore(); }
  }
}
