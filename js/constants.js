// Images stay on jsDelivr rather than in this repo: ~1,700 JPEGs would make the
// app ~70 MB. Pinned to a commit so paths can't change underneath us.
export const IMG_BASE =
  'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises/';

// The dataset tags 17 muscles; people think in body parts. This is the grouping
// used by both the library filter and the planner's focus option.
export const BODY_PARTS = [
  { id: 'chest',     label: 'Chest',     muscles: ['chest'] },
  { id: 'back',      label: 'Back',      muscles: ['lats', 'middle back', 'lower back', 'traps'] },
  { id: 'shoulders', label: 'Shoulders', muscles: ['shoulders', 'neck'] },
  { id: 'arms',      label: 'Arms',      muscles: ['biceps', 'triceps', 'forearms'] },
  { id: 'core',      label: 'Core',      muscles: ['abdominals'] },
  { id: 'glutes',    label: 'Glutes',    muscles: ['glutes'] },
  { id: 'legs',      label: 'Legs',      muscles: ['quadriceps', 'hamstrings', 'calves', 'adductors', 'abductors'] },
];

export const MUSCLE_TO_PART = Object.fromEntries(
  BODY_PARTS.flatMap(p => p.muscles.map(m => [m, p.id])),
);

// 'body only' is implied for everyone, so it isn't offered as a choice.
export const EQUIPMENT_OPTIONS = [
  { id: 'dumbbell',   label: 'Dumbbells',              equipment: ['dumbbell'] },
  { id: 'kettlebell', label: 'Kettlebells',            equipment: ['kettlebells'] },
  { id: 'bands',      label: 'Resistance bands',       equipment: ['bands'] },
  { id: 'barbell',    label: 'Barbell & EZ bar',       equipment: ['barbell', 'e-z curl bar'] },
  { id: 'gym',        label: 'Cables & machines',      equipment: ['cable', 'machine'] },
  { id: 'balls',      label: 'Exercise / medicine ball', equipment: ['exercise ball', 'medicine ball'] },
];

// Equipment that a weight number makes sense for in the workout logger.
export const WEIGHTED_EQUIPMENT = new Set([
  'barbell', 'dumbbell', 'kettlebells', 'cable', 'machine', 'e-z curl bar', 'medicine ball',
]);

export const GOALS = [
  { id: 'lose',   label: 'Lose fat',            hint: 'Higher reps, short rests, a conditioning finisher' },
  { id: 'muscle', label: 'Build muscle',        hint: 'Moderate reps, more sets, longer rests' },
  { id: 'fit',    label: 'Get fit & toned',     hint: 'A balance of both' },
];

export const LEVELS = [
  { id: 'beginner',     label: 'Beginner',     hint: 'New to training or coming back after a break' },
  { id: 'intermediate', label: 'Intermediate', hint: 'Training regularly for 6+ months' },
  { id: 'expert',       label: 'Advanced',     hint: 'Years of consistent training' },
];

export const DAYS_OPTIONS = [2, 3, 4, 5, 6];
export const MINUTES_OPTIONS = [20, 30, 45, 60];

export const CATEGORIES = [
  'strength', 'stretching', 'plyometrics', 'powerlifting', 'olympic weightlifting', 'strongman', 'cardio',
];
