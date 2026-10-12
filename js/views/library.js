import { state } from '../store.js';
import { allExercises } from '../data.js';
import { allowedEquipment } from '../planner.js';
import { BODY_PARTS, MUSCLE_TO_PART, CATEGORIES } from '../constants.js';
import { esc, icon, thumb, cap } from '../ui.js';

const PAGE = 40;

// Module-level so filters survive going into an exercise and back.
const f = { q: '', part: '', muscle: '', secondary: false, equipment: '', level: '', category: '', shown: PAGE };
let lastArg = null;

function musclesFor(part, muscle) {
  if (muscle) return [muscle];
  if (part) return BODY_PARTS.find(p => p.id === part).muscles;
  return null;
}

function matcher(overrides = {}) {
  const o = { ...f, ...overrides };
  const muscles = musclesFor(o.part, o.muscle);
  const mine = o.equipment === 'mine' && state.profile ? allowedEquipment(state.profile) : null;
  const tokens = o.q.toLowerCase().split(/\s+/).filter(Boolean);
  return e => {
    if (muscles) {
      const worked = o.secondary ? e.primary.concat(e.secondary) : e.primary;
      if (!worked.some(m => muscles.includes(m))) return false;
    }
    if (mine) { if (!mine.has(e.equipment)) return false; }
    else if (o.equipment && e.equipment !== o.equipment) return false;
    if (o.level && e.level !== o.level) return false;
    if (o.category && e.category !== o.category) return false;
    if (tokens.length) {
      const name = e.name.toLowerCase();
      if (!tokens.every(t => name.includes(t))) return false;
    }
    return true;
  };
}

// Route arg is either a body part id ("chest") or a single muscle ("m:biceps").
function applyArg(arg) {
  if (arg === lastArg) return;
  lastArg = arg;
  if (!arg) return;
  if (arg.startsWith('m:')) {
    const m = arg.slice(2);
    f.part = MUSCLE_TO_PART[m] || '';
    f.muscle = f.part ? m : '';
  } else if (BODY_PARTS.some(p => p.id === arg)) {
    f.part = arg;
    f.muscle = '';
  }
  f.shown = PAGE;
}

export function render(root, arg) {
  applyArg(arg);
  const all = allExercises();
  const equipmentValues = [...new Set(all.map(e => e.equipment))].sort();

  root.innerHTML = `
    <div class="page">
      <header class="topbar"><h1>Exercises</h1></header>
      <div class="search">${icon('search', 18)}<input type="search" id="q" placeholder="Search ${all.length} exercises" value="${esc(f.q)}" aria-label="Search exercises" autocomplete="off"></div>
      <div class="chips scroll" id="parts" role="group" aria-label="Body part"></div>
      <div class="chips scroll sub" id="muscles" role="group" aria-label="Muscle"></div>
      <div class="filter-row">
        <select id="equipment" aria-label="Equipment">
          <option value="">Any equipment</option>
          ${state.profile ? '<option value="mine">My equipment</option>' : ''}
          ${equipmentValues.map(v => `<option value="${esc(v)}">${esc(cap(v))}</option>`).join('')}
        </select>
        <select id="level" aria-label="Level">
          <option value="">Any level</option>
          <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="expert">Advanced</option>
        </select>
        <select id="category" aria-label="Type">
          <option value="">Any type</option>
          ${CATEGORIES.map(c => `<option value="${esc(c)}">${esc(cap(c))}</option>`).join('')}
        </select>
      </div>
      <label class="toggle"><input type="checkbox" id="secondary" ${f.secondary ? 'checked' : ''}><span>Include exercises that work it as a secondary muscle</span></label>
      <div class="row between results-head"><p class="muted small" id="count" aria-live="polite"></p>
        <button class="link small" id="clear" hidden>Clear filters</button></div>
      <ul class="ex-list" id="results"></ul>
      <button class="btn ghost block" id="more" hidden>Show more</button>
    </div>`;

  const $ = id => root.querySelector('#' + id);
  $('equipment').value = f.equipment;
  $('level').value = f.level;
  $('category').value = f.category;

  function update() {
    // Counts on the part chips reflect the other active filters, so you can see
    // e.g. how many glute exercises you can do with just dumbbells.
    const countFor = part => all.filter(matcher({ part, muscle: '' })).length;
    $('parts').innerHTML = [{ id: '', label: 'All' }, ...BODY_PARTS].map(p =>
      `<button class="chip" data-part="${p.id}" aria-pressed="${f.part === p.id}">${esc(p.label)} <span class="chip-n">${countFor(p.id)}</span></button>`).join('');

    const part = BODY_PARTS.find(p => p.id === f.part);
    $('muscles').hidden = !part || part.muscles.length < 2;
    if (part) {
      $('muscles').innerHTML = [`<button class="chip sm" data-muscle="" aria-pressed="${!f.muscle}">All ${esc(part.label.toLowerCase())}</button>`,
        ...part.muscles.map(m => `<button class="chip sm" data-muscle="${esc(m)}" aria-pressed="${f.muscle === m}">${esc(cap(m))}</button>`)].join('');
    }

    const results = all.filter(matcher());
    $('count').textContent = `${results.length} exercise${results.length === 1 ? '' : 's'}`;
    $('clear').hidden = !(f.q || f.part || f.equipment || f.level || f.category || f.secondary);
    $('results').innerHTML = results.slice(0, f.shown).map(e => `
      <li><a class="ex-link" href="#/exercise/${encodeURIComponent(e.id)}">
        ${thumb(e)}
        <span class="ex-text"><strong>${esc(e.name)}</strong>
          <span class="muted small">${esc(e.primary.map(cap).join(', '))} · ${esc(cap(e.equipment))} · ${esc(cap(e.level))}</span></span>
        ${icon('chevron', 18)}
      </a></li>`).join('') || '<li class="empty-row muted">No exercises match these filters.</li>';
    $('more').hidden = results.length <= f.shown;
  }

  const resetPage = () => { f.shown = PAGE; };
  $('q').addEventListener('input', e => { f.q = e.target.value; resetPage(); update(); });
  $('equipment').addEventListener('change', e => { f.equipment = e.target.value; resetPage(); update(); });
  $('level').addEventListener('change', e => { f.level = e.target.value; resetPage(); update(); });
  $('category').addEventListener('change', e => { f.category = e.target.value; resetPage(); update(); });
  $('secondary').addEventListener('change', e => { f.secondary = e.target.checked; resetPage(); update(); });
  $('more').addEventListener('click', () => { f.shown += PAGE; update(); });
  $('clear').addEventListener('click', () => {
    Object.assign(f, { q: '', part: '', muscle: '', secondary: false, equipment: '', level: '', category: '', shown: PAGE });
    render(root, '');
  });
  $('parts').addEventListener('click', e => {
    const b = e.target.closest('[data-part]');
    if (!b) return;
    f.part = b.dataset.part;
    f.muscle = '';
    resetPage();
    update();
  });
  $('muscles').addEventListener('click', e => {
    const b = e.target.closest('[data-muscle]');
    if (!b) return;
    f.muscle = b.dataset.muscle;
    resetPage();
    update();
  });

  update();
}
