import { guardRole, logout, navigateTo, toggleSidebar, closeSidebar } from './app.js';
import { initTheme, toggleTheme, getTheme } from './theme.js';
import { loadDisruptions, getDisruptions, getActiveDisruptions, getCriticalDisruptions, getUnverifiedDisruptions, getDisruptionsByType, getDisruptionsBySeverity, verifyDisruption, getTypeIcon } from './disruptions.js';
import { loadVehicles, getVehicles, getAffectedVehicles, getCargoIcon, removeVehicle } from './vehicles.js';
import { loadRoutes, getRoutes } from './routes.js';
import { loadOfficers } from './patrol.js';
import { sendAlert, getAlerts, formatTime } from './alerts.js';
import * as mapUtil from './map.js';

const session = guardRole('admin');
if (!session) throw new Error('Auth required');

initTheme();

let officers = [];
let overviewMap = null;
let fullMap = null;
let aiEnabled = true;
let systemLogs = [];

async function init() {
  await Promise.all([
    loadDisruptions(),
    loadVehicles(),
    loadRoutes(),
    loadOfficers().then(o => officers = o)
  ]);

  setupNavigation();
  setupTopbar();
  renderKPIs();
  renderActiveDisruptions();
  renderRecentAlerts();
  renderDisruptionsTable();
  renderFleetTable();
  renderUsersTable();
  renderAnalytics();
  renderLogs();
  renderAILogs();
  updateBadges();

  document.getElementById('logout-btn').addEventListener('click', logout);

  document.getElementById('add-user-btn').addEventListener('click', () => {
    sendAlert({ title: 'User Management', message: 'Add user form would open here (demo mode).', severity: 'info', targetRole: 'admin', from: 'Admin' });
  });

  document.getElementById('add-vehicle-btn').addEventListener('click', () => {
    sendAlert({ title: 'Fleet Management', message: 'Add vehicle form would open here (demo mode).', severity: 'info', targetRole: 'admin', from: 'Admin' });
  });

  document.getElementById('send-broadcast-btn').addEventListener('click', handleBroadcast);

  const aiToggle = document.getElementById('ai-toggle');
  aiToggle.addEventListener('click', () => {
    aiEnabled = !aiEnabled;
    aiToggle.classList.toggle('on', aiEnabled);
    addLog(aiEnabled ? 'AI Detection Engine activated' : 'AI Detection Engine deactivated', '🤖');
    sendAlert({
      title: 'AI Detection ' + (aiEnabled ? 'Enabled' : 'Disabled'),
      message: `AI monitoring has been ${aiEnabled ? 'activated' : 'deactivated'} by administrator.`,
      severity: aiEnabled ? 'success' : 'advisory',
      targetRole: 'all',
      from: 'Admin'
    });
  });
}

function setupNavigation() {
  document.querySelectorAll('.nav-item[data-view]').forEach(item => {
    item.addEventListener('click', () => {
      navigateTo(item.dataset.view);
      if (item.dataset.view === 'view-overview' && !overviewMap) {
        setTimeout(() => initOverviewMap(), 100);
      }
      if (item.dataset.view === 'view-map' && !fullMap) {
        setTimeout(() => initFullMap(), 100);
      }
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
    if (overviewMap) mapUtil.swapMapTheme(overviewMap, getTheme());
    if (fullMap) mapUtil.swapMapTheme(fullMap, getTheme());
  });
  if (session.name) {
    document.getElementById('user-name').textContent = session.name;
  }
}

function renderKPIs() {
  const disruptions = getDisruptions();
  const active = getActiveDisruptions();
  const critical = getCriticalDisruptions();
  const affectedVehicles = getAffectedVehicles();
  const activeOfficers = officers.filter(o => o.status !== 'off-duty');

  const kpis = [
    { icon: '⚠', color: 'var(--accent-red)', bg: 'rgba(239,68,68,0.12)', value: active.length, label: 'Active Disruptions', trend: `${critical.length} critical` },
    { icon: '🚛', color: 'var(--accent-green)', bg: 'rgba(16,185,129,0.12)', value: getVehicles().length, label: 'Total Vehicles', trend: `${affectedVehicles.length} affected` },
    { icon: '📢', color: 'var(--accent-blue)', bg: 'rgba(59,130,246,0.12)', value: getAlerts().length, label: 'Alerts Sent', trend: 'Last 24h' },
    { icon: '👷', color: 'var(--accent-amber)', bg: 'rgba(245,158,11,0.12)', value: activeOfficers.length, label: 'Officers Online', trend: `of ${officers.length} total` }
  ];

  document.getElementById('admin-kpis').innerHTML = kpis.map(k => `
    <div class="kpi-card" style="--kpi-color:${k.color};--kpi-bg:${k.bg}">
      <div class="kpi-header">
        <div class="kpi-icon">${k.icon}</div>
        <span class="kpi-trend">${k.trend}</span>
      </div>
      <div class="kpi-value">${k.value}</div>
      <div class="kpi-label">${k.label}</div>
    </div>
  `).join('');
}

function renderActiveDisruptions() {
  const active = getActiveDisruptions();
  const container = document.getElementById('admin-active-disruptions');
  if (active.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-text">No active disruptions</div></div>';
    return;
  }
  container.innerHTML = active.slice(0, 5).map(d => `
    <div class="alert-item ${d.severity === 'critical' ? 'urgent' : d.severity === 'moderate' ? 'advisory' : 'info'}" style="margin-bottom:8px">
      <span class="alert-icon">${getTypeIcon(d.type)}</span>
      <div class="alert-body">
        <div class="alert-title">${d.type} · ${d.location.split(',')[0]}</div>
        <div class="alert-msg">${d.description || ''}</div>
        <div class="alert-time">${formatTime(d.reportedAt)}</div>
      </div>
      <span class="badge badge-${d.severity}">${d.severity}</span>
    </div>
  `).join('');
}

function renderRecentAlerts() {
  const alerts = getAlerts().slice(0, 5);
  const container = document.getElementById('admin-recent-alerts');
  if (alerts.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔕</div><div class="empty-state-text">No alerts sent yet</div></div>';
    return;
  }
  container.innerHTML = alerts.map(a => `
    <div class="alert-item ${a.severity}" style="margin-bottom:8px">
      <span class="alert-icon">${a.severity === 'urgent' ? '🔴' : a.severity === 'advisory' ? '🟡' : '🟢'}</span>
      <div class="alert-body">
        <div class="alert-title">${a.title}</div>
        <div class="alert-msg">${a.message}</div>
        <div class="alert-time">${formatTime(a.timestamp)}</div>
      </div>
    </div>
  `).join('');
}

function initOverviewMap() {
  overviewMap = mapUtil.createMap('overview-map', { zoom: 6 });
  addAllMarkers(overviewMap);
  mapUtil.addLegend(overviewMap, [
    { color: 'red', label: 'Critical Disruption' },
    { color: 'amber', label: 'Moderate Disruption' },
    { color: 'green', label: 'Low / Vehicle' },
    { color: 'blue', label: 'Patrol Officer' }
  ]);
  mapUtil.addWeatherOverlay(overviewMap);
}

function initFullMap() {
  fullMap = mapUtil.createMap('full-map', { zoom: 7 });
  addAllMarkers(fullMap);
  mapUtil.addLegend(fullMap, [
    { color: 'red', label: 'Critical Disruption' },
    { color: 'amber', label: 'Moderate Disruption' },
    { color: 'green', label: 'Low / Vehicle' },
    { color: 'blue', label: 'Patrol Officer' }
  ]);
  mapUtil.addWeatherOverlay(fullMap);
  getRoutes().forEach(r => mapUtil.drawRoute(fullMap, r, r.status === 'blocked' ? 'blocked' : 'normal'));
}

function addAllMarkers(map) {
  const markers = [];
  getDisruptions().forEach(d => {
    if (d.status !== 'rejected') {
      markers.push(mapUtil.addDisruptionMarker(map, d));
    }
  });
  getVehicles().forEach(v => {
    const icon = getCargoIcon(v.cargo);
    markers.push(mapUtil.addVehicleMarker(map, v, icon));
  });
  officers.forEach(o => {
    markers.push(mapUtil.addOfficerMarker(map, o));
  });
  if (markers.length > 0) mapUtil.fitToMarkers(map, markers);
}

function renderDisruptionsTable() {
  const disruptions = getDisruptions();
  document.getElementById('disruption-count').textContent = `${disruptions.length} total`;
  const body = document.getElementById('disruptions-table-body');
  body.innerHTML = disruptions.map(d => `
    <tr>
      <td><strong>${d.id}</strong></td>
      <td>${d.type}</td>
      <td>${d.location}</td>
      <td><span class="badge badge-${d.severity}">${d.severity}</span></td>
      <td><span class="badge badge-neutral">${d.status}</span></td>
      <td>${d.verified ? '<span class="badge badge-info">✓ Verified</span>' : '<span class="badge badge-critical">Pending</span>'}</td>
      <td>${d.reportedBy}</td>
      <td>
        ${!d.verified ? `<button class="btn-sm btn-green" onclick="window._adminApprove('${d.id}')">Approve</button>` : ''}
        ${!d.verified ? `<button class="btn-sm btn-red" onclick="window._adminReject('${d.id}')">Reject</button>` : ''}
        ${d.verified ? '<span style="color:var(--text-muted);font-size:12px">No actions</span>' : ''}
      </td>
    </tr>
  `).join('');
}

window._adminApprove = function(id) {
  verifyDisruption(id, true);
  addLog(`Disruption ${id} approved`, '✅');
  sendAlert({ title: 'Disruption Approved', message: `${id} has been approved by admin.`, severity: 'success', targetRole: 'all', from: 'Admin' });
  renderDisruptionsTable();
  updateBadges();
};

window._adminReject = function(id) {
  verifyDisruption(id, false);
  const d = getDisruptions().find(x => x.id === id);
  if (d) d.status = 'rejected';
  addLog(`Disruption ${id} rejected`, '✕');
  renderDisruptionsTable();
  updateBadges();
};

function renderFleetTable() {
  const vehicles = getVehicles();
  const body = document.getElementById('fleet-table-body');
  body.innerHTML = vehicles.map(v => `
    <tr>
      <td><strong>${v.id}</strong></td>
      <td>${v.driverName}</td>
      <td>${getCargoIcon(v.cargo)} ${v.cargo}</td>
      <td><span class="badge badge-${v.priority === 'critical' ? 'critical' : v.priority === 'high' ? 'moderate' : 'low'}">${v.priority}</span></td>
      <td>${v.routeId}</td>
      <td><span class="badge badge-${v.status === 'clear' ? 'low' : v.status === 'affected' ? 'critical' : 'moderate'}">${v.status}</span></td>
      <td>${v.eta}</td>
      <td><button class="btn-sm btn-ghost" onclick="window._adminRemoveVehicle('${v.id}')">Remove</button></td>
    </tr>
  `).join('');
}

window._adminRemoveVehicle = function(id) {
  removeVehicle(id);
  addLog(`Vehicle ${id} removed from fleet`, '🚛');
  renderFleetTable();
  renderKPIs();
};

function renderUsersTable() {
  const users = [];
  officers.forEach(o => users.push({ id: o.id, name: o.name, role: 'Patrol Officer', zone: o.zone, status: o.status }));
  getVehicles().forEach(v => users.push({ id: v.driverId, name: v.driverName, role: 'Driver', zone: v.routeId, status: v.status }));

  const body = document.getElementById('users-table-body');
  body.innerHTML = users.map(u => `
    <tr>
      <td><strong>${u.id}</strong></td>
      <td>${u.name}</td>
      <td><span class="badge badge-${u.role === 'Patrol Officer' ? 'moderate' : 'low'}">${u.role}</span></td>
      <td>${u.zone}</td>
      <td><span class="status-indicator"><span class="status-dot ${u.status === 'off-duty' ? 'offline' : u.status === 'en-route' ? 'away' : 'online'}"></span>${u.status}</span></td>
      <td><button class="btn-sm btn-ghost" onclick="alert('Remove user ${u.id} (demo)')">Remove</button></td>
    </tr>
  `).join('');
}

function handleBroadcast() {
  const title = document.getElementById('broadcast-title').value.trim();
  const message = document.getElementById('broadcast-message').value.trim();
  if (!title || !message) {
    sendAlert({ title: 'Validation Error', message: 'Please enter both title and message.', severity: 'advisory', targetRole: 'admin', from: 'System' });
    return;
  }
  const severity = document.getElementById('broadcast-severity').value;
  const target = document.getElementById('broadcast-target').value;
  sendAlert({ title, message, severity, targetRole: target, from: 'Admin' });
  addLog(`Broadcast sent: ${title}`, '📢');
  document.getElementById('broadcast-title').value = '';
  document.getElementById('broadcast-message').value = '';
  renderBroadcastHistory();
}

function renderBroadcastHistory() {
  const alerts = getAlerts();
  const container = document.getElementById('broadcast-history');
  if (alerts.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">No alerts sent yet</div></div>';
    return;
  }
  container.innerHTML = alerts.slice(0, 10).map(a => `
    <div class="alert-item ${a.severity}" style="margin-bottom:8px">
      <span class="alert-icon">${a.severity === 'urgent' ? '🔴' : a.severity === 'advisory' ? '🟡' : a.severity === 'success' ? '✅' : '🟢'}</span>
      <div class="alert-body">
        <div class="alert-title">${a.title}</div>
        <div class="alert-msg">${a.message}</div>
        <div class="alert-time">To: ${a.targetRole} · ${formatTime(a.timestamp)}</div>
      </div>
    </div>
  `).join('');
}

function renderAnalytics() {
  const byType = getDisruptionsByType();
  const bySeverity = getDisruptionsBySeverity();
  const vehicles = getVehicles();
  const fleetStatus = {
    clear: vehicles.filter(v => v.status === 'clear').length,
    affected: vehicles.filter(v => v.status === 'affected').length,
    rerouted: vehicles.filter(v => v.status === 'rerouted').length
  };

  const maxType = Math.max(...Object.values(byType), 1);
  document.getElementById('chart-by-type').innerHTML = Object.entries(byType).map(([type, count]) => `
    <div class="chart-bar">
      <div class="chart-bar-fill" style="height:${(count / maxType) * 100}%"><span class="chart-value">${count}</span></div>
      <div class="chart-bar-label">${type.split(' ')[0]}</div>
    </div>
  `).join('');

  const maxSev = Math.max(bySeverity.critical, bySeverity.moderate, bySeverity.low, 1);
  const sevColors = { critical: 'var(--accent-red)', moderate: 'var(--accent-amber)', low: 'var(--accent-green)' };
  document.getElementById('chart-by-severity').innerHTML = ['critical', 'moderate', 'low'].map(s => `
    <div class="chart-bar">
      <div class="chart-bar-fill" style="height:${(bySeverity[s] / maxSev) * 100}%;background:linear-gradient(180deg,${sevColors[s]},${sevColors[s]})"><span class="chart-value">${bySeverity[s]}</span></div>
      <div class="chart-bar-label">${s}</div>
    </div>
  `).join('');

  const maxFleet = Math.max(fleetStatus.clear, fleetStatus.affected, fleetStatus.rerouted, 1);
  const fleetColors = { clear: 'var(--accent-green)', affected: 'var(--accent-red)', rerouted: 'var(--accent-amber)' };
  document.getElementById('chart-fleet-status').innerHTML = ['clear', 'affected', 'rerouted'].map(s => `
    <div class="chart-bar">
      <div class="chart-bar-fill" style="height:${(fleetStatus[s] / maxFleet) * 100}%;background:linear-gradient(180deg,${fleetColors[s]},${fleetColors[s]})"><span class="chart-value">${fleetStatus[s]}</span></div>
      <div class="chart-bar-label">${s}</div>
    </div>
  `).join('');
}

function addLog(text, icon = '•') {
  systemLogs.unshift({ text, icon, time: new Date().toISOString() });
  renderLogs();
}

function renderLogs() {
  const container = document.getElementById('admin-log-list');
  if (systemLogs.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-text">No logs yet</div></div>';
    return;
  }
  container.innerHTML = systemLogs.map(log => `
    <div class="log-entry">
      <span class="log-icon">${log.icon}</span>
      <span class="log-time">${new Date(log.time).toLocaleTimeString()}</span>
      <span class="log-text">${log.text}</span>
    </div>
  `).join('');
}

function renderAILogs() {
  const aiLogs = getDisruptions().filter(d => d.reportedBy === 'AI-Detection-Engine');
  const container = document.getElementById('ai-log-list');
  if (aiLogs.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-text">No AI detections yet</div></div>';
    return;
  }
  container.innerHTML = aiLogs.map(d => `
    <div class="log-entry">
      <span class="log-icon">🤖</span>
      <span class="log-time">${formatTime(d.reportedAt)}</span>
      <span class="log-text">${d.id} · ${d.type} · ${d.location.split(',')[0]} · Confidence: ${85 + Math.floor(Math.random() * 10)}%</span>
    </div>
  `).join('');
}

function updateBadges() {
  const unverified = getUnverifiedDisruptions().length;
  const badge = document.getElementById('admin-disruption-badge');
  if (badge) {
    badge.textContent = unverified;
    badge.style.display = unverified > 0 ? '' : 'none';
  }
}

init();
