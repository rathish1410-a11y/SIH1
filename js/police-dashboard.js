import { guardRole, logout, navigateTo, toggleSidebar, closeSidebar } from './app.js';
import { initTheme, toggleTheme, getTheme } from './theme.js';
import { loadDisruptions, getDisruptions, getActiveDisruptions, getCriticalDisruptions, getUnverifiedDisruptions } from './disruptions.js';
import { loadVehicles, getVehicles, getAffectedVehicles, getCargoIcon } from './vehicles.js';
import { loadRoutes, getRoute } from './routes.js';
import { loadOfficers } from './patrol.js';
import { sendAlert, getAlerts, formatTime } from './alerts.js';
import * as police from './police.js';
import * as mapUtil from './map.js';

const session = guardRole('police');
if (!session) throw new Error('Auth required');

initTheme();

let officers = [];
let situationMap = null;
let incidentLog = [];

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
  initSituationMap();
  renderVerificationQueue();
  renderDispatchBoard();
  renderPatrolTable();
  renderTimeline();
  populateReportSelect();
  renderAlertHistory();
  updateBadges();

  buildIncidentLog();

  document.getElementById('logout-btn').addEventListener('click', logout);
  document.getElementById('police-send-alert').addEventListener('click', handleSendAlert);
  document.getElementById('generate-report-btn').addEventListener('click', handleGenerateReport);
}

function setupNavigation() {
  document.querySelectorAll('.nav-item[data-view]').forEach(item => {
    item.addEventListener('click', () => {
      navigateTo(item.dataset.view);
      if (situationMap) setTimeout(() => situationMap.invalidateSize(), 200);
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
    if (situationMap) mapUtil.swapMapTheme(situationMap, getTheme());
  });
  if (session.name) {
    document.getElementById('user-name').textContent = session.name;
  }
}

function renderKPIs() {
  const active = getActiveDisruptions();
  const critical = getCriticalDisruptions();
  const affected = getAffectedVehicles();
  const unverified = getUnverifiedDisruptions();

  const kpis = [
    { icon: '⚠', color: 'var(--accent-red)', bg: 'rgba(239,68,68,0.12)', value: active.length, label: 'Active Disruptions', trend: `${critical.length} critical` },
    { icon: '🚛', color: 'var(--accent-amber)', bg: 'rgba(245,158,11,0.12)', value: affected.length, label: 'Affected Vehicles', trend: 'Need rerouting' },
    { icon: '✅', color: 'var(--accent-blue)', bg: 'rgba(59,130,246,0.12)', value: unverified.length, label: 'Pending Verification', trend: 'From patrol' },
    { icon: '👷', color: 'var(--accent-green)', bg: 'rgba(16,185,129,0.12)', value: officers.filter(o => o.status !== 'off-duty').length, label: 'Officers Active', trend: `of ${officers.length}` }
  ];

  document.getElementById('police-kpis').innerHTML = kpis.map(k => `
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

function initSituationMap() {
  situationMap = mapUtil.createMap('situation-map', { zoom: 7 });
  const markers = [];
  getDisruptions().forEach(d => {
    if (d.status !== 'rejected') markers.push(mapUtil.addDisruptionMarker(situationMap, d));
  });
  getVehicles().forEach(v => markers.push(mapUtil.addVehicleMarker(situationMap, v, getCargoIcon(v.cargo))));
  officers.forEach(o => markers.push(mapUtil.addOfficerMarker(situationMap, o)));
  mapUtil.fitToMarkers(situationMap, markers);
  mapUtil.addLegend(situationMap, [
    { color: 'red', label: 'Critical Disruption' },
    { color: 'amber', label: 'Moderate Disruption' },
    { color: 'green', label: 'Vehicle / Low' },
    { color: 'blue', label: 'Patrol Officer' }
  ]);
  mapUtil.addWeatherOverlay(situationMap);
}

function renderVerificationQueue() {
  const queue = getUnverifiedDisruptions();
  document.getElementById('verify-count').textContent = `${queue.length} pending`;
  const container = document.getElementById('verification-queue');
  if (queue.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-text">No pending verifications</div></div>';
    return;
  }
  container.innerHTML = queue.map(d => `
    <div class="incident-card">
      <div class="incident-card-header">
        <span class="incident-card-title">${d.type} · ${d.id}</span>
        <span class="badge badge-${d.severity}">${d.severity}</span>
      </div>
      <div class="incident-card-location">📍 ${d.location}</div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">${d.description}</div>
      <div style="font-size:11px;color:var(--text-dim)">Reported by ${d.reportedBy} · ${formatTime(d.reportedAt)}</div>
      <div class="incident-actions">
        <button class="btn-sm btn-green" onclick="window._policeApprove('${d.id}')">✓ Approve</button>
        <button class="btn-sm btn-red" onclick="window._policeReject('${d.id}')">✕ Reject</button>
        <button class="btn-sm btn-amber" onclick="window._policeEscalate('${d.id}')">⬆ Escalate</button>
      </div>
    </div>
  `).join('');
}

window._policeApprove = function(id) {
  police.approveDisruption(id);
  addLog(`Disruption ${id} verified and approved`);
  renderVerificationQueue();
  renderKPIs();
  updateBadges();
};

window._policeReject = function(id) {
  police.rejectDisruption(id);
  addLog(`Disruption ${id} rejected`);
  renderVerificationQueue();
  renderKPIs();
  updateBadges();
};

window._policeEscalate = function(id) {
  police.escalateDisruption(id);
  addLog(`Disruption ${id} escalated to CRITICAL`);
  renderVerificationQueue();
  renderKPIs();
  updateBadges();
};

function renderDispatchBoard() {
  const board = police.getDispatchBoard();
  document.getElementById('dispatch-count').textContent = `${board.length} affected`;
  const body = document.getElementById('dispatch-table-body');
  if (board.length === 0) {
    body.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-state-text">No affected vehicles</div></div></td></tr>';
    return;
  }
  body.innerHTML = board.map(v => `
    <tr>
      <td><strong>${v.id}</strong></td>
      <td>${v.driverName}</td>
      <td>${getCargoIcon(v.cargo)} ${v.cargo}</td>
      <td>${v.routeId}</td>
      <td><span class="badge badge-critical">${v.status}</span></td>
      <td>${v.alternateRoute ? `<span class="badge badge-moderate">${v.alternateRoute.eta}</span>` : '<span style="color:var(--text-muted)">--</span>'}</td>
      <td>
        <button class="btn-sm btn-blue" onclick="window._policeReroute('${v.id}')">↗ Reroute</button>
        <button class="btn-sm btn-ghost" onclick="window._policeCall('${v.id}','call')">📞</button>
        <button class="btn-sm btn-ghost" onclick="window._policeCall('${v.id}','message')">💬</button>
      </td>
    </tr>
  `).join('');
}

window._policeReroute = function(id) {
  const result = police.assignAlternateRoute(id);
  if (result) {
    addLog(`Alternate route assigned to ${id}`);
    renderDispatchBoard();
    renderKPIs();
  }
};

window._policeCall = function(id, method) {
  police.contactDriver(id, method);
};

function renderPatrolTable() {
  const activeCount = officers.filter(o => o.status !== 'off-duty').length;
  document.getElementById('patrol-active-count').textContent = `${activeCount} active`;
  const body = document.getElementById('patrol-table-body');
  body.innerHTML = officers.map(o => `
    <tr>
      <td><strong>${o.id}</strong></td>
      <td>${o.name}</td>
      <td>${o.zone}</td>
      <td><span class="status-indicator"><span class="status-dot ${o.status === 'off-duty' ? 'offline' : o.status === 'en-route' ? 'away' : 'online'}"></span>${o.status}</span></td>
      <td>${o.assignedIncidents.length} incident(s)</td>
      <td><button class="btn-sm btn-ghost" onclick="alert('Call ${o.name} at ${o.phone}')">📞 ${o.phone}</button></td>
    </tr>
  `).join('');
}

function buildIncidentLog() {
  incidentLog = [];
  getDisruptions().forEach(d => {
    incidentLog.push({ time: d.reportedAt, text: `${d.type} reported at ${d.location}`, severity: d.severity });
    if (d.verified) {
      incidentLog.push({ time: d.reportedAt, text: `${d.id} verified by Police Control`, severity: d.severity });
    }
  });
  incidentLog.sort((a, b) => new Date(b.time) - new Date(a.time));
}

function renderTimeline() {
  const container = document.getElementById('incident-timeline');
  if (incidentLog.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-text">No incidents logged</div></div>';
    return;
  }
  container.innerHTML = incidentLog.slice(0, 15).map(item => `
    <li class="timeline-item">
      <div class="timeline-dot ${item.severity}"></div>
      <div class="timeline-time">${formatTime(item.time)}</div>
      <div class="timeline-text">${item.text}</div>
    </li>
  `).join('');
}

function populateReportSelect() {
  const select = document.getElementById('report-disruption-select');
  select.innerHTML = getDisruptions().map(d => `<option value="${d.id}">${d.id} · ${d.type} · ${d.location.split(',')[0]}</option>`).join('');
}

function handleGenerateReport() {
  const id = document.getElementById('report-disruption-select').value;
  const report = police.generateIncidentReport(id);
  const container = document.getElementById('report-output');
  if (!report) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Select a disruption to generate report</div></div>';
    return;
  }
  container.innerHTML = `
    <div style="padding:20px;border:1px solid var(--border);border-radius:12px;background:var(--bg-elevated)">
      <h3 style="margin-bottom:16px">📄 Incident Report — ${report.id}</h3>
      <div class="cargo-info">
        <div class="cargo-row"><span class="cargo-label">Type</span><span class="cargo-value">${report.type}</span></div>
        <div class="cargo-row"><span class="cargo-label">Severity</span><span class="cargo-value"><span class="badge badge-${report.severity}">${report.severity}</span></span></div>
        <div class="cargo-row"><span class="cargo-label">Location</span><span class="cargo-value">${report.location}</span></div>
        <div class="cargo-row"><span class="cargo-label">Status</span><span class="cargo-value">${report.status}</span></div>
        <div class="cargo-row"><span class="cargo-label">Reported By</span><span class="cargo-value">${report.reportedBy}</span></div>
        <div class="cargo-row"><span class="cargo-label">Reported At</span><span class="cargo-value">${new Date(report.reportedAt).toLocaleString()}</span></div>
        <div class="cargo-row"><span class="cargo-label">Verified</span><span class="cargo-value">${report.verified ? 'Yes' : 'No'}</span></div>
      </div>
      <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
        <div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px">Description</div>
        <div style="font-size:13px;color:var(--text-secondary)">${report.description}</div>
      </div>
      <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
        <div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px">Affected Vehicles (${report.affectedVehicles.length})</div>
        ${report.affectedVehicles.map(v => `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">• ${v.id} — ${v.driver} — ${v.cargo} — ${v.status}</div>`).join('') || '<div style="font-size:12px;color:var(--text-muted)">None</div>'}
      </div>
      <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);font-size:11px;color:var(--text-dim)">
        Generated at ${new Date(report.generatedAt).toLocaleString()}
      </div>
    </div>
  `;
  addLog(`Report generated for ${id}`);
}

function handleSendAlert() {
  const title = document.getElementById('police-alert-title').value.trim();
  const message = document.getElementById('police-alert-msg').value.trim();
  if (!title || !message) {
    sendAlert({ title: 'Validation Error', message: 'Please enter title and message.', severity: 'advisory', targetRole: 'police', from: 'System' });
    return;
  }
  const severity = document.getElementById('police-alert-severity').value;
  const target = document.getElementById('police-alert-target').value;
  sendAlert({ title, message, severity, targetRole: target, from: 'Police Control' });
  addLog(`Alert sent: ${title}`);
  document.getElementById('police-alert-title').value = '';
  document.getElementById('police-alert-msg').value = '';
  renderAlertHistory();
}

function renderAlertHistory() {
  const alerts = getAlerts().filter(a => a.from === 'Police Control' || a.from === 'Admin');
  const container = document.getElementById('police-alert-history');
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

function addLog(text) {
  incidentLog.unshift({ time: new Date().toISOString(), text, severity: 'moderate' });
  renderTimeline();
}

function updateBadges() {
  const unverified = getUnverifiedDisruptions().length;
  const badge = document.getElementById('police-verify-badge');
  if (badge) {
    badge.textContent = unverified;
    badge.style.display = unverified > 0 ? '' : 'none';
  }
}

init();
