// Hand-picked no-equipment exercises for legs, glutes & hips, and chest, plus
// ready-made sessions built from them. Pure data and functions (no DOM), so
// tools/check-planner.mjs can confirm every id here exists in the dataset.
import { prescribe } from './planner.js';

// Each group is ordered easiest to hardest. `needs` flags household props.
export const BW_GROUPS = [
  {
    id: 'legs', label: 'Legs', blurb: 'Quads and hamstrings',
    items: [
      { id: 'Bodyweight_Squat' },
      { id: 'Bodyweight_Walking_Lunge' },
      { id: 'Freehand_Jump_Squat' },
      { id: 'Split_Squats', note: 'Jumping split squats' },
      { id: 'Floor_Glute-Ham_Raise', needs: 'Feet braced under a couch or a partner' },
    ],
  },
  {
    id: 'lower', label: 'Glutes & hips', blurb: 'The rest of the lower body',
    items: [
      { id: 'Butt_Lift_Bridge' },
      { id: 'Glute_Kickback' },
      { id: 'Leg_Lift', needs: 'A chair to hold' },
      { id: 'Side_Leg_Raises', needs: 'A chair to hold' },
      { id: 'Single_Leg_Glute_Bridge' },
      { id: 'Step-up_with_Knee_Raise', needs: 'A sturdy step or bench' },
      { id: 'Lateral_Bound' },
    ],
  },
  {
    id: 'chest', label: 'Chest', blurb: 'Push-up progressions',
    items: [
      { id: 'Incline_Push-Up', needs: 'A bench, table or wall' },
      { id: 'Incline_Push-Up_Wide', needs: 'A bench, table or wall' },
      { id: 'Pushups' },
      { id: 'Push-Up_Wide' },
      { id: 'Pushups_Close_and_Wide_Hand_Positions' },
      { id: 'Push-Ups_With_Feet_Elevated', needs: 'A chair or bench for your feet' },
      { id: 'Clock_Push-Up' },
      { id: 'Plyo_Push-up' },
      { id: 'Single-Arm_Push-Up' },
    ],
  },
];

// `easy` replaces the exercise for beginners. Stretches close each session.
export const BW_WORKOUTS = [
  {
    id: 'lower', name: 'Bodyweight Lower Body', blurb: 'Legs, glutes and hips',
    items: [
      { id: 'Bodyweight_Squat' },
      { id: 'Bodyweight_Walking_Lunge' },
      { id: 'Single_Leg_Glute_Bridge', easy: 'Butt_Lift_Bridge' },
      { id: 'Freehand_Jump_Squat', easy: 'Glute_Kickback' },
      { id: 'Side_Leg_Raises' },
    ],
    stretches: ['Kneeling_Hip_Flexor', 'Hamstring_Stretch'],
  },
  {
    id: 'chest', name: 'Bodyweight Chest', blurb: 'Push-ups, four ways',
    items: [
      { id: 'Pushups', easy: 'Incline_Push-Up' },
      { id: 'Push-Up_Wide', easy: 'Incline_Push-Up_Wide' },
      { id: 'Push-Ups_With_Feet_Elevated', easy: 'Incline_Push-Up_Medium' },
      { id: 'Pushups_Close_and_Wide_Hand_Positions', easy: 'Isometric_Chest_Squeezes' },
    ],
    stretches: ['Dynamic_Chest_Stretch'],
  },
  {
    id: 'combo', name: 'Bodyweight Lower + Chest', blurb: 'Alternates legs and chest so each rests',
    items: [
      { id: 'Bodyweight_Squat' },
      { id: 'Pushups', easy: 'Incline_Push-Up' },
      { id: 'Bodyweight_Walking_Lunge' },
      { id: 'Push-Up_Wide', easy: 'Incline_Push-Up_Wide' },
      { id: 'Single_Leg_Glute_Bridge', easy: 'Butt_Lift_Bridge' },
      { id: 'Push-Ups_With_Feet_Elevated', easy: 'Incline_Push-Up_Medium' },
    ],
    stretches: ['Kneeling_Hip_Flexor', 'Dynamic_Chest_Stretch'],
  },
];

// Every id referenced above, for the data check.
export function bodyweightIds() {
  return [...new Set([
    ...BW_GROUPS.flatMap(g => g.items.map(i => i.id)),
    ...BW_WORKOUTS.flatMap(w => [...w.items.flatMap(i => [i.id, i.easy]), ...w.stretches]),
  ].filter(Boolean))];
}

// Turns a workout template into a plan-day shape the workout player accepts.
export function buildBodyweightDay(workout, profile, getExercise) {
  const beginner = profile.level === 'beginner';
  const main = workout.items
    .map(i => getExercise(beginner && i.easy ? i.easy : i.id))
    .filter(Boolean)
    .map(ex => ({ id: ex.id, slot: 'bodyweight', kind: 'main', ...prescribe(ex, profile, 'main') }));
  const stretches = workout.stretches
    .map(getExercise).filter(Boolean)
    .map(ex => ({ id: ex.id, slot: 'stretch', kind: 'stretch', ...prescribe(ex, profile, 'stretch') }));
  return { name: workout.name, items: [...main, ...stretches] };
}
