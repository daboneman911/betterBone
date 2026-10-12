import { state, save, exportJson, importJson, replaceState } from '../store.js';
import { icon, confirmSheet, toast } from '../ui.js';
import { go } from '../nav.js';

export function render(root) {
  const s = state.settings;
  root.innerHTML = `
    <div class="page">
      <header class="topbar slim">
        <button class="icon-btn" data-act="back" aria-label="Back">${icon('back')}</button>
        <h1>Settings</h1><span class="icon-btn-spacer"></span>
      </header>

      <section class="card list">
        <div class="row between"><span>Units</span>
          <div class="segmented" role="radiogroup" aria-label="Units">
            <button role="radio" aria-checked="${s.units === 'kg'}" data-units="kg">kg</button>
            <button role="radio" aria-checked="${s.units === 'lb'}" data-units="lb">lb</button>
          </div></div>
        <label class="row between"><span>Timer sounds<span class="muted small block">The iPhone silent switch also mutes these</span></span>
          <input type="checkbox" class="switch" id="sound" ${s.sound ? 'checked' : ''}></label>
        <a class="row between" href="#/onboarding"><span>Change goal, equipment or schedule</span>${icon('chevron', 18)}</a>
      </section>

      <section class="card list">
        <h3>Your data</h3>
        <p class="muted small">Everything is stored on this device only. Back it up before clearing Safari data or switching phones.</p>
        <button class="btn ghost block" data-act="export">Export backup</button>
        <label class="btn ghost block file-btn">Import backup<input type="file" accept="application/json,.json" id="importFile" hidden></label>
        <button class="btn danger-ghost block" data-act="reset">Erase everything</button>
      </section>

      <section class="card">
        <h3>About</h3>
        <p class="small muted">Exercise data and images: <a href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noopener">free-exercise-db</a> (public domain).</p>
        <p class="small muted" id="swStatus"></p>
      </section>
    </div>`;

  const swStatus = root.querySelector('#swStatus');
  if (!window.isSecureContext) swStatus.textContent = 'Offline mode: off (needs HTTPS or localhost).';
  else if (navigator.serviceWorker && navigator.serviceWorker.controller) swStatus.textContent = 'Offline mode: on.';
  else swStatus.textContent = 'Offline mode: will be ready after the next launch.';

  root.querySelector('#sound').addEventListener('change', e => { s.sound = e.target.checked; save(); });

  root.querySelector('#importFile').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!await confirmSheet('Replace everything on this device with the backup?', { ok: 'Replace', danger: true })) return;
    try {
      importJson(await file.text());
      toast('Backup restored');
      go('today');
    } catch (err) {
      console.error('[settings] import failed', err);
      toast(`Import failed: ${err.message}`);
    }
  });

  root.onclick = async e => {
    const u = e.target.closest('[data-units]');
    if (u) {
      s.units = u.dataset.units;
      save();
      render(root);
      return;
    }
    const act = e.target.closest('[data-act]');
    if (!act) return;
    switch (act.dataset.act) {
      case 'back':
        if (history.length > 1) history.back(); else go('today');
        break;
      case 'export':
        await exportBackup();
        break;
      case 'reset':
        if (await confirmSheet('Erase your plan, history and settings from this device? This can’t be undone.', { ok: 'Erase', danger: true })) {
          replaceState({});
          go('onboarding');
        }
        break;
    }
  };
  return () => { root.onclick = null; };
}

async function exportBackup() {
  const name = `repcoach-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([exportJson()], { type: 'application/json' });
  // On iPhone the share sheet is the natural way to put a file in Files/iCloud;
  // desktop browsers fall through to a normal download.
  try {
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'RepCoach backup' });
      return;
    }
  } catch (err) {
    if (err.name === 'AbortError') return;
    console.warn('[settings] share failed, falling back to download', err);
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`Saved ${name}`);
}
