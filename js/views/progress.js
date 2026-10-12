import { state, save, toDisplayWeight, fromDisplayWeight } from '../store.js';
import { esc, icon, fmtDate, fmtClock, confirmSheet, toast } from '../ui.js';
import { weeklyCounts, weekStreak, localDay, startOfWeek, volumeKg } from '../history.js';
import { columnChart, lineChart } from '../charts.js';

// Bodyweight dates are local 'YYYY-MM-DD'; parsed bare they'd be UTC midnight
// and show as the previous day anywhere west of Greenwich.
const noon = day => `${day}T12:00:00`;

export function render(root) {
  const cleanups = [];
  const unit = state.settings.units;

  function draw() {
    cleanups.splice(0).forEach(fn => fn());
    const total = state.history.length;
    const thisWeek = state.history.filter(h => new Date(h.date) >= startOfWeek(new Date())).length;
    const streak = weekStreak();
    const bw = [...state.bodyweight].sort((a, b) => a.date.localeCompare(b.date));
    const history = [...state.history].reverse();

    root.innerHTML = `
      <div class="page">
        <header class="topbar"><h1>Progress</h1>
          <a class="icon-btn" href="#/settings" aria-label="Settings">${icon('settings')}</a></header>

        <div class="stat-row">
          <div class="stat"><span class="stat-label">Workouts</span><span class="stat-value">${total}</span></div>
          <div class="stat"><span class="stat-label">This week</span><span class="stat-value">${thisWeek}<span class="stat-of"> / ${state.plan ? state.plan.days.length : '–'}</span></span></div>
          <div class="stat"><span class="stat-label">Week streak</span><span class="stat-value">${streak}</span></div>
        </div>

        <section class="card">
          <h3>Workouts per week</h3>
          <p class="muted small">Last 8 weeks</p>
          <div id="weeks"></div>
        </section>

        <section class="card">
          <h3>Bodyweight</h3>
          <form class="row gap" id="bwForm">
            <input id="bwIn" class="grow" type="number" inputmode="decimal" step="0.1" min="0" placeholder="Today’s weight (${unit})" aria-label="Bodyweight in ${unit}">
            <button class="btn primary">Log</button>
          </form>
          ${bw.length >= 2 ? '<div id="bwChart"></div>' : '<p class="muted small">Log at least two days to see a trend.</p>'}
          ${bw.length ? `<details class="bw-table"><summary class="small">All entries (${bw.length})</summary>
            <table><thead><tr><th>Date</th><th class="num">${unit}</th><th></th></tr></thead><tbody>
            ${[...bw].reverse().map(e => `<tr><td>${esc(fmtDate(noon(e.date)))}</td><td class="num tabular">${esc(toDisplayWeight(e.kg, 0.1))}</td>
              <td><button class="icon-btn sm" data-del-bw="${esc(e.date)}" aria-label="Delete entry for ${esc(fmtDate(noon(e.date)))}">${icon('trash', 16)}</button></td></tr>`).join('')}
            </tbody></table></details>` : ''}
        </section>

        <h3 class="section-title">History</h3>
        ${history.length ? history.map(h => {
          const sets = h.exercises.reduce((t, e) => t + e.sets.length, 0);
          const vol = volumeKg(h);
          return `<details class="card history">
            <summary>
              <span><strong>${esc(h.dayName)}</strong><span class="muted small">${esc(fmtDate(h.date))} · ${fmtClock(h.durationSec)} · ${sets} sets${vol ? ` · ${Math.round(Number(toDisplayWeight(vol))).toLocaleString()} ${unit}` : ''}</span></span>
              ${icon('chevron', 18)}
            </summary>
            <ul class="summary-list">
              ${h.exercises.map(e => `<li><a href="#/exercise/${encodeURIComponent(e.id)}">${esc(e.name)}</a>
                <span class="muted small">${esc(e.sets.map(s => (s.secs ? `${s.secs}s` : `${s.reps}${s.kg != null ? `×${toDisplayWeight(s.kg)}` : ''}`)).join(' · '))}</span></li>`).join('')}
            </ul>
            <button class="link danger small" data-del-h="${esc(h.id)}">Delete this workout</button>
          </details>`;
        }).join('') : '<p class="muted">Finished workouts show up here.</p>'}
      </div>`;

    const weeks = weeklyCounts(8);
    cleanups.push(columnChart(root.querySelector('#weeks'), weeks.map((w, i) => ({
      label: w.start.toLocaleDateString(undefined, { day: 'numeric', month: 'numeric' }),
      value: w.count,
      tip: `<strong>${w.count} workout${w.count === 1 ? '' : 's'}</strong><br><span class="muted">${i === weeks.length - 1 ? 'This week' : `Week of ${esc(fmtDate(w.start, { day: 'numeric', month: 'short' }))}`}</span>`,
    })), { title: 'Workouts per week, last 8 weeks', latestLabel: true }));

    if (bw.length >= 2) {
      cleanups.push(lineChart(root.querySelector('#bwChart'), bw.map(e => ({
        t: new Date(noon(e.date)),
        v: Number(toDisplayWeight(e.kg, 0.1)),
        tip: `<strong>${esc(toDisplayWeight(e.kg, 0.1))} ${unit}</strong><br><span class="muted">${esc(fmtDate(noon(e.date)))}</span>`,
      })), { title: `Bodyweight in ${unit}`, fmt: v => String(Math.round(v * 10) / 10) }));
    }

    root.querySelector('#bwForm').addEventListener('submit', e => {
      e.preventDefault();
      const kg = fromDisplayWeight(root.querySelector('#bwIn').value);
      if (!kg) { toast('Enter a weight'); return; }
      const date = localDay(new Date());
      // One entry per day; logging again today corrects it.
      state.bodyweight = state.bodyweight.filter(b => b.date !== date).concat({ date, kg });
      save();
      draw();
    });
  }

  root.onclick = async e => {
    const delBw = e.target.closest('[data-del-bw]');
    if (delBw) {
      state.bodyweight = state.bodyweight.filter(b => b.date !== delBw.dataset.delBw);
      save();
      draw();
      return;
    }
    const delH = e.target.closest('[data-del-h]');
    if (delH && await confirmSheet('Delete this workout from your history?', { ok: 'Delete', danger: true })) {
      state.history = state.history.filter(h => h.id !== delH.dataset.delH);
      save();
      draw();
    }
  };

  draw();
  return () => { cleanups.forEach(fn => fn()); root.onclick = null; };
}
