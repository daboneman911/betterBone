import { state, save, toDisplayWeight, fromDisplayWeight } from '../store.js';
import { getExercise } from '../data.js';
import { WEIGHTED_EQUIPMENT } from '../constants.js';
import { esc, icon, fmtClock, animFrames, thumb, rxText, confirmSheet, toast } from '../ui.js';
import { lastPerformance, volumeKg } from '../history.js';
import { go } from '../nav.js';

// ---- audio -----------------------------------------------------------------
// iOS only lets an AudioContext start inside a user gesture, so every tap in the
// player calls unlockAudio(). Note: the iPhone's silent switch mutes Web Audio.
let audioCtx = null;
function unlockAudio() {
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (err) {
    console.warn('[audio] unavailable', err);
  }
}
function beep(freq, ms) {
  if (!audioCtx || !state.settings.sound) return;
  try {
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + ms / 1000 + 0.02);
  } catch (err) {
    console.warn('[audio] beep failed', err);
  }
}

// ---- starting --------------------------------------------------------------
export async function startWorkout(dayIndex) {
  unlockAudio();
  if (state.active) {
    const ok = await confirmSheet(`“${state.active.dayName}” is still in progress. Discard it and start a new workout?`,
      { ok: 'Discard & start', danger: true });
    if (!ok) return;
  }
  const day = state.plan.days[dayIndex];
  state.active = {
    startedAt: Date.now(),
    dayIndex,
    dayName: day.name,
    items: day.items.map(i => ({ id: i.id, kind: i.kind, sets: i.sets, reps: i.reps, hold: i.hold, rest: i.rest, log: [] })),
    ex: 0,
    set: 0,
    phase: 'work',   // work | hold | rest | done
    endsAt: null,    // wall-clock deadline for hold/rest; survives the tab being suspended
  };
  save();
  go('workout');
}

const firstNumber = s => { const n = parseInt(s, 10); return Number.isFinite(n) ? n : ''; };
const KIND_LABEL = { main: '', finisher: 'Finisher', stretch: 'Cool-down' };

// ---- view ------------------------------------------------------------------
export function render(root) {
  const a = state.active;
  if (!a) {
    root.innerHTML = `<div class="page empty">
      <h1>No workout in progress</h1>
      <p class="muted">Start one from Today or your plan.</p>
      <a class="btn primary" href="#/today">Go to Today</a></div>`;
    return;
  }

  let lastBeepSecond = null;
  let wakeLock = null;

  const item = () => a.items[a.ex];
  const loggedCount = it => it.log.filter(Boolean).length;
  const weighted = ex => WEIGHTED_EQUIPMENT.has(ex.equipment);
  const unit = state.settings.units;

  async function keepAwake() {
    try {
      if ('wakeLock' in navigator && document.visibilityState === 'visible' && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      }
    } catch (err) {
      console.warn('[wakelock]', err.message);
    }
  }
  const onVisible = () => { if (document.visibilityState === 'visible') { keepAwake(); tick(); } };

  function header() {
    const segs = a.items.map((it, i) => {
      const cls = i < a.ex || (i === a.ex && a.phase === 'done') ? 'done' : i === a.ex ? 'current' : '';
      return `<span class="seg ${cls}"></span>`;
    }).join('');
    return `<header class="player-top">
        <button class="icon-btn" data-act="exit" aria-label="Leave workout (it stays in progress)">${icon('close')}</button>
        <div class="player-title"><strong>${esc(a.dayName)}</strong><span class="muted small tabular" data-elapsed></span></div>
        <button class="btn ghost sm" data-act="finish">Finish</button>
      </header>
      <div class="segs" aria-hidden="true">${segs}</div>`;
  }

  function lastTimeLine(ex) {
    const last = lastPerformance(ex.id);
    if (!last) return '';
    const sets = last.sets.map(s => (s.secs ? `${s.secs}s` : `${s.reps}${s.kg ? ` @ ${toDisplayWeight(s.kg)}` : ''}`)).join(', ');
    return `<p class="muted small">Last time: ${esc(sets)}${last.sets.some(s => s.kg) ? ` ${unit}` : ''}</p>`;
  }

  function prefill(it, ex) {
    const prev = it.log.filter(Boolean).pop();
    const last = lastPerformance(ex.id);
    const lastSet = last && last.sets[Math.min(a.set, last.sets.length - 1)];
    return {
      reps: (prev && prev.reps) || (lastSet && lastSet.reps) || firstNumber(it.reps),
      kg: prev && prev.kg != null ? prev.kg : lastSet && lastSet.kg != null ? lastSet.kg : null,
    };
  }

  function drawWork() {
    const it = item();
    const ex = getExercise(it.id);
    if (!ex) { skipTo(a.ex + 1); return; }
    const isHold = !!it.hold;
    const fill = prefill(it, ex);
    const step = unit === 'lb' ? 5 : 2.5;

    const setChips = Array.from({ length: it.sets }, (_, i) => {
      const s = it.log[i];
      const label = s ? (s.secs ? `${s.secs}s` : `${s.reps}${s.kg != null ? ` × ${toDisplayWeight(s.kg)}` : ''}`) : `Set ${i + 1}`;
      return `<span class="set-chip${s ? ' done' : ''}${i === a.set ? ' current' : ''}">${esc(label)}</span>`;
    }).join('');

    let controls;
    if (isHold && a.phase === 'hold') {
      controls = `<div class="big-timer tabular" data-countdown aria-live="off"></div>
        <div class="timer-bar"><div data-bar></div></div>
        <button class="btn ghost block" data-act="stopHold">Stop early</button>`;
    } else if (isHold) {
      controls = `<button class="btn primary block lg" data-act="startHold">${icon('play', 18)} Start ${it.hold}s</button>
        <button class="link center" data-act="logHold">Log without timer</button>`;
    } else {
      controls = `<div class="log-inputs">
          ${weighted(ex) ? `<label class="stepper">
            <span class="small muted">Weight (${unit})</span>
            <span class="stepper-row">
              <button class="step" data-step="w" data-d="-${step}" aria-label="Less weight">−</button>
              <input id="in-w" type="number" inputmode="decimal" min="0" step="${step}" value="${esc(toDisplayWeight(fill.kg))}" placeholder="0">
              <button class="step" data-step="w" data-d="${step}" aria-label="More weight">+</button>
            </span></label>` : ''}
          <label class="stepper">
            <span class="small muted">Reps</span>
            <span class="stepper-row">
              <button class="step" data-step="r" data-d="-1" aria-label="One fewer rep">−</button>
              <input id="in-r" type="number" inputmode="numeric" min="0" step="1" value="${esc(fill.reps)}">
              <button class="step" data-step="r" data-d="1" aria-label="One more rep">+</button>
            </span></label>
        </div>
        <button class="btn primary block lg" data-act="complete">${icon('check', 18)} Complete set</button>`;
    }

    root.innerHTML = `${header()}
      <main class="player">
        ${animFrames(ex)}
        <p class="eyebrow">Exercise ${a.ex + 1} of ${a.items.length}${KIND_LABEL[it.kind] ? ` · ${KIND_LABEL[it.kind]}` : ''}</p>
        <h1 class="player-name">${esc(ex.name)}</h1>
        <p class="target">Set ${a.set + 1} of ${it.sets} · <strong>${isHold ? `${it.hold}s hold` : `${esc(it.reps)} reps`}</strong></p>
        ${lastTimeLine(ex)}
        <div class="set-chips">${setChips}</div>
        ${controls}
        <details class="howto"><summary>How to do it</summary><ol>${ex.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></details>
        <div class="row between player-nav">
          <button class="btn ghost sm" data-act="prev" ${a.ex === 0 ? 'disabled' : ''}>${icon('prev', 16)} Previous</button>
          <button class="btn ghost sm" data-act="skip">Skip exercise ${icon('next', 16)}</button>
        </div>
      </main>`;
    tick();
  }

  function drawRest() {
    const it = item();
    const ex = getExercise(it.id);
    root.innerHTML = `${header()}
      <main class="player rest">
        <p class="eyebrow">Rest</p>
        <div class="big-timer tabular" data-countdown></div>
        <div class="timer-bar"><div data-bar></div></div>
        <div class="row center gap">
          <button class="btn ghost" data-act="restMinus">−15s</button>
          <button class="btn ghost" data-act="restPlus">+15s</button>
        </div>
        <button class="btn primary block lg" data-act="skipRest">Skip rest</button>
        ${ex ? `<div class="card next-up">
          ${thumb(ex)}
          <div><p class="eyebrow">Up next</p><strong>${esc(ex.name)}</strong>
          <p class="muted small">Set ${a.set + 1} of ${it.sets} · ${it.hold ? `${it.hold}s hold` : `${esc(it.reps)} reps`}</p></div>
        </div>` : ''}
      </main>`;
    tick();
  }

  function drawDone() {
    if (!a.finishedAt) { a.finishedAt = Date.now(); save(); }
    const done = a.items.filter(it => loggedCount(it));
    const sets = done.reduce((t, it) => t + loggedCount(it), 0);
    const vol = volumeKg({ exercises: done.map(it => ({ sets: it.log.filter(Boolean) })) });
    const incomplete = a.items.some(it => loggedCount(it) < it.sets);
    root.innerHTML = `
      <main class="page done-page">
        <div class="done-badge">${icon('check', 40)}</div>
        <h1>${incomplete ? 'Workout ended' : 'Workout complete'}</h1>
        <div class="stat-row">
          <div class="stat"><span class="stat-label">Time</span><span class="stat-value">${fmtClock((a.finishedAt - a.startedAt) / 1000)}</span></div>
          <div class="stat"><span class="stat-label">Sets</span><span class="stat-value">${sets}</span></div>
          ${vol ? `<div class="stat"><span class="stat-label">Volume (${unit})</span><span class="stat-value">${Math.round(Number(toDisplayWeight(vol))).toLocaleString()}</span></div>` : ''}
        </div>
        <ul class="summary-list">
          ${done.map(it => {
            const ex = getExercise(it.id);
            const s = it.log.filter(Boolean).map(x => (x.secs ? `${x.secs}s` : `${x.reps}${x.kg != null ? `×${toDisplayWeight(x.kg)}` : ''}`)).join(' · ');
            return `<li><strong>${esc(ex ? ex.name : it.id)}</strong><span class="muted small">${esc(s)}</span></li>`;
          }).join('') || '<li class="muted">No sets logged.</li>'}
        </ul>
        <button class="btn primary block lg" data-act="save" ${sets ? '' : 'disabled'}>Save workout</button>
        ${incomplete ? '<button class="btn ghost block" data-act="resume">Back to workout</button>' : ''}
        <button class="link danger center" data-act="discard">Discard workout</button>
      </main>`;
  }

  function draw() {
    if (a.phase === 'done') drawDone();
    else if (a.phase === 'rest') drawRest();
    else drawWork();
  }

  function skipTo(exIndex) {
    a.ex = exIndex;
    if (a.ex >= a.items.length) { a.phase = 'done'; a.endsAt = null; save(); draw(); return; }
    const it = item();
    a.set = Math.min(loggedCount(it), it.sets - 1);
    a.phase = 'work';
    a.endsAt = null;
    save();
    draw();
    window.scrollTo(0, 0);
  }

  function logSet(entry) {
    const it = item();
    it.log[a.set] = entry;
    const rest = it.rest;
    if (a.set + 1 < it.sets) {
      a.set++;
    } else {
      a.ex++;
      a.set = 0;
      if (a.ex >= a.items.length) { a.phase = 'done'; a.endsAt = null; save(); draw(); return; }
    }
    if (rest > 0) { a.phase = 'rest'; a.endsAt = Date.now() + rest * 1000; a.phaseTotal = rest; } else { a.phase = 'work'; a.endsAt = null; }
    lastBeepSecond = null;
    save();
    draw();
    window.scrollTo(0, 0);
  }

  // Driven by wall-clock deadlines, not by counting ticks: iOS throttles timers
  // in the background, and this way the countdown is right when you come back.
  function tick() {
    const el = root.querySelector('[data-elapsed]');
    if (el) el.textContent = fmtClock((Date.now() - a.startedAt) / 1000);
    if ((a.phase !== 'rest' && a.phase !== 'hold') || !a.endsAt) return;

    const remaining = (a.endsAt - Date.now()) / 1000;
    const total = a.phaseTotal;
    const cd = root.querySelector('[data-countdown]');
    if (cd) cd.textContent = fmtClock(Math.ceil(Math.max(0, remaining)));
    const bar = root.querySelector('[data-bar]');
    if (bar && total) bar.style.width = `${Math.max(0, Math.min(100, (remaining / total) * 100))}%`;

    const sec = Math.ceil(remaining);
    if (sec <= 3 && sec >= 1 && sec !== lastBeepSecond) { lastBeepSecond = sec; beep(660, 110); }
    if (remaining <= 0) {
      beep(990, 350);
      if (navigator.vibrate) navigator.vibrate(200);
      lastBeepSecond = null;
      if (a.phase === 'rest') { a.phase = 'work'; a.endsAt = null; save(); draw(); }
      else logSet({ secs: item().hold });
    }
  }

  root.onclick = async e => {
    unlockAudio();
    const stepBtn = e.target.closest('[data-step]');
    if (stepBtn) {
      const input = root.querySelector(stepBtn.dataset.step === 'w' ? '#in-w' : '#in-r');
      const next = Math.max(0, (parseFloat(input.value) || 0) + parseFloat(stepBtn.dataset.d));
      input.value = String(Math.round(next * 2) / 2);
      return;
    }
    const act = e.target.closest('[data-act]');
    if (!act) return;
    switch (act.dataset.act) {
      case 'exit':
        go('today');
        break;
      case 'finish':
        if (await confirmSheet('End this workout now? Sets you’ve logged so far are kept.', { ok: 'End workout' })) {
          a.phase = 'done'; a.endsAt = null; save(); draw();
        }
        break;
      case 'complete': {
        const reps = parseInt(root.querySelector('#in-r').value, 10);
        if (!Number.isFinite(reps) || reps <= 0) { toast('Enter how many reps you did'); return; }
        const w = root.querySelector('#in-w');
        logSet({ reps, kg: w ? fromDisplayWeight(w.value) : null });
        break;
      }
      case 'startHold':
        a.phase = 'hold'; a.endsAt = Date.now() + item().hold * 1000; a.phaseTotal = item().hold; lastBeepSecond = null; save(); draw();
        break;
      case 'stopHold':
        logSet({ secs: Math.max(1, Math.round(item().hold - (a.endsAt - Date.now()) / 1000)) });
        break;
      case 'logHold':
        logSet({ secs: item().hold });
        break;
      case 'skipRest':
        a.phase = 'work'; a.endsAt = null; save(); draw();
        break;
      case 'restPlus':
        a.endsAt += 15000; a.phaseTotal = Math.max(a.phaseTotal, Math.ceil((a.endsAt - Date.now()) / 1000)); save(); tick();
        break;
      case 'restMinus':
        a.endsAt = Math.max(Date.now(), a.endsAt - 15000); save(); tick();
        break;
      case 'prev':
        if (a.ex > 0) skipTo(a.ex - 1);
        break;
      case 'skip':
        skipTo(a.ex + 1);
        break;
      case 'resume': {
        const i = a.items.findIndex(it => loggedCount(it) < it.sets);
        delete a.finishedAt;
        skipTo(i < 0 ? 0 : i);
        break;
      }
      case 'save':
        saveWorkout();
        break;
      case 'discard':
        if (await confirmSheet('Discard this workout? Nothing from it will be saved.', { ok: 'Discard', danger: true })) {
          state.active = null; save(); go('today');
        }
        break;
    }
  };

  function saveWorkout() {
    const exercises = a.items.filter(it => loggedCount(it)).map(it => {
      const ex = getExercise(it.id);
      return { id: it.id, name: ex ? ex.name : it.id, sets: it.log.filter(Boolean) };
    });
    if (!exercises.length) { toast('Nothing logged yet'); return; }
    state.history.push({
      id: `${a.startedAt}-${Math.random().toString(36).slice(2, 8)}`,
      date: new Date(a.startedAt).toISOString(),
      dayName: a.dayName,
      durationSec: Math.round(((a.finishedAt || Date.now()) - a.startedAt) / 1000),
      exercises,
    });
    // Rotate through the plan by sessions done, not by calendar day: a missed
    // Tuesday shouldn't mean skipping leg day.
    if (state.plan && a.dayIndex != null && state.plan.days.length) {
      state.plan.cursor = (a.dayIndex + 1) % state.plan.days.length;
    }
    state.active = null;
    if (save()) toast('Workout saved');
    go('progress');
  }

  draw();
  keepAwake();
  const timer = setInterval(tick, 250);
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
    if (wakeLock) wakeLock.release().catch(() => {});
    root.onclick = null;
  };
}
