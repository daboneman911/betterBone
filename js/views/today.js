import { state } from '../store.js';
import { getExercise } from '../data.js';
import { estimateSeconds } from '../planner.js';
import { BODY_PARTS, MUSCLE_TO_PART } from '../constants.js';
import { esc, icon, fmtDate } from '../ui.js';
import { daysTrainedThisWeek, startOfWeek, localDay, weekStreak } from '../history.js';
import { startWorkout } from './workout.js';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export function partsTrained(items) {
  const ids = new Set(items.filter(i => i.kind === 'main')
    .map(i => getExercise(i.id)).filter(Boolean).map(e => MUSCLE_TO_PART[e.primary[0]]));
  return BODY_PARTS.filter(p => ids.has(p.id));
}

export function render(root) {
  const plan = state.plan;
  const idx = plan.cursor % plan.days.length;
  const day = plan.days[idx];
  const main = day.items.filter(i => i.kind === 'main');
  const mins = Math.round(estimateSeconds(day.items) / 60);
  const parts = partsTrained(day.items);

  const trained = daysTrainedThisWeek();
  const monday = startOfWeek(new Date());
  const todayKey = localDay(new Date());
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const key = localDay(d);
    return { label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), done: trained.has(key), today: key === todayKey };
  });
  const streak = weekStreak();

  root.innerHTML = `
    <div class="page">
      <header class="topbar">
        <div>
          <p class="eyebrow">${esc(fmtDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' }))}</p>
          <h1>${greeting()}</h1>
        </div>
        <a class="icon-btn" href="#/settings" aria-label="Settings">${icon('settings')}</a>
      </header>

      ${state.active ? `
        <section class="card resume">
          <div>
            <p class="eyebrow">In progress</p>
            <h2>${esc(state.active.dayName)}</h2>
          </div>
          <a class="btn primary" href="#/workout">Resume</a>
        </section>` : ''}

      <section class="card hero">
        <p class="eyebrow">Up next · day ${idx + 1} of ${plan.days.length}</p>
        <h2 class="hero-title">${esc(day.name)}</h2>
        <p class="muted">${main.length} exercises · about ${mins} min</p>
        <div class="chips">${parts.map(p => `<span class="chip static">${esc(p.label)}</span>`).join('')}</div>
        <ol class="mini-list">
          ${day.items.map(i => {
            const ex = getExercise(i.id);
            return ex ? `<li><span>${esc(ex.name)}</span><span class="muted small">${i.kind === 'stretch' ? 'stretch' : i.kind === 'finisher' ? 'finisher' : `${i.sets}×`}</span></li>` : '';
          }).join('')}
        </ol>
        <button class="btn primary block lg" data-start>${icon('play', 18)} Start workout</button>
        <a class="link center" href="#/plan">View or edit the full plan</a>
      </section>

      <section class="card">
        <div class="row between">
          <h3>This week</h3>
          <span class="muted small">${trained.size} of ${plan.days.length} done${streak > 1 ? ` · ${streak}-week streak` : ''}</span>
        </div>
        <div class="week">
          ${week.map(d => `<div class="week-day${d.done ? ' done' : ''}${d.today ? ' today' : ''}">
            <span class="small muted">${esc(d.label)}</span>
            <span class="dot">${d.done ? icon('check', 14) : ''}</span>
          </div>`).join('')}
        </div>
      </section>

      <section>
        <h3 class="section-title">Browse by body part</h3>
        <div class="part-grid">
          ${BODY_PARTS.map(p => `<a class="part-tile" href="#/library/${p.id}">${esc(p.label)}${icon('chevron', 16)}</a>`).join('')}
        </div>
      </section>
    </div>`;

  root.querySelector('[data-start]').addEventListener('click', () => startWorkout(idx));
}
