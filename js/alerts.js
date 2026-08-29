let alerts = [];
let listeners = [];

const SEVERITY = {
  urgent: { label: 'Urgent', icon: '🔴', class: 'urgent' },
  advisory: { label: 'Advisory', icon: '🟡', class: 'advisory' },
  info: { label: 'Info', icon: '🟢', class: 'info' },
  success: { label: 'Success', icon: '✅', class: 'success' }
};

export function sendAlert({ title, message, severity = 'info', targetRole = 'all', from = 'System' }) {
  const alert = {
    id: 'ALT-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    title,
    message,
    severity,
    targetRole,
    from,
    timestamp: new Date().toISOString()
  };
  alerts.unshift(alert);
  notify();
  showToast(alert);
  return alert;
}

export function getAlerts() {
  return alerts;
}

export function getAlertsForRole(role) {
  return alerts.filter(a => a.targetRole === 'all' || a.targetRole === role);
}

export function onAlert(fn) {
  listeners.push(fn);
}

function notify() {
  listeners.forEach(fn => fn(alerts));
}

export function getSeverityInfo(severity) {
  return SEVERITY[severity] || SEVERITY.info;
}

export function showToast(alert) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const info = getSeverityInfo(alert.severity);
  const toast = document.createElement('div');
  toast.className = `toast ${info.class}`;
  toast.innerHTML = `
    <span class="toast-icon">${info.icon}</span>
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(alert.title)}</div>
      <div class="toast-msg">${escapeHtml(alert.message)}</div>
    </div>
    <button class="toast-close">✕</button>
  `;

  toast.querySelector('.toast-close').addEventListener('click', () => removeToast(toast));
  container.appendChild(toast);

  setTimeout(() => removeToast(toast), 6000);
}

function removeToast(toast) {
  if (!toast.parentNode) return;
  toast.classList.add('removing');
  setTimeout(() => toast.remove(), 300);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function formatTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return d.toLocaleDateString();
}
