import { state } from '../store.js';
import { getExercise } from '../data.js';
import { estimateSeconds } from '../planner.js';
import { BW_GROUPS, BW_WORKOUTS, buildBodyweightDay } from '../bodyweight.js';
import { esc, icon, thumb, cap } from '../ui.js';
import { go } from '../nav.js';
import { startWorkout } from './workout.js';

const levelLabel = l => (l === 'expert' ? 'Advanced' : cap(l));

export function render(root) {
  const profile = state.profile;
  const days = BW_WORKOUTS.map(w => buildBodyweightDay(w, profile, getExercise));

  const workoutCard = (w, i) => {
    const day = days[i];
    const main = day.items.filter(it => it.kind === 'main').map(it => getExercise(it.id).name);
    return `<section class="card">
      <div class="row between"><h3>${esc(w.name)}</h3>
        <span class="muted small">~${Math.round(estimateSeconds(day.items) / 60)} min</span></div>
      <p class="muted small">${esc(w.blurb)}</p>
      <p class="small">${esc(main.join(' · '))}</p>
      <button class="btn primary block" data-start="${i}">${icon('play', 16)} Start</button>
    </section>`;
  };

  const group = g => `
    <h2 class="section-title" id="bw-${g.id}">${esc(g.label)} <span class="muted small">${esc(g.blurb)}</span></h2>
    <ul class="ex-list card">${g.items.map(item => {
      const e = getExercise(item.id);
      if (!e) return '';
      const meta = [item.note, levelLabel(e.level), item.needs].filter(Boolean).join(' · ');
      return `<li><a class="ex-link" href="#/exercise/${encodeURIComponent(e.id)}">
        ${thumb(e)}
        <span class="ex-text"><strong>${esc(e.name)}</strong><span class="muted small">${esc(meta)}</span></span>
        ${icon('chevron', 18)}
      </a></li>`;
    }).join('')}</ul>`;

  root.innerHTML = `
    <div class="page">
      <header class="topbar slim">
        <button class="icon-btn" data-act="back" aria-label="Back">${icon('back')}</button>
      </header>
      <h1>Bodyweight</h1>
      <p class="muted">No equipment. Focused on legs, glutes &amp; hips, and chest, listed easiest to hardest.
        ${profile.level === 'beginner' ? 'The workouts use easier versions because your level is set to beginner.' : ''}</p>
      <div class="chips">${BW_GROUPS.map(g => `<a class="chip" href="#/bodyweight" data-jump="${g.id}">${esc(g.label)}</a>`).join('')}</div>
      <h2 class="section-title">Quick workouts</h2>
      ${BW_WORKOUTS.map(workoutCard).join('')}
      ${BW_GROUPS.map(group).join('')}
    </div>`;

  root.onclick = e => {
    const start = e.target.closest('[data-start]');
    if (start) { startWorkout(null, days[Number(start.dataset.start)]); return; }
    const jump = e.target.closest('[data-jump]');
    if (jump) {
      e.preventDefault();
      root.querySelector(`#bw-${jump.dataset.jump}`).scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (e.target.closest('[data-act="back"]')) {
      if (history.length > 1) history.back(); else go('library');
    }
  };
  return () => { root.onclick = null; };
}
