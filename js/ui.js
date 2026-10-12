import { imgUrl } from './data.js';

export function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

export function fmtClock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function fmtDate(iso, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return new Date(iso).toLocaleDateString(undefined, opts);
}

export function rxText(item) {
  const work = item.hold ? `${item.hold}s` : `${item.reps} reps`;
  const sets = item.sets > 1 ? `${item.sets} × ${work}` : work;
  return item.rest ? `${sets} · rest ${item.rest}s` : sets;
}

// crossorigin lets the service worker cache a real (non-opaque) response;
// opaque responses are padded to several MB each against the storage quota.
export function thumb(ex, cls = 'thumb') {
  if (!ex || !ex.images.length) return `<div class="${cls} thumb-empty"></div>`;
  return `<img class="${cls}" src="${esc(imgUrl(ex.images[0]))}" alt="" loading="lazy" crossorigin="anonymous" decoding="async">`;
}

// Two-frame "animation" (start/end position), CSS-only so it costs nothing per frame.
export function animFrames(ex) {
  if (!ex || !ex.images.length) return `<div class="frames thumb-empty"></div>`;
  const [a, b] = ex.images;
  return `<div class="frames${b ? ' two' : ''}">
    <img src="${esc(imgUrl(a))}" alt="${esc(ex.name)}, start position" crossorigin="anonymous">
    ${b ? `<img src="${esc(imgUrl(b))}" alt="${esc(ex.name)}, end position" crossorigin="anonymous">` : ''}
  </div>`;
}

let toastTimer;
export function toast(message) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// Bottom sheet. Returns { el, close }. Closing via backdrop or Escape calls onClose.
export function openSheet(innerHtml, { onClose, label = 'Dialog' } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-backdrop"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}">
      <div class="sheet-grip"></div>${innerHtml}
    </div>`;
  document.body.appendChild(wrap);
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => wrap.classList.add('open'));

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    document.body.classList.remove('no-scroll');
    wrap.classList.remove('open');
    setTimeout(() => wrap.remove(), 220);
    if (onClose) onClose();
  };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  wrap.querySelector('.sheet-backdrop').addEventListener('click', close);
  return { el: wrap.querySelector('.sheet'), close };
}

// In-page confirm: native confirm() is ugly and blocks timers on iOS.
export function confirmSheet(message, { ok = 'OK', danger = false } = {}) {
  return new Promise(resolve => {
    let answered = false;
    const { el, close } = openSheet(`
      <p class="sheet-msg">${esc(message)}</p>
      <div class="row gap">
        <button class="btn ghost grow" data-a="no">Cancel</button>
        <button class="btn ${danger ? 'danger' : 'primary'} grow" data-a="yes">${esc(ok)}</button>
      </div>`, { label: 'Confirm', onClose: () => { if (!answered) resolve(false); } });
    el.addEventListener('click', e => {
      const a = e.target.closest('[data-a]');
      if (!a) return;
      answered = true;
      resolve(a.dataset.a === 'yes');
      close();
    });
  });
}

const ICON_PATHS = {
  today: '<path d="M8 2v4M16 2v4M3 10h18"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="m9 16 2 2 4-4"/>',
  plan: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01" stroke-width="3"/>',
  library: '<path d="M6.5 6.5h11M6.5 17.5h11"/><rect x="2" y="8" width="4" height="8" rx="1"/><rect x="18" y="8" width="4" height="8" rx="1"/><path d="M6 12h12"/>',
  progress: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  swap: '<path d="M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  play: '<path d="m7 4 13 8-13 8z" fill="currentColor"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  prev: '<path d="m11 17-5-5 5-5M18 17l-5-5 5-5"/>',
  next: '<path d="m13 17 5-5-5-5M6 17l5-5-5-5"/>',
};

export function icon(name, size = 22) {
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;
}
