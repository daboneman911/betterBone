import { state, save } from '../store.js';
import { allExercises } from '../data.js';
import { buildPlan } from '../planner.js';
import { GOALS, LEVELS, EQUIPMENT_OPTIONS, DAYS_OPTIONS, MINUTES_OPTIONS, BODY_PARTS } from '../constants.js';
import { esc, icon, toast } from '../ui.js';
import { go } from '../nav.js';

const SPLIT_HINT = {
  2: 'Two full-body sessions', 3: 'Three full-body sessions', 4: 'Upper / lower split',
  5: 'Push, pull, legs, upper, lower', 6: 'Push, pull, legs twice',
};

const STEPS = [
  { key: 'goal', title: 'What’s your main goal?', type: 'single',
    options: GOALS.map(g => ({ value: g.id, label: g.label, hint: g.hint })) },
  { key: 'level', title: 'How experienced are you?', type: 'single',
    options: LEVELS.map(l => ({ value: l.id, label: l.label, hint: l.hint })) },
  { key: 'equipment', title: 'What equipment can you use?', sub: 'Bodyweight exercises are always included. Pick all that apply.', type: 'multi',
    options: EQUIPMENT_OPTIONS.map(o => ({ value: o.id, label: o.label })) },
  { key: 'days', title: 'How many days a week?', type: 'single',
    options: DAYS_OPTIONS.map(d => ({ value: d, label: `${d} days`, hint: SPLIT_HINT[d] })) },
  { key: 'minutes', title: 'How long per session?', type: 'single',
    options: MINUTES_OPTIONS.map(m => ({ value: m, label: `${m} minutes` })) },
  { key: 'focus', title: 'Any areas to focus on?', sub: 'Optional, up to two. They get an extra exercise on days that already train them.', type: 'multi', max: 2,
    options: BODY_PARTS.map(p => ({ value: p.id, label: p.label })) },
];

export function render(root) {
  const editing = !!state.profile;
  const draft = editing
    ? { ...state.profile, equipment: [...state.profile.equipment], focus: [...(state.profile.focus || [])] }
    : { goal: null, level: null, equipment: [], days: null, minutes: null, focus: [] };
  let step = 0;
  let advancing = false;

  const answered = s => (s.type === 'multi' ? true : draft[s.key] != null);

  function draw() {
    const s = STEPS[step];
    const pct = Math.round(((step + 1) / STEPS.length) * 100);
    const chosen = v => (s.type === 'multi' ? draft[s.key].includes(v) : draft[s.key] === v);
    root.innerHTML = `
      <div class="page quiz">
        <div class="quiz-top">
          ${step > 0 || editing
            ? `<button class="icon-btn" data-back aria-label="Back">${icon('back')}</button>`
            : '<span class="icon-btn-spacer"></span>'}
          <div class="progress-track" role="progressbar" aria-valuenow="${step + 1}" aria-valuemin="1" aria-valuemax="${STEPS.length}">
            <div class="progress-fill" style="width:${pct}%"></div>
          </div>
          <span class="muted small">${step + 1}/${STEPS.length}</span>
        </div>
        ${step === 0 && !editing ? '<p class="eyebrow">Let’s build your plan</p>' : ''}
        <h1>${esc(s.title)}</h1>
        ${s.sub ? `<p class="muted">${esc(s.sub)}</p>` : ''}
        <div class="options" role="${s.type === 'multi' ? 'group' : 'radiogroup'}">
          ${s.options.map((o, i) => `
            <button class="option${chosen(o.value) ? ' selected' : ''}" data-i="${i}"
              role="${s.type === 'multi' ? 'checkbox' : 'radio'}" aria-checked="${chosen(o.value)}">
              <span class="option-text"><strong>${esc(o.label)}</strong>${o.hint ? `<span class="muted small">${esc(o.hint)}</span>` : ''}</span>
              <span class="option-mark">${icon('check', 18)}</span>
            </button>`).join('')}
        </div>
        <div class="quiz-actions">
          ${s.type === 'multi' || editing
            ? `<button class="btn primary block" data-next ${answered(s) ? '' : 'disabled'}>
                 ${step === STEPS.length - 1 ? (editing ? 'Rebuild my plan' : 'Build my plan') : 'Continue'}</button>`
            : ''}
        </div>
      </div>`;
  }

  function finish() {
    const profile = { ...draft, createdAt: (state.profile && state.profile.createdAt) || new Date().toISOString() };
    state.profile = profile;
    state.plan = buildPlan(profile, allExercises());
    save();
    toast(editing ? 'New plan built' : 'Your plan is ready');
    go('today');
  }

  function next() {
    if (step === STEPS.length - 1) finish();
    else { step++; draw(); window.scrollTo(0, 0); }
  }

  root.onclick = e => {
    if (e.target.closest('[data-back]')) {
      if (step === 0) { go('settings'); return; }
      step--; draw(); return;
    }
    if (e.target.closest('[data-next]')) { next(); return; }
    const opt = e.target.closest('.option');
    if (!opt) return;
    const s = STEPS[step];
    const value = s.options[Number(opt.dataset.i)].value;
    if (s.type === 'single') {
      if (advancing) return; // a fast double-tap would otherwise skip a question
      draft[s.key] = value;
      // Single-choice steps advance on tap for first-time setup; when editing,
      // show the selection and let them press Continue so nothing jumps.
      if (editing) { draw(); return; }
      opt.classList.add('selected');
      advancing = true;
      setTimeout(() => { advancing = false; next(); }, 160);
    } else {
      const list = draft[s.key];
      const at = list.indexOf(value);
      if (at >= 0) list.splice(at, 1);
      else if (s.max && list.length >= s.max) { toast(`Pick up to ${s.max}`); return; }
      else list.push(value);
      draw();
    }
  };

  draw();
  return () => { root.onclick = null; };
}
