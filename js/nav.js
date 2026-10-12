// Hash routing keeps the app working from any sub-path (GitHub Pages serves
// it at /<repo>/) and from file-less static hosting without rewrite rules.
export function go(path) {
  const target = '#/' + path;
  if (location.hash === target) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = target;
}

export function currentRoute() {
  const [, name = 'today', ...rest] = (location.hash || '#/today').split('/');
  return { name: name || 'today', arg: rest.length ? decodeURIComponent(rest.join('/')) : '' };
}
