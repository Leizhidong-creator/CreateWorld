import { useEffect, useRef, useState } from 'react';

export function navigate(path: string, replace = false) {
  const next = `#${path}`;
  if (replace) {
    const url = new URL(window.location.href);
    url.searchParams.delete('project');
    url.hash = next;
    window.history.replaceState(null, '', url);
    window.dispatchEvent(new Event('hashchange'));
    return;
  }
  if (window.location.hash !== next) window.location.hash = next;
}

function locationRoute() {
  if (window.location.hash.startsWith('#/')) return window.location.hash.slice(1);
  const legacyProject = new URLSearchParams(window.location.search).get('project');
  return legacyProject ? `/studio/${encodeURIComponent(legacyProject)}` : '/';
}

export function useRoute() {
  const [route, setRoute] = useState(locationRoute);
  const lastRoute = useRef(route);
  useEffect(() => {
    const update = () => {
      const next = locationRoute();
      if (next === lastRoute.current) return;
      lastRoute.current = next;
      setRoute(next);
      window.scrollTo({ top: 0, behavior: 'instant' });
    };
    window.addEventListener('hashchange', update);
    window.addEventListener('popstate', update);
    return () => {
      window.removeEventListener('hashchange', update);
      window.removeEventListener('popstate', update);
    };
  }, []);
  return route;
}

export function scrollToWorlds() {
  document.getElementById('market-discover')?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    block: 'start',
  });
}

export function openWorlds() {
  navigate('/games');
}

// Keep historical links useful without restoring the removed login/explore pages.
export function legacyDestination(route: string): string | undefined {
  const path = route.split('?')[0];
  if (path === '/explore' || path.startsWith('/explore/')) return '/plugins';
  if (path !== '/login') return undefined;
  const next = new URLSearchParams(route.split('?').slice(1).join('?')).get('next') || '/projects';
  if (/^\/explore(?:\/|$|\?)/.test(next)) return '/plugins';
  return /^\/(?:projects|publish|games(?:\/(?:local\/[^/?#\\]+|preview\/[\w-]+|mine|[\w-]+))?|plugins(?:\/[\w-]+)?|export\/[^/?#\\]+|studio\/[^/?#\\]+)(?:\?[^#\\]*)?$/.test(next) ? next : '/projects';
}
