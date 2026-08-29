import { guardRole, logout, navigateTo, toggleSidebar, closeSidebar } from './app.js';
import { initTheme, toggleTheme, getTheme } from './theme.js';
import { loadDisruptions, getDisruptions, addDisruption } from './disruptions.js';
import { loadVehicles, getVehicles, getCargoIcon } from './vehicles.js';
import { loadRoutes, getRoute } from './routes.js';
import { sendAlert, getAlerts, formatTime, getSeverityInfo } from './alerts.js';
import * as mapUtil from './map.js';

const session = guardRole('driver');
if (!session) throw new Error('Auth required');

initTheme();

let driverMap = null;
let currentVehicle = null;
let selectedHazard = 'Flood';

async function init() {
  await Promise.all([
    loadDisruptions(),
    loadVehicles(),
    loadRoutes()
  ]);

  currentVehicle = getVehicles()[0];

  setupNavigation();
  setupTopbar();
  renderRouteStatus();
  renderCargoInfo();
  renderRouteHazards();
  renderAlertInbox();
  renderProfile();
  initDriverMap();
  updateBadges();

  document.getElementById('logout-btn').addEventListener('click', logout);
  document.getElementById('sos-btn').addEventListener('click', handleSOS);
  document.getElementById('submit-hazard-btn').addEventListener('click', handleSubmitHazard);

  document.querySelectorAll('[data-hazard]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-hazard]').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      selectedHazard = chip.dataset.hazard;
    });
  });
}

function setupNavigation() {
  document.querySelectorAll('.nav-item[data-view]').forEach(item => {
    item.addEventListener('click', () => {
      navigateTo(item.dataset.view);
      if (driverMap) setTimeout(() => driverMap.invalidateSize(), 200);
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
    if (driverMap) mapUtil.swapMapTheme(driverMap, getTheme());
  });
  if (currentVehicle) {
    document.getElementById('user-name').textContent = currentVehicle.driverName;
    document.getElementById('user-vehicle').textContent = currentVehicle.id;
  }
}

function renderRouteStatus() {
  const banner = document.getElementById('route-status-banner');
  const etaEl = document.getElementById('route-eta');

  if (!currentVehicle) return;

  const status = currentVehicle.status;
  const route = getRoute(currentVehicle.routeId);

  banner.className = `route-status-banner ${status}`;
  const statusText = { clear: '✓ ROUTE CLEAR', affected: '⚠ ROUTE AFFECTED', rerouted: '↗ REROUTED' };
  banner.textContent = statusText[status] || status.toUpperCase();

  if (route) {
    const eta = status === 'rerouted' ? route.reroutedEta : route.normalEta;
    etaEl.textContent = `ETA: ${eta}`;
  }
}

function renderCargoInfo() {
  if (!currentVehicle) return;
  const route = getRoute(currentVehicle.routeId);
  document.getElementById('driver-cargo-info').innerHTML = `
    <div class="cargo-row"><span class="cargo-label">Cargo</span><span class="cargo-value">${getCargoIcon(currentVehicle.cargo)} ${currentVehicle.cargo}</span></div>
    <div class="cargo-row"><span class="cargo-label">Priority</span><span class="cargo-value"><span class="badge badge-${currentVehicle.priority === 'critical' ? 'critical' : currentVehicle.priority === 'high' ? 'moderate' : 'low'}">${currentVehicle.priority}</span></span></div>
    <div class="cargo-row"><span class="cargo-label">From</span><span class="cargo-value">${currentVehicle.origin}</span></div>
    <div class="cargo-row"><span class="cargo-label">To</span><span class="cargo-value">${currentVehicle.destination}</span></div>
    <div class="cargo-row"><span class="cargo-label">Route</span><span class="cargo-value">${currentVehicle.routeId}</span></div>
    <div class="cargo-row"><span class="cargo-label">ETA</span><span class="cargo-value">${currentVehicle.eta}</span></div>
  `;
}

function renderRouteHazards() {
  if (!currentVehicle) return;
  const route = getRoute(currentVehicle.routeId);
  if (!route) return;
  const hazards = getDisruptions().filter(d =>
    d.status === 'active' && d.affectedRoutes && d.affectedRoutes.includes(currentVehicle.routeId)
  );
  const container = document.getElementById('driver-route-hazards');
  if (hazards.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-text">No hazards on your route</div></div>';
    return;
  }
  container.innerHTML = hazards.map(h => `
    <div class="alert-item ${h.severity === 'critical' ? 'urgent' : 'advisory'}" style="margin-bottom:8px">
      <span class="alert-icon">${h.type === 'Flood' ? '🌊' : h.type === 'Landslide' ? '⛰' : '🚧'}</span>
      <div class="alert-body">
        <div class="alert-title">${h.type}</div>
        <div class="alert-msg">${h.location}</div>
      </div>
      <span class="badge badge-${h.severity}">${h.severity}</span>
    </div>
  `).join('');
}

function initDriverMap() {
  if (!currentVehicle) return;
  const route = getRoute(currentVehicle.routeId);
  if (!route) return;

  const center = route.path[Math.floor(route.path.length / 2)];
  driverMap = mapUtil.createMap('driver-map', { center, zoom: 10 });

  mapUtil.drawRoutePath(driverMap, route.path, route.status === 'blocked' ? 'blocked' : 'normal');

  if (currentVehicle.status === 'rerouted' || currentVehicle.status === 'affected') {
    mapUtil.drawRoutePath(driverMap, route.alternatePath, 'alternate');
  }

  const vehicleMarker = mapUtil.addVehicleMarker(driverMap, currentVehicle, getCargoIcon(currentVehicle.cargo));

  const hazards = getDisruptions().filter(d =>
    d.status === 'active' && d.affectedRoutes && d.affectedRoutes.includes(currentVehicle.routeId)
  );
  hazards.forEach(h => mapUtil.addDisruptionMarker(driverMap, h));

  mapUtil.addLegend(driverMap, [
    { color: 'green', label: 'Your Route' },
    { color: 'red', label: 'Blocked / Hazard' },
    { color: 'amber', label: 'Alternate Route' }
  ]);

  mapUtil.animateVehicleAlongRoute(driverMap, vehicleMarker, route.path, 15000);
}

function renderAlertInbox() {
  const alerts = getAlerts().filter(a => a.targetRole === 'all' || a.targetRole === 'driver');
  document.getElementById('driver-alert-count').textContent = `${alerts.length} alerts`;
  const container = document.getElementById('driver-alert-inbox');
  if (alerts.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔕</div><div class="empty-state-text">No alerts received</div></div>';
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

function renderProfile() {
  if (!currentVehicle) return;
  document.getElementById('profile-name').textContent = currentVehicle.driverName;
  document.getElementById('profile-id').textContent = `${currentVehicle.driverId} · ${currentVehicle.id}`;
  document.getElementById('profile-avatar').textContent = currentVehicle.driverName.charAt(0);
  document.getElementById('profile-cargo-info').innerHTML = `
    <div class="cargo-row"><span class="cargo-label">Vehicle ID</span><span class="cargo-value">${currentVehicle.id}</span></div>
    <div class="cargo-row"><span class="cargo-label">Driver ID</span><span class="cargo-value">${currentVehicle.driverId}</span></div>
    <div class="cargo-row"><span class="cargo-label">Cargo</span><span class="cargo-value">${getCargoIcon(currentVehicle.cargo)} ${currentVehicle.cargo}</span></div>
    <div class="cargo-row"><span class="cargo-label">Priority</span><span class="cargo-value">${currentVehicle.priority}</span></div>
    <div class="cargo-row"><span class="cargo-label">Route</span><span class="cargo-value">${currentVehicle.routeId}</span></div>
    <div class="cargo-row"><span class="cargo-label">Origin</span><span class="cargo-value">${currentVehicle.origin}</span></div>
    <div class="cargo-row"><span class="cargo-label">Destination</span><span class="cargo-value">${currentVehicle.destination}</span></div>
    <div class="cargo-row"><span class="cargo-label">Contact</span><span class="cargo-value">${currentVehicle.phone}</span></div>
  `;
}

function handleSOS() {
  sendAlert({
    title: '🆘 SOS EMERGENCY',
    message: `Driver ${currentVehicle.driverName} (${currentVehicle.id}) has triggered SOS at location ${currentVehicle.lat}, ${currentVehicle.lng}. Immediate assistance required.`,
    severity: 'urgent',
    targetRole: 'police',
    from: currentVehicle.driverName
  });
  const btn = document.getElementById('sos-btn');
  btn.textContent = '✓ SOS Sent — Help on the way';
  btn.style.background = 'var(--accent-green)';
  setTimeout(() => {
    btn.textContent = '🆘 SOS Emergency';
    btn.style.background = '';
  }, 5000);
}

function handleSubmitHazard() {
  const desc = document.getElementById('hazard-desc').value.trim();
  const newId = 'DIS-' + String(Math.floor(Math.random() * 999)).padStart(3, '0');
  addDisruption({
    id: newId,
    type: selectedHazard,
    severity: 'moderate',
    lat: currentVehicle.lat,
    lng: currentVehicle.lng,
    location: `${currentVehicle.origin} → ${currentVehicle.destination} route`,
    description: desc || `Hazard reported by driver ${currentVehicle.driverName}`,
    status: 'active',
    reportedBy: currentVehicle.driverName,
    reportedAt: new Date().toISOString(),
    verified: false,
    affectedRoutes: [currentVehicle.routeId]
  });
  sendAlert({
    title: 'Hazard Reported',
    message: `Driver ${currentVehicle.driverName} reported a ${selectedHazard} on route ${currentVehicle.routeId}. Report ${newId} sent for verification.`,
    severity: 'advisory',
    targetRole: 'police',
    from: currentVehicle.driverName
  });
  sendAlert({
    title: 'Hazard Report Submitted',
    message: `Your ${selectedHazard} report (${newId}) has been sent to Police Control and nearby Patrol Officers.`,
    severity: 'success',
    targetRole: 'driver',
    from: 'System'
  });
  document.getElementById('hazard-desc').value = '';
  renderRouteHazards();
}

function updateBadges() {
  const alerts = getAlerts().filter(a => (a.targetRole === 'all' || a.targetRole === 'driver') && a.severity === 'urgent');
  const badge = document.getElementById('driver-alert-badge');
  if (badge) {
    badge.textContent = alerts.length;
    badge.style.display = alerts.length > 0 ? '' : 'none';
  }
}

init();
