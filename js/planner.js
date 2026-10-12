// Turns quiz answers into a weekly plan. Pure functions only (no DOM, no storage)
// so tools/check-planner.mjs can exercise every quiz combination under Node.
import { EQUIPMENT_OPTIONS } from './constants.js';

const LEVEL_RANK = { beginner: 0, intermediate: 1, expert: 2 };

// A slot is "one exercise for these muscles", matched on the exercise's first
// primary muscle so e.g. a squat isn't picked to fill a calf slot.
const SLOT_MUSCLES = {
  quads: ['quadriceps'],
  hinge: ['hamstrings', 'glutes'],
  glutes: ['glutes', 'abductors', 'adductors'],
  calves: ['calves'],
  chest: ['chest'],
  back: ['lats', 'middle back'],
  midback: ['middle back', 'traps'],
  lowback: ['lower back'],
  shoulders: ['shoulders'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  core: ['abdominals'],
};

export const SLOT_LABELS = {
  quads: 'Quads', hinge: 'Hamstrings / glutes', glutes: 'Glutes & hips', calves: 'Calves',
  chest: 'Chest', back: 'Back', midback: 'Upper back', lowback: 'Lower back',
  shoulders: 'Shoulders', biceps: 'Biceps', triceps: 'Triceps', core: 'Core',
  finisher: 'Conditioning', stretch: 'Cool-down stretch',
};

// Slot order is priority order: the session is cut from the end to fit the time budget.
const SESSIONS = {
  fullA: { name: 'Full Body A', slots: ['quads', 'chest', 'back', 'shoulders', 'hinge', 'core', 'biceps', 'triceps'] },
  fullB: { name: 'Full Body B', slots: ['hinge', 'back', 'chest', 'glutes', 'shoulders', 'core', 'triceps', 'calves'] },
  fullC: { name: 'Full Body C', slots: ['quads', 'shoulders', 'back', 'chest', 'glutes', 'core', 'biceps', 'calves'] },
  upper: { name: 'Upper Body', slots: ['chest', 'back', 'shoulders', 'midback', 'chest', 'biceps', 'triceps', 'core'] },
  lower: { name: 'Lower Body', slots: ['quads', 'hinge', 'glutes', 'quads', 'calves', 'core', 'lowback', 'core'] },
  push:  { name: 'Push', slots: ['chest', 'shoulders', 'chest', 'triceps', 'shoulders', 'triceps', 'core'] },
  pull:  { name: 'Pull', slots: ['back', 'midback', 'biceps', 'back', 'biceps', 'lowback', 'core'] },
  legs:  { name: 'Legs', slots: ['quads', 'hinge', 'glutes', 'calves', 'quads', 'core', 'core'] },
};

const SCHEDULES = {
  2: ['fullA', 'fullB'],
  3: ['fullA', 'fullB', 'fullC'],
  4: ['upper', 'lower', 'upper', 'lower'],
  5: ['push', 'pull', 'legs', 'upper', 'lower'],
  6: ['push', 'pull', 'legs', 'push', 'pull', 'legs'],
};

// Which slot a "focus area" adds an extra exercise to.
const FOCUS_SLOTS = {
  chest: ['chest'], back: ['back'], shoulders: ['shoulders'], arms: ['biceps', 'triceps'],
  core: ['core'], glutes: ['glutes'], legs: ['quads'],
};

export const RX = {
  lose:   { sets: 3, reps: '12-15', rest: 45, hold: 30 },
  muscle: { sets: 4, reps: '8-12',  rest: 90, hold: 40 },
  fit:    { sets: 3, reps: '10-12', rest: 60, hold: 30 },
};

// Seeded so a plan can be regenerated identically from its seed and so the
// checker is deterministic. mulberry32.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function allowedEquipment(profile) {
  const set = new Set(['body only']);
  for (const id of profile.equipment || []) {
    const opt = EQUIPMENT_OPTIONS.find(o => o.id === id);
    if (opt) opt.equipment.forEach(e => set.add(e));
  }
  return set;
}

export function isEligible(ex, profile, equip = allowedEquipment(profile)) {
  return LEVEL_RANK[ex.level] <= LEVEL_RANK[profile.level] && !!ex.equipment && equip.has(ex.equipment);
}

export function slotPool(all, slot, profile, equip = allowedEquipment(profile), muscles = null) {
  if (slot === 'finisher') {
    return all.filter(e => e.category === 'plyometrics' && isEligible(e, profile, equip));
  }
  if (slot === 'stretch') {
    // The source tags a few dynamic drills (Frog Hops, skips) as stretching;
    // they don't belong in a cool-down.
    return all.filter(e => e.category === 'stretching' && !/\b(hops?|jumps?|bounds?|skips?|skipping)\b/i.test(e.name)
      && isEligible(e, profile, equip)
      && (!muscles || muscles.has(e.primary[0])));
  }
  const target = SLOT_MUSCLES[slot] || [];
  return all.filter(e =>
    (e.category === 'strength' || (e.category === 'powerlifting' && profile.level === 'expert'))
    && target.includes(e.primary[0])
    && isEligible(e, profile, equip));
}

const NEXT_LEVEL = { beginner: 'intermediate', intermediate: 'expert', expert: 'expert' };
const PLYO_OK = new Set(['quads', 'hinge', 'glutes', 'calves']);

// Bodyweight-only users in particular hit near-empty slots (the dataset has one
// beginner bodyweight quad exercise). Widen gradually rather than leave a hole.
export function slotPoolWithFallback(all, slot, profile, equip = allowedEquipment(profile)) {
  let pool = slotPool(all, slot, profile, equip);
  if (pool.length >= 3 || slot === 'finisher' || slot === 'stretch') return pool;
  const ids = new Set(pool.map(e => e.id));
  const add = list => list.forEach(e => { if (!ids.has(e.id)) { ids.add(e.id); pool.push(e); } });
  add(slotPool(all, slot, { ...profile, level: NEXT_LEVEL[profile.level] }, equip));
  if (pool.length < 3 && PLYO_OK.has(slot)) {
    const target = SLOT_MUSCLES[slot];
    add(all.filter(e => e.category === 'plyometrics' && target.includes(e.primary[0]) && isEligible(e, profile, equip)));
  }
  return pool;
}

export function prescribe(ex, profile, kind = 'main') {
  if (kind === 'stretch') return { sets: 1, reps: null, hold: 30, rest: 0 };
  if (kind === 'finisher') return { sets: 3, reps: null, hold: 30, rest: 30 };
  const rx = RX[profile.goal] || RX.fit;
  let sets = rx.sets;
  if (profile.level === 'beginner' || ex.mechanic === 'isolation') sets = Math.min(sets, 3);
  const rest = rx.rest + (profile.level === 'beginner' ? 15 : 0);
  // Planks, wall sits etc. are prescribed by time, not reps.
  const isHold = ex.force === 'static';
  return { sets, reps: isHold ? null : rx.reps, hold: isHold ? rx.hold : null, rest };
}

// Rough wall-clock estimate: ~40 s per working set plus rest, plus setup per exercise.
export function estimateSeconds(items) {
  return items.reduce((t, it) => t + 45 + it.sets * ((it.hold || 40) + it.rest), 0);
}

function pick(pool, r, sessionUsed, planUsed, preferCompound) {
  let cands = pool.filter(e => !sessionUsed.has(e.id));
  if (!cands.length) return null;
  if (preferCompound) {
    const c = cands.filter(e => e.mechanic === 'compound');
    if (c.length) cands = c;
  }
  // Spread variety across the week before repeating anything.
  const fresh = cands.filter(e => !planUsed.has(e.id));
  if (fresh.length) cands = fresh;
  return cands[Math.floor(r() * cands.length)];
}

function buildSession(template, dayIdx, profile, all, r, planUsed) {
  const equip = allowedEquipment(profile);
  const slots = [...template.slots];

  const focus = profile.focus || [];
  if (focus.length) {
    const opts = FOCUS_SLOTS[focus[dayIdx % focus.length]] || [];
    const slot = opts[dayIdx % opts.length];
    // Only emphasise a part the session already trains (no squats on push day);
    // full-body days train everything.
    if (slot && (slots.includes(slot) || template.name.startsWith('Full Body'))) slots.splice(2, 0, slot);
  }

  const finisherSecs = profile.goal === 'lose' ? estimateSeconds([{ sets: 3, hold: 30, rest: 30 }]) : 0;
  const cooldownSecs = estimateSeconds([{ sets: 1, hold: 30, rest: 0 }, { sets: 1, hold: 30, rest: 0 }]);
  const budget = profile.minutes * 60 - finisherSecs - cooldownSecs;

  const items = [];
  const sessionUsed = new Set();
  for (const slot of slots) {
    const ex = pick(slotPoolWithFallback(all, slot, profile, equip), r, sessionUsed, planUsed, items.length < 3);
    if (!ex) continue;
    const item = { id: ex.id, slot, kind: 'main', ...prescribe(ex, profile) };
    // Always keep at least 3 exercises, even if that runs over a short time budget.
    if (items.length >= 3 && estimateSeconds([...items, item]) > budget) break;
    items.push(item);
    sessionUsed.add(ex.id);
    planUsed.add(ex.id);
  }

  if (profile.goal === 'lose') {
    const ex = pick(slotPool(all, 'finisher', profile, equip), r, sessionUsed, planUsed, false);
    if (ex) {
      items.push({ id: ex.id, slot: 'finisher', kind: 'finisher', ...prescribe(ex, profile, 'finisher') });
      sessionUsed.add(ex.id);
    }
  }

  const byId = new Map(all.map(e => [e.id, e]));
  const worked = new Set(items.filter(i => i.kind === 'main').map(i => byId.get(i.id).primary[0]));
  const stretchPool = slotPool(all, 'stretch', profile, equip, worked);
  for (let i = 0; i < 2; i++) {
    const ex = pick(stretchPool, r, sessionUsed, new Set(), false);
    if (!ex) break;
    items.push({ id: ex.id, slot: 'stretch', kind: 'stretch', ...prescribe(ex, profile, 'stretch') });
    sessionUsed.add(ex.id);
  }
  return items;
}

export function buildPlan(profile, all, seed = Math.floor(Math.random() * 2 ** 31)) {
  const keys = SCHEDULES[profile.days] || SCHEDULES[3];
  const r = rng(seed);
  const planUsed = new Set();
  const seen = {};
  const days = keys.map((key, i) => {
    const template = SESSIONS[key];
    seen[key] = (seen[key] || 0) + 1;
    const repeated = keys.filter(k => k === key).length > 1;
    return {
      key,
      name: repeated ? `${template.name} ${'AB'[seen[key] - 1]}` : template.name,
      items: buildSession(template, i, profile, all, r, planUsed),
    };
  });
  return { seed, createdAt: new Date().toISOString(), cursor: 0, days };
}

// Candidates for the swap sheet: everything that could have filled the same slot.
export function swapCandidates(item, day, profile, all) {
  const inDay = new Set(day.items.map(i => i.id));
  let pool;
  if (item.slot === 'custom') {
    // Added by hand from the library, so there's no slot: match its primary muscle instead.
    const ex = all.find(e => e.id === item.id);
    pool = ex ? all.filter(e => e.category === ex.category && e.primary[0] === ex.primary[0] && isEligible(e, profile)) : [];
  } else {
    pool = slotPoolWithFallback(all, item.slot, profile);
  }
  return pool.filter(e => !inDay.has(e.id));
}
