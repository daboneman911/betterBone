// Converts free-exercise-db's dist/exercises.json into the slimmer file the app ships.
// Usage: node tools/build-data.mjs <path-to-raw-exercises.json>
// Source: https://github.com/yuhonas/free-exercise-db (The Unlicense / public domain)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = process.argv[2];
if (!src) {
  console.error('usage: node tools/build-data.mjs <raw exercises.json>');
  process.exit(1);
}

const raw = JSON.parse(readFileSync(src, 'utf8'));
const out = raw
  // A handful of entries have no images; the library looks broken without them.
  .filter(e => Array.isArray(e.images) && e.images.length > 0)
  .map(e => ({
    id: e.id,
    name: e.name,
    category: e.category,
    level: e.level,
    mechanic: e.mechanic || null,
    force: e.force || null,
    // Blank equipment in the source is nearly always bodyweight (lunges, inverted rows,
    // stretches). Without this, bodyweight-only users get almost no leg exercises.
    equipment: e.equipment || 'body only',
    primary: e.primaryMuscles,
    secondary: e.secondaryMuscles,
    steps: e.instructions,
    images: e.images,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const dest = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'exercises.json');
writeFileSync(dest, JSON.stringify(out));
console.log(`wrote ${out.length} exercises -> ${dest}`);
