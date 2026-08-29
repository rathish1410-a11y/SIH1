let disruptions = [];
let listeners = [];

export async function loadDisruptions() {
  try {
    const res = await fetch('data/disruptions.json');
    disruptions = await res.json();
  } catch (e) {
    console.error('Failed to load disruptions:', e);
    disruptions = [];
  }
  return disruptions;
}

export function getDisruptions() {
  return disruptions;
}

export function getDisruption(id) {
  return disruptions.find(d => d.id === id);
}

export function addDisruption(d) {
  disruptions.push(d);
  notify();
  return d;
}

export function updateDisruption(id, updates) {
  const d = disruptions.find(x => x.id === id);
  if (d) {
    Object.assign(d, updates);
    notify();
  }
  return d;
}

export function verifyDisruption(id, verified = true) {
  return updateDisruption(id, { verified });
}

export function getActiveDisruptions() {
  return disruptions.filter(d => d.status === 'active');
}

export function getCriticalDisruptions() {
  return disruptions.filter(d => d.severity === 'critical' && d.status === 'active');
}

export function getUnverifiedDisruptions() {
  return disruptions.filter(d => !d.verified && d.status === 'active');
}

export function getDisruptionsByType() {
  const counts = {};
  disruptions.forEach(d => {
    counts[d.type] = (counts[d.type] || 0) + 1;
  });
  return counts;
}

export function getDisruptionsBySeverity() {
  return {
    critical: disruptions.filter(d => d.severity === 'critical').length,
    moderate: disruptions.filter(d => d.severity === 'moderate').length,
    low: disruptions.filter(d => d.severity === 'low').length
  };
}

export function onChange(fn) {
  listeners.push(fn);
}

function notify() {
  listeners.forEach(fn => fn(disruptions));
}

const TYPE_ICONS = {
  'Flood': '🌊',
  'Landslide': '⛰',
  'Road Blockage': '🚧',
  'Bridge Damage': '🏗',
  'Other': '⚠'
};

export function getTypeIcon(type) {
  return TYPE_ICONS[type] || '⚠';
}
