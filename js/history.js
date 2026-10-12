import { state } from './store.js';

export function lastPerformance(exId) {
  for (let i = state.history.length - 1; i >= 0; i--) {
    const ex = state.history[i].exercises.find(e => e.id === exId);
    if (ex && ex.sets.length) return { date: state.history[i].date, sets: ex.sets };
  }
  return null;
}

// Weeks start on Monday. Keys are local dates; toISOString() would shift to UTC.
export function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export const localDay = d => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export function weeklyCounts(weeks = 8) {
  const start = startOfWeek(new Date());
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const s = new Date(start);
    s.setDate(s.getDate() - i * 7);
    const e = new Date(s);
    e.setDate(e.getDate() + 7);
    const count = state.history.filter(h => { const d = new Date(h.date); return d >= s && d < e; }).length;
    out.push({ start: s, count });
  }
  return out;
}

// Consecutive weeks with at least one workout. Rest days are normal, so a
// day-based streak would punish exactly the behaviour a plan asks for.
export function weekStreak() {
  const weeks = weeklyCounts(104);
  let i = weeks.length - 1;
  if (weeks[i].count === 0) i--; // the current week isn't over yet
  let streak = 0;
  for (; i >= 0 && weeks[i].count > 0; i--) streak++;
  return streak;
}

export function volumeKg(entry) {
  return entry.exercises.reduce((t, ex) =>
    t + ex.sets.reduce((s, set) => s + (set.kg && set.reps ? set.kg * set.reps : 0), 0), 0);
}

export function daysTrainedThisWeek() {
  const s = startOfWeek(new Date());
  return new Set(state.history.filter(h => new Date(h.date) >= s).map(h => localDay(h.date)));
}
