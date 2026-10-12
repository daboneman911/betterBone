// Two tiny single-series SVG charts. Sized from the container at draw time and
// redrawn on resize, so text never stretches the way a scaled viewBox would.
import { esc } from './ui.js';

const H = 168;
const PAD = { l: 34, r: 12, t: 16, b: 26 };

function niceStep(max, target = 3) {
  const raw = max / target;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  return [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || mag * 10;
}

function frame(container, title) {
  container.classList.add('chart');
  container.innerHTML = `<svg role="img" aria-label="${esc(title)}" width="100%" height="${H}"></svg><div class="chart-tip" hidden></div>`;
  return { svg: container.querySelector('svg'), tip: container.querySelector('.chart-tip'), W: Math.max(240, container.clientWidth) };
}

function showTip(container, tip, html, x, y) {
  tip.innerHTML = html;
  tip.hidden = false;
  const w = tip.offsetWidth;
  const left = Math.min(Math.max(0, x - w / 2), container.clientWidth - w);
  tip.style.left = `${left}px`;
  tip.style.top = `${Math.max(0, y - tip.offsetHeight - 10)}px`;
}

function gridAndTicks(W, min, max, step, fmt) {
  const y = v => PAD.t + (H - PAD.t - PAD.b) * (1 - (v - min) / (max - min || 1));
  let out = '';
  for (let v = min; v <= max + 1e-9; v += step) {
    out += `<line class="grid" x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(v)}" y2="${y(v)}"/>
      <text class="tick" x="${PAD.l - 6}" y="${y(v) + 4}" text-anchor="end">${esc(fmt(v))}</text>`;
  }
  return { out, y };
}

// Columns: data = [{ label, value, tip }]
export function columnChart(container, data, { title, latestLabel }) {
  const draw = () => {
    const { svg, tip, W } = frame(container, title);
    const maxV = Math.max(1, ...data.map(d => d.value));
    const step = Math.max(1, Math.ceil(maxV / 3));
    const top = step * Math.ceil(maxV / step);
    const { out, y } = gridAndTicks(W, 0, top, step, v => String(v));
    const band = (W - PAD.l - PAD.r) / data.length;
    const bw = Math.min(24, band * 0.6);
    const base = y(0);
    const everyOther = band < 34;

    const bars = data.map((d, i) => {
      const x = PAD.l + band * i + (band - bw) / 2;
      const yt = y(d.value);
      const h = base - yt;
      const r = Math.min(4, h, bw / 2);
      // Rounded at the data end, square at the baseline.
      const path = h > 0
        ? `<path class="mark" d="M${x},${base} V${yt + r} Q${x},${yt} ${x + r},${yt} H${x + bw - r} Q${x + bw},${yt} ${x + bw},${yt + r} V${base} Z"/>`
        : '';
      const lbl = !everyOther || i % 2 === data.length % 2 || i === data.length - 1
        ? `<text class="tick" x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${esc(d.label)}</text>` : '';
      const cap = i === data.length - 1 && latestLabel
        ? `<text class="value-label" x="${x + bw / 2}" y="${yt - 6}" text-anchor="middle">${esc(String(d.value))}</text>` : '';
      return `${path}${lbl}${cap}<rect class="hit" data-i="${i}" x="${PAD.l + band * i}" y="${PAD.t}" width="${band}" height="${base - PAD.t}"/>`;
    }).join('');
    svg.innerHTML = `${out}<line class="axis" x1="${PAD.l}" x2="${W - PAD.r}" y1="${base}" y2="${base}"/>${bars}`;

    const onMove = e => {
      const hit = e.target.closest && e.target.closest('.hit');
      if (!hit) { tip.hidden = true; return; }
      const d = data[Number(hit.dataset.i)];
      const x = PAD.l + band * Number(hit.dataset.i) + band / 2;
      showTip(container, tip, d.tip, x, y(d.value));
    };
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerdown', onMove);
    svg.addEventListener('pointerleave', () => { tip.hidden = true; });
  };
  return observe(container, draw);
}

// Line: points = [{ t: Date, v: number, tip }], sorted by t.
export function lineChart(container, points, { title, fmt = v => String(v) }) {
  const draw = () => {
    const { svg, tip, W } = frame(container, title);
    const vs = points.map(p => p.v);
    let lo = Math.min(...vs), hi = Math.max(...vs);
    if (hi - lo < 2) { lo -= 1; hi += 1; }
    const step = niceStep(hi - lo);
    lo = Math.floor(lo / step) * step;
    hi = Math.ceil(hi / step) * step;
    const { out, y } = gridAndTicks(W, lo, hi, step, v => fmt(v));
    const t0 = points[0].t.getTime();
    const t1 = points[points.length - 1].t.getTime();
    const x = t => PAD.l + 6 + (W - PAD.l - PAD.r - 12) * ((t.getTime() - t0) / (t1 - t0 || 1));
    const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
    const last = points[points.length - 1];
    const fmtDay = t => t.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

    svg.innerHTML = `${out}
      <text class="tick" x="${x(points[0].t)}" y="${H - 8}" text-anchor="start">${esc(fmtDay(points[0].t))}</text>
      <text class="tick" x="${x(last.t)}" y="${H - 8}" text-anchor="end">${esc(fmtDay(last.t))}</text>
      <path class="line" d="${d}"/>
      <line class="crosshair" y1="${PAD.t}" y2="${H - PAD.b}" visibility="hidden"/>
      <circle class="dot hover-dot" r="5" visibility="hidden"/>
      <circle class="dot" cx="${x(last.t)}" cy="${y(last.v)}" r="5"/>
      <text class="value-label" x="${x(last.t)}" y="${y(last.v) - 12}" text-anchor="end">${esc(fmt(last.v))}</text>
      <rect class="hit" x="${PAD.l}" y="0" width="${W - PAD.l - PAD.r}" height="${H}"/>`;

    const cross = svg.querySelector('.crosshair');
    const hover = svg.querySelector('.hover-dot');
    const onMove = e => {
      const rect = svg.getBoundingClientRect();
      const px = e.clientX - rect.left;
      let best = 0;
      points.forEach((p, i) => { if (Math.abs(x(p.t) - px) < Math.abs(x(points[best].t) - px)) best = i; });
      const p = points[best];
      cross.setAttribute('x1', x(p.t)); cross.setAttribute('x2', x(p.t)); cross.setAttribute('visibility', 'visible');
      hover.setAttribute('cx', x(p.t)); hover.setAttribute('cy', y(p.v)); hover.setAttribute('visibility', 'visible');
      showTip(container, tip, p.tip, x(p.t), y(p.v));
    };
    const hide = () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); hover.setAttribute('visibility', 'hidden'); };
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerdown', onMove);
    svg.addEventListener('pointerleave', hide);
  };
  return observe(container, draw);
}

function observe(container, draw) {
  draw();
  let lastW = container.clientWidth;
  const ro = new ResizeObserver(() => {
    if (Math.abs(container.clientWidth - lastW) > 4) { lastW = container.clientWidth; draw(); }
  });
  ro.observe(container);
  return () => ro.disconnect();
}
