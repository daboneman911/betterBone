import { IMG_BASE } from './constants.js';

let list = [];
let index = new Map();

export async function loadExercises() {
  const res = await fetch('data/exercises.json');
  if (!res.ok) throw new Error(`exercise data: HTTP ${res.status}`);
  list = await res.json();
  index = new Map(list.map(e => [e.id, e]));
  return list;
}

export const allExercises = () => list;
export const getExercise = id => index.get(id);

// Folder names contain commas, parentheses and apostrophes.
export const imgUrl = path => IMG_BASE + path.split('/').map(encodeURIComponent).join('/');
