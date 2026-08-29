let vehicles = [];

export async function loadVehicles() {
  try {
    const res = await fetch('data/vehicles.json');
    vehicles = await res.json();
  } catch (e) {
    console.error('Failed to load vehicles:', e);
    vehicles = [];
  }
  return vehicles;
}

export function getVehicles() {
  return vehicles;
}

export function getVehicle(id) {
  return vehicles.find(v => v.id === id);
}

export function getVehiclesByRoute(routeId) {
  return vehicles.filter(v => v.routeId === routeId);
}

export function getAffectedVehicles() {
  return vehicles.filter(v => v.status === 'affected');
}

export function getReroutedVehicles() {
  return vehicles.filter(v => v.status === 'rerouted');
}

export function updateVehicleStatus(id, status) {
  const v = vehicles.find(x => x.id === id);
  if (v) {
    v.status = status;
  }
  return v;
}

export function addVehicle(v) {
  vehicles.push(v);
  return v;
}

export function removeVehicle(id) {
  vehicles = vehicles.filter(v => v.id !== id);
}

export function getVehiclesByCargo() {
  const counts = {};
  vehicles.forEach(v => {
    counts[v.cargo] = (counts[v.cargo] || 0) + 1;
  });
  return counts;
}

const CARGO_ICONS = {
  'Medicines': '💊',
  'Food Supplies': '📦',
  'Fuel': '⛽'
};

export function getCargoIcon(cargo) {
  return CARGO_ICONS[cargo] || '🚛';
}
