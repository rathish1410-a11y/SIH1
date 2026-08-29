export async function loadOfficers() {
  try {
    const res = await fetch('data/officers.json');
    return await res.json();
  } catch (e) {
    console.error('Failed to load officers:', e);
    return [];
  }
}

export function getOfficerStatusInfo(status) {
  const info = {
    'on-duty': { label: 'On Duty', class: 'online', dot: 'online' },
    'off-duty': { label: 'Off Duty', class: 'offline', dot: 'offline' },
    'en-route': { label: 'En Route', class: 'away', dot: 'away' }
  };
  return info[status] || info['off-duty'];
}

export function updateOfficerStatus(officers, id, status) {
  const officer = officers.find(o => o.id === id);
  if (officer) {
    officer.status = status;
  }
  return officer;
}
