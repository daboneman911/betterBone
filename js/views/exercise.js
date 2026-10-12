import { state, save, toDisplayWeight } from '../store.js';
import { getExercise } from '../data.js';
import { prescribe, isEligible } from '../planner.js';
import { esc, icon, animFrames, cap, fmtDate, toast } from '../ui.js';
import { lastPerformance } from '../history.js';
import { go } from '../nav.js';

export function render(root, id) {
  const ex = getExercise(id);
  if (!ex) {
    root.innerHTML = `<div class="page empty"><h1>Exercise not found</h1><a class="btn primary" href="#/library">Back to exercises</a></div>`;
    return;
  }
  const last = lastPerformance(ex.id);
  const unit = state.settings.units;
  const fits = state.profile && isEligible(ex, state.profile);
  const muscleChip = m => `<a class="chip" href="#/library/m:${encodeURIComponent(m)}">${esc(cap(m))}</a>`;

  root.innerHTML = `
    <div class="page">
      <header class="topbar slim">
        <button class="icon-btn" data-act="back" aria-label="Back">${icon('back')}</button>
      </header>
      ${animFrames(ex)}
      <h1>${esc(ex.name)}</h1>
      <div class="chips">
        <span class="chip static">${esc(cap(ex.level === 'expert' ? 'advanced' : ex.level))}</span>
        <span class="chip static">${esc(cap(ex.equipment))}</span>
        <span class="chip static">${esc(cap(ex.category))}</span>
        ${ex.mechanic ? `<span class="chip static">${esc(cap(ex.mechanic))}</span>` : ''}
      </div>

      <section class="card">
        <h3>Muscles</h3>
        <p class="small muted">Primary</p>
        <div class="chips">${ex.primary.map(muscleChip).join('')}</div>
        ${ex.secondary.length ? `<p class="small muted">Secondary</p><div class="chips">${ex.secondary.map(muscleChip).join('')}</div>` : ''}
      </section>

      ${last ? `<section class="card">
        <h3>Last time · ${esc(fmtDate(last.date))}</h3>
        <p>${esc(last.sets.map(s => (s.secs ? `${s.secs}s` : `${s.reps}${s.kg != null ? ` × ${toDisplayWeight(s.kg)} ${unit}` : ' reps'}`)).join(' · '))}</p>
      </section>` : ''}

      <section class="card">
        <h3>How to do it</h3>
        <ol class="steps">${ex.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
      </section>

      ${state.plan ? `<section class="card">
        <h3>Add to your plan</h3>
        ${fits ? '' : '<p class="small muted">Heads up: this needs equipment or a level outside your quiz answers.</p>'}
        <div class="row gap">
          <select id="addDay" aria-label="Plan day" class="grow">
            ${state.plan.days.map((d, i) => `<option value="${i}">Day ${i + 1} · ${esc(d.name)}</option>`).join('')}
          </select>
          <button class="btn primary" data-act="add">${icon('plus', 16)} Add</button>
        </div>
      </section>` : ''}
    </div>`;

  root.onclick = e => {
    const act = e.target.closest('[data-act]');
    if (!act) return;
    if (act.dataset.act === 'back') {
      if (history.length > 1) history.back(); else go('library');
    } else if (act.dataset.act === 'add') {
      const d = Number(root.querySelector('#addDay').value);
      const day = state.plan.days[d];
      if (day.items.some(i => i.id === ex.id)) { toast(`Already in ${day.name}`); return; }
      const kind = ex.category === 'stretching' ? 'stretch' : 'main';
      const item = { id: ex.id, slot: kind === 'stretch' ? 'stretch' : 'custom', kind, ...prescribe(ex, state.profile, kind) };
      // Keep the finisher and cool-down stretches at the end of the session.
      const tail = day.items.findIndex(i => i.kind === 'finisher' || i.kind === 'stretch');
      if (kind === 'main' && tail >= 0) day.items.splice(tail, 0, item);
      else day.items.push(item);
      if (save()) toast(`Added to ${day.name}`);
    }
  };
  return () => { root.onclick = null; };
}
