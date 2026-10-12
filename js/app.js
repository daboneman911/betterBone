import { loadExercises } from './data.js';
import { state, requestPersistence } from './store.js';
import { currentRoute, go } from './nav.js';
import { esc, icon, toast } from './ui.js';
import * as onboarding from './views/onboarding.js';
import * as today from './views/today.js';
import * as plan from './views/plan.js';
import * as library from './views/library.js';
import * as exercise from './views/exercise.js';
import * as workout from './views/workout.js';
import * as progress from './views/progress.js';
import * as settings from './views/settings.js';

const views = { onboarding, today, plan, library, exercise, workout, progress, settings };
const FULLSCREEN = new Set(['onboarding', 'workout']);
const TABS = [
  ['today', 'Today'], ['plan', 'Plan'], ['library', 'Exercises'], ['progress', 'Progress'],
];

const root = document.getElementById('app');
const tabbar = document.getElementById('tabbar');
const scrollMemory = {};
let teardown = null;
let lastKey = null;

function render() {
  const { name, arg } = currentRoute();
  if (!state.profile && name !== 'onboarding') return go('onboarding');
  const view = views[name] ? name : 'today';

  if (lastKey) scrollMemory[lastKey] = window.scrollY;
  if (teardown) {
    try { teardown(); } catch (err) { console.error('[router] teardown failed', err); }
    teardown = null;
  }

  tabbar.hidden = FULLSCREEN.has(view);
  document.body.dataset.view = view;
  const activeTab = view === 'exercise' ? 'library' : view;
  for (const a of tabbar.querySelectorAll('a')) {
    const on = a.dataset.tab === activeTab;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }

  try {
    teardown = views[view].render(root, arg) || null;
  } catch (err) {
    console.error(`[router] ${view} failed to render`, err);
    root.innerHTML = `<div class="page"><h1>Something went wrong</h1>
      <p class="muted">${esc(err.message)}</p>
      <a class="btn primary" href="#/today">Back to Today</a></div>`;
  }

  const key = `${view}/${arg}`;
  // Coming back to the library from an exercise should land where you left off.
  window.scrollTo(0, view === 'library' ? scrollMemory[key] || 0 : 0);
  lastKey = key;
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (!window.isSecureContext) {
    // Plain http over the LAN (testing from an iPhone against the dev server) lands here.
    console.info('[sw] not a secure context; offline support disabled for this session');
    return;
  }
  navigator.serviceWorker.register('sw.js').then(
    // Some embedded/automated browsers resolve with no registration instead of rejecting.
    reg => console.info('[sw] registered, scope', reg ? reg.scope : '(none returned)'),
    err => console.error('[sw] registration failed', err),
  );
}

async function boot() {
  tabbar.innerHTML = TABS.map(([id, label]) =>
    `<a href="#/${id}" data-tab="${id}">${icon(id === 'library' ? 'library' : id)}<span>${label}</span></a>`).join('');

  try {
    await loadExercises();
  } catch (err) {
    console.error('[boot] could not load exercise data', err);
    root.innerHTML = `<div class="page"><h1>Couldn't load exercises</h1>
      <p class="muted">${esc(err.message)}. If this is the first launch, you need a connection once.</p>
      <button class="btn primary" onclick="location.reload()">Try again</button></div>`;
    return;
  }

  window.addEventListener('hashchange', render);
  window.addEventListener('store-error', () => toast('Couldn’t save — storage is full or blocked'));
  render();
  requestPersistence();
  registerServiceWorker();
}

boot();
