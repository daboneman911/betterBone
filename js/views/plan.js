import { state, save } from '../store.js';
import { allExercises, getExercise } from '../data.js';
import { buildPlan, estimateSeconds, prescribe, swapCandidates, SLOT_LABELS } from '../planner.js';
import { GOALS, LEVELS } from '../constants.js';
import { esc, icon, thumb, rxText, openSheet, confirmSheet, toast, cap } from '../ui.js';
import { startWorkout } from './workout.js';

export function render(root) {
  const p = state.profile;
  const goal = GOALS.find(g => g.id === p.goal);
  const level = LEVELS.find(l => l.id === p.level);

  function draw() {
    const plan = state.plan;
    root.innerHTML = `
      <div class="page">
        <header class="topbar">
          <div><p class="eyebrow">Your plan</p><h1>${plan.days.length} days a week</h1></div>
        </header>
        <p class="muted">${esc(goal ? goal.label : '')} · ${esc(level ? level.label : '')} · ${p.minutes} min sessions</p>
        <div class="row gap wrap">
          <a class="btn ghost sm" href="#/onboarding">Change answers</a>
          <button class="btn ghost sm" data-act="regen">Shuffle exercises</button>
        </div>

        ${plan.days.map((day, d) => `
          <section class="card day" data-day="${d}">
            <div class="row between">
              <div>
                <p class="eyebrow">Day ${d + 1}${d === plan.cursor % plan.days.length ? ' · <span class="accent">up next</span>' : ''}</p>
                <h2>${esc(day.name)}</h2>
                <p class="muted small">about ${Math.round(estimateSeconds(day.items) / 60)} min</p>
              </div>
              <button class="btn primary sm" data-act="start">${icon('play', 14)} Start</button>
            </div>
            <ul class="ex-list compact">
              ${day.items.map((it, i) => {
                const ex = getExercise(it.id);
                if (!ex) return '';
                return `<li class="ex-row" data-item="${i}">
                  <a class="ex-link" href="#/exercise/${encodeURIComponent(ex.id)}">
                    ${thumb(ex)}
                    <span class="ex-text"><strong>${esc(ex.name)}</strong>
                      <span class="muted small">${esc(SLOT_LABELS[it.slot] || cap(ex.primary[0]))} · ${esc(rxText(it))}</span></span>
                  </a>
                  <button class="icon-btn sm" data-act="swap" aria-label="Swap ${esc(ex.name)}">${icon('swap', 18)}</button>
                  <button class="icon-btn sm" data-act="remove" aria-label="Remove ${esc(ex.name)}">${icon('trash', 18)}</button>
                </li>`;
              }).join('')}
            </ul>
            <a class="link small" href="#/library">${icon('plus', 14)} Add from the exercise library</a>
          </section>`).join('')}
      </div>`;
  }

  function openSwap(d, i) {
    const day = state.plan.days[d];
    const item = day.items[i];
    const current = getExercise(item.id);
    const cands = swapCandidates(item, day, p, allExercises());
    const list = q => cands
      .filter(e => !q || e.name.toLowerCase().includes(q))
      .map(e => `<li><button class="ex-pick" data-id="${esc(e.id)}">${thumb(e)}
          <span class="ex-text"><strong>${esc(e.name)}</strong><span class="muted small">${esc(cap(e.equipment))} · ${esc(cap(e.level))}</span></span>
        </button></li>`).join('') || '<li class="muted pad">No alternatives match your equipment and level.</li>';

    const { el, close } = openSheet(`
      <h3>Swap ${esc(current ? current.name : 'exercise')}</h3>
      <p class="muted small">${cands.length} alternatives for ${esc((SLOT_LABELS[item.slot] || 'this muscle').toLowerCase())} with your equipment</p>
      <div class="search">${icon('search', 18)}<input type="search" placeholder="Filter" aria-label="Filter alternatives"></div>
      <ul class="ex-list sheet-list">${list('')}</ul>`, { label: 'Swap exercise' });

    el.querySelector('input').addEventListener('input', e => {
      el.querySelector('.sheet-list').innerHTML = list(e.target.value.trim().toLowerCase());
    });
    el.addEventListener('click', e => {
      const b = e.target.closest('.ex-pick');
      if (!b) return;
      const ex = getExercise(b.dataset.id);
      const kind = item.kind === 'stretch' || item.kind === 'finisher' ? item.kind : 'main';
      day.items[i] = { ...item, id: ex.id, ...prescribe(ex, p, kind) };
      save();
      close();
      draw();
      toast(`Swapped in ${ex.name}`);
    });
  }

  root.onclick = async e => {
    const act = e.target.closest('[data-act]');
    if (!act) return;
    const dayEl = act.closest('[data-day]');
    const d = dayEl ? Number(dayEl.dataset.day) : -1;
    const rowEl = act.closest('[data-item]');
    const i = rowEl ? Number(rowEl.dataset.item) : -1;

    switch (act.dataset.act) {
      case 'start':
        startWorkout(d);
        break;
      case 'swap':
        openSwap(d, i);
        break;
      case 'remove': {
        const day = state.plan.days[d];
        if (day.items.length <= 1) { toast('A day needs at least one exercise'); return; }
        const [removed] = day.items.splice(i, 1);
        save();
        draw();
        const ex = getExercise(removed.id);
        toast(`Removed ${ex ? ex.name : 'exercise'}`);
        break;
      }
      case 'regen':
        if (await confirmSheet('Pick new exercises for every day? Your swaps and additions will be replaced. Workout history is kept.', { ok: 'Shuffle' })) {
          const cursor = state.plan.cursor;
          state.plan = buildPlan(p, allExercises());
          state.plan.cursor = cursor % state.plan.days.length;
          save();
          draw();
          toast('Plan shuffled');
        }
        break;
    }
  };

  draw();
  return () => { root.onclick = null; };
}
