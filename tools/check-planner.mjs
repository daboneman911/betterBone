// Generates a plan for every quiz combination and reports anything degenerate:
// thin sessions, missing slots, duplicates within a day, or wildly off time estimates.
// Usage: node tools/check-planner.mjs
import { readFileSync } from 'node:fs';
import { buildPlan, estimateSeconds, slotPoolWithFallback as slotPool } from '../js/planner.js';
import { EQUIPMENT_OPTIONS, BODY_PARTS } from '../js/constants.js';

const all = JSON.parse(readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8'));

const equipSets = { bodyweight: [], dumbbells: ['dumbbell'], home: ['dumbbell', 'bands', 'kettlebell'], gym: EQUIPMENT_OPTIONS.map(o => o.id) };
const problems = [];
let plans = 0;
const lengths = [];

for (const goal of ['lose', 'muscle', 'fit'])
for (const level of ['beginner', 'intermediate', 'expert'])
for (const [equipName, equipment] of Object.entries(equipSets))
for (const days of [2, 3, 4, 5, 6])
for (const minutes of [20, 30, 45, 60])
for (const focus of [[], ['glutes'], ['arms', 'core']]) {
  const profile = { goal, level, equipment, days, minutes, focus };
  const plan = buildPlan(profile, all, 12345);
  plans++;
  const tag = `${goal}/${level}/${equipName}/${days}d/${minutes}m/focus=${focus.join('+') || '-'}`;
  for (const day of plan.days) {
    const main = day.items.filter(i => i.kind === 'main');
    const ids = day.items.map(i => i.id);
    if (main.length < 3) problems.push(`${tag} ${day.name}: only ${main.length} main exercises`);
    if (new Set(ids).size !== ids.length) problems.push(`${tag} ${day.name}: duplicate exercise`);
    const mins = estimateSeconds(day.items) / 60;
    lengths.push(mins / minutes);
    if (mins > minutes * 1.6) problems.push(`${tag} ${day.name}: ~${mins.toFixed(0)} min vs ${minutes} budget`);
  }
}

// Which slots can come up empty for the most restricted user?
const strict = { goal: 'fit', level: 'beginner', equipment: [], days: 3, minutes: 45, focus: [] };
const slots = ['quads', 'hinge', 'glutes', 'calves', 'chest', 'back', 'midback', 'lowback', 'shoulders', 'biceps', 'triceps', 'core', 'finisher'];
console.log('Pool sizes for a bodyweight-only beginner:');
for (const s of slots) console.log(`  ${s.padEnd(10)} ${slotPool(all, s, strict).length}`);

console.log('\nLibrary count per body part (primary muscle):');
for (const p of BODY_PARTS) console.log(`  ${p.label.padEnd(10)} ${all.filter(e => p.muscles.includes(e.primary[0])).length}`);

lengths.sort((a, b) => a - b);
const q = f => lengths[Math.floor(f * (lengths.length - 1))].toFixed(2);
console.log(`\n${plans} plans checked. Estimated/requested time ratio: p10 ${q(0.1)}  median ${q(0.5)}  p90 ${q(0.9)}`);
console.log(problems.length ? `${problems.length} problems:\n  ` + problems.slice(0, 40).join('\n  ') : 'No problems found.');
process.exitCode = problems.length ? 1 : 0;
