import { guardRole, logout, navigateTo, toggleSidebar, closeSidebar } from './app.js';
import { initTheme, toggleTheme, getTheme } from './theme.js';
import { loadDisruptions, getDisruptions, addDisruption, updateDisruption } from './disruptions.js';
import { loadVehicles, getVehicles, getCargoIcon } from './vehicles.js';
import { loadRoutes } from './routes.js';
import { loadOfficers, updateOfficerStatus } from './patrol.js';
import { sendAlert, getAlerts, formatTime, getSeverityInfo } from './alerts.js';
import * as mapUtil from './map.js';

const session = guardRole('patrol');
if (!session) throw new Error('Auth required');

initTheme();

let officers = [];
let currentOfficer = null;
let zoneMap = null;
let selectedType = 'Flood';
let selectedSeverity = 'moderate';
let currentStatus = 'on-duty';

async function init() {
  await Promise.all([
    loadDisruptions(),
    loadVehicles(),
    loadRoutes(),
    loadOfficers().then(o => {
      officers = o;
      currentOfficer = officers[0];
    })
  ]);

  setupNavigation();
  setupTopbar();
  renderZoneKPIs();
  initZoneMap();
  renderAssignedIncidents();
  renderNearbyVehicles();
  renderInbox();
  updateBadges();

  document.getElementById('logout-btn').addEventListener('click', logout);
  document.getElementById('submit-report-btn').addEventListener('click', handleSubmitReport);

  document.querySelectorAll('[data-dtype]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-dtype]').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      selectedType = chip.dataset.dtype;
    });
  });

  document.querySelectorAll('[data-severity]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-severity]').forEach(c => {
        c.classList.remove('selected', 'critical', 'moderate', 'low');
      });
      chip.classList.add('selected', chip.dataset.severity);
      selectedSeverity = chip.dataset.severity;
    });
  });

  document.querySelectorAll('[data-status]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-status]').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      currentStatus = chip.dataset.status;
      updateOfficerStatus(officers, currentOfficer.id, currentStatus);
      sendAlert({
        title: 'Status Update',
        message: `Officer ${currentOfficer.name} is now ${currentStatus.replace('-', ' ')}.`,
        severity: 'info',
        targetRole: 'police',
        from: currentOfficer.name
      });
    });
  });

  const uploadZone = document.getElementById('upload-zone');
  if (uploadZone) {
    uploadZone.addEventListener('click', () => {
      const preview = document.getElementById('upload-preview');
      preview.style.display = 'block';
      preview.innerHTML = '<div style="padding:20px;background:var(--bg-base);border-radius:8px;text-align:center;color:var(--text-muted);font-size:13px">📷 Photo captured (simulated)</div>';
      uploadZone.style.display = 'none';
    });
  }

  if (currentOfficer) {
    document.getElementById('report-location').value = currentOfficer.zone;
  }
}

function setupNavigation() {
  document.querySelectorAll('.nav-item[data-view]').forEach(item => {
    item.addEventListener('click', () => {
      navigateTo(item.dataset.view);
      if (zoneMap) setTimeout(() => zoneMap.invalidateSize(), 200);
    });
  });
  const overlay = document.getElementById('mobile-overlay');
  if (overlay) overlay.addEventListener('click', closeSidebar);
  const menuToggle = document.getElementById('menu-toggle');
  if (menuToggle) {
    menuToggle.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
    menuToggle.addEventListener('click', toggleSidebar);
  }
}

function setupTopbar() {
  document.getElementById('theme-toggle').addEventListener('click', () => {
    toggleTheme();
    if (zoneMap) mapUtil.swapMapTheme(zoneMap, getTheme());
  });
  if (currentOfficer) {
    document.getElementById('user-name').textContent = currentOfficer.name;
    document.getElementById('user-zone').textContent = currentOfficer.zone.split(',')[0];
  }
}

function renderZoneKPIs() {
  if (!currentOfficer) return;
  const assigned = currentOfficer.assignedIncidents.length;
  const activeDisruptions = getDisruptions().filter(d => currentOfficer.assignedIncidents.includes(d.id) && d.status === 'active').length;
  const nearbyVehicles = getVehicles().filter(v => {
    const dist = Math.abs(v.lat - currentOfficer.lat) + Math.abs(v.lng - currentOfficer.lng);
    return dist < 0.5;
  }).length;

  document.getElementById('zone-assigned-count').textContent = assigned;
  document.getElementById('zone-active-count').textContent = activeDisruptions;
  document.getElementById('zone-vehicles-count').textContent = nearbyVehicles;
  document.getElementById('zone-label').textContent = currentOfficer.zone.split(',')[0];
}

function initZoneMap() {
  if (!currentOfficer) return;
  zoneMap = mapUtil.createMap('zone-map', { center: [currentOfficer.lat, currentOfficer.lng], zoom: 9 });

  mapUtil.addOfficerMarker(zoneMap, currentOfficer);

  currentOfficer.assignedIncidents.forEach(id => {
    const d = getDisruptions().find(x => x.id === id);
    if (d) mapUtil.addDisruptionMarker(zoneMap, d);
  });

  getVehicles().forEach(v => {
    const dist = Math.abs(v.lat - currentOfficer.lat) + Math.abs(v.lng - currentOfficer.lng);
    if (dist < 0.5) {
      mapUtil.addVehicleMarker(zoneMap, v, getCargoIcon(v.cargo));
    }
  });

  L.circle([currentOfficer.lat, currentOfficer.lng], {
    radius: 30000,
    color: '#f59e0b',
    fillColor: '#f59e0b',
    fillOpacity: 0.05,
    weight: 1,
    dashArray: '5 5'
  }).addTo(zoneMap);

  mapUtil.addLegend(zoneMap, [
    { color: 'red', label: 'Critical Disruption' },
    { color: 'amber', label: 'Moderate / Zone' },
    { color: 'green', label: 'Nearby Vehicle' },
    { color: 'blue', label: 'Your Position' }
  ]);
}

function renderAssignedIncidents() {
  if (!currentOfficer) return;
  const incidents = getDisruptions().filter(d => currentOfficer.assignedIncidents.includes(d.id));
  document.getElementById('incidents-count').textContent = `${incidents.length} assigned`;
  const container = document.getElementById('assigned-incidents');
  if (incidents.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">No assigned incidents</div></div>';
    return;
  }
  container.innerHTML = incidents.map(d => `
    <div class="incident-card">
      <div class="incident-card-header">
        <span class="incident-card-title">${d.type} · ${d.id}</span>
        <span class="badge badge-${d.severity}">${d.severity}</span>
      </div>
      <div class="incident-card-location">📍 ${d.location}</div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">${d.description}</div>
      <div style="font-size:11px;color:var(--text-dim);margin-bottom:10px">Status: ${d.status} · Verified: ${d.verified ? 'Yes' : 'No'}</div>
      <div class="section-label">Update Status</div>
      <div class="incident-actions">
        <button class="btn-sm ${d.status === 'active' ? 'btn-red' : 'btn-ghost'}" onclick="window._patrolUpdateStatus('${d.id}','active')">Still Active</button>
        <button class="btn-sm ${d.status === 'partially-cleared' ? 'btn-amber' : 'btn-ghost'}" onclick="window._patrolUpdateStatus('${d.id}','partially-cleared')">Partial</button>
        <button class="btn-sm ${d.status === 'fully-cleared' ? 'btn-green' : 'btn-ghost'}" onclick="window._patrolUpdateStatus('${d.id}','fully-cleared')">Cleared</button>
      </div>
    </div>
  `).join('');
}

window._patrolUpdateStatus = function(id, status) {
  updateDisruption(id, { status });
  sendAlert({
    title: 'Incident Status Updated',
    message: `${id} status updated to "${status.replace(/-/g, ' ')}" by ${currentOfficer.name}.`,
    severity: status === 'fully-cleared' ? 'success' : 'info',
    targetRole: 'police',
    from: currentOfficer.name
  });
  renderAssignedIncidents();
  renderZoneKPIs();
};

function renderNearbyVehicles() {
  if (!currentOfficer) return;
  const nearby = getVehicles().filter(v => {
    const dist = Math.abs(v.lat - currentOfficer.lat) + Math.abs(v.lng - currentOfficer.lng);
    return dist < 0.5;
  });
  const body = document.getElementById('nearby-vehicles-body');
  if (nearby.length === 0) {
    body.innerHTML = '<tr><td colspan="5"><div class="empty-state"><div class="empty-state-text">No vehicles nearby</div></div></td></tr>';
    return;
  }
  body.innerHTML = nearby.map(v => `
    <tr>
      <td><strong>${v.id}</strong></td>
      <td>${v.driverName}</td>
      <td>${getCargoIcon(v.cargo)} ${v.cargo}</td>
      <td><span class="badge badge-${v.status === 'clear' ? 'low' : v.status === 'affected' ? 'critical' : 'moderate'}">${v.status}</span></td>
      <td>${v.destination}</td>
    </tr>
  `).join('');
}

function renderInbox() {
  const alerts = getAlerts().filter(a => a.targetRole === 'all' || a.targetRole === 'patrol');
  const container = document.getElementById('patrol-inbox');
  if (alerts.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">No messages</div></div>';
    return;
  }
  container.innerHTML = alerts.map(a => {
    const info = getSeverityInfo(a.severity);
    return `
      <div class="alert-item ${a.severity}" style="margin-bottom:10px">
        <span class="alert-icon">${info.icon}</span>
        <div class="alert-body">
          <div class="alert-title">${a.title}</div>
          <div class="alert-msg">${a.message}</div>
          <div class="alert-time">From: ${a.from} · ${formatTime(a.timestamp)}</div>
        </div>
      </div>
    `;
  }).join('');
}

function handleSubmitReport() {
  const location = document.getElementById('report-location').value.trim();
  const description = document.getElementById('report-description').value.trim();
  const newId = 'DIS-' + String(Math.floor(Math.random() * 999)).padStart(3, '0');

  addDisruption({
    id: newId,
    type: selectedType,
    severity: selectedSeverity,
    lat: currentOfficer.lat + (Math.random() - 0.5) * 0.1,
    lng: currentOfficer.lng + (Math.random() - 0.5) * 0.1,
    location: location || currentOfficer.zone,
    description: description || `Reported by ${currentOfficer.name}`,
    status: 'active',
    reportedBy: currentOfficer.name,
    reportedAt: new Date().toISOString(),
    verified: false,
    affectedRoutes: []
  });

  sendAlert({
    title: 'New Disruption Report',
    message: `${currentOfficer.name} reported a ${selectedType} (${selectedSeverity}) at ${location || currentOfficer.zone}. Report ${newId} pending verification.`,
    severity: selectedSeverity === 'critical' ? 'urgent' : 'advisory',
    targetRole: 'police',
    from: currentOfficer.name
  });

  sendAlert({
    title: 'Report Submitted',
    message: `Your ${selectedType} report (${newId}) has been submitted to Police Control for verification.`,
    severity: 'success',
    targetRole: 'patrol',
    from: 'System'
  });

  document.getElementById('report-description').value = '';
  const preview = document.getElementById('upload-preview');
  if (preview) preview.style.display = 'none';
  const uploadZone = document.getElementById('upload-zone');
  if (uploadZone) uploadZone.style.display = '';

  renderAssignedIncidents();
  renderZoneKPIs();
}

function updateBadges() {
  const alerts = getAlerts().filter(a => (a.targetRole === 'all' || a.targetRole === 'patrol') && a.severity === 'urgent');
  const badge = document.getElementById('patrol-inbox-badge');
  if (badge) {
    badge.textContent = alerts.length;
    badge.style.display = alerts.length > 0 ? '' : 'none';
  }
}

init();
