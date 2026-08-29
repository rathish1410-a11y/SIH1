let routes = [];

export async function loadRoutes() {
  try {
    const res = await fetch('data/routes.json');
    routes = await res.json();
  } catch (e) {
    console.error('Failed to load routes:', e);
    routes = [];
  }
  return routes;
}

export function getRoutes() {
  return routes;
}

export function getRoute(id) {
  return routes.find(r => r.id === id);
}

export function getRouteByDisruption(disruption) {
  if (!disruption.affectedRoutes || disruption.affectedRoutes.length === 0) return [];
  return disruption.affectedRoutes.map(rid => routes.find(r => r.id === rid)).filter(Boolean);
}

export function getAlternateRoute(routeId) {
  const route = routes.find(r => r.id === routeId);
  if (!route || !route.alternatePath) return null;
  return {
    path: route.alternatePath,
    eta: route.reroutedEta,
    distance: route.distance,
    name: route.name + ' (Alternate)'
  };
}

export function getRouteStatus(routeId) {
  const route = routes.find(r => r.id === routeId);
  if (!route) return 'unknown';
  return route.status;
}
