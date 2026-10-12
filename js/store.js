// Everything lives in one localStorage key. The data is small (a plan plus a log)
// and a single synchronous blob is much simpler to back up and restore than IndexedDB.
// 'repcoach' is the app's original name. It stays in this key, the backup
// format and the cache names so existing installs and backups keep working.
const KEY = 'repcoach:v1';

const defaults = () => ({
  profile: null,       // quiz answers
  plan: null,          // generated plan, editable
  history: [],         // completed workouts
  bodyweight: [],      // { date, kg }
  settings: { units: 'kg', sound: true },
  active: null,        // in-progress workout, persisted so iOS killing the tab doesn't lose it
});

export const state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      return { ...defaults(), ...saved, settings: { ...defaults().settings, ...saved.settings } };
    }
  } catch (err) {
    console.error('[store] could not read saved data, starting fresh', err);
  }
  return defaults();
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.error('[store] save failed', err);
    window.dispatchEvent(new CustomEvent('store-error', { detail: err }));
    return false;
  }
}

export function replaceState(next) {
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, defaults(), next, { settings: { ...defaults().settings, ...(next && next.settings) } });
  return save();
}

export function exportJson() {
  return JSON.stringify({ app: 'repcoach', version: 1, exportedAt: new Date().toISOString(), data: state }, null, 2);
}

export function importJson(text) {
  const parsed = JSON.parse(text);
  if (!parsed || parsed.app !== 'repcoach' || !parsed.data) throw new Error('Not a betterBone backup file');
  return replaceState(parsed.data);
}

// Safari evicts storage for sites that haven't been used in a while unless the
// origin is persistent; installed home-screen apps usually get this granted.
export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      const granted = await navigator.storage.persist();
      console.info('[store] persistent storage', granted ? 'granted' : 'not granted');
    }
  } catch (err) {
    console.warn('[store] persist() failed', err);
  }
}

// Weights are stored in kg; the UI converts at the edges.
export const KG_PER_LB = 0.45359237;
// Lifting weights snap to 0.5 (plates); bodyweight passes step 0.1.
export function toDisplayWeight(kg, step = 0.5) {
  if (kg == null) return '';
  const v = state.settings.units === 'lb' ? kg / KG_PER_LB : kg;
  return String(Math.round(v / step) * step).replace(/(\.\d)\d+$/, '$1');
}
export function fromDisplayWeight(value) {
  const n = parseFloat(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return state.settings.units === 'lb' ? n * KG_PER_LB : n;
}
