const STORAGE_KEY = 'ner-platform-state';

export const ROLES = {
  admin: { id: 'admin', name: 'Admin', color: 'var(--accent-red)', icon: '🛡', dashboard: 'dashboard-admin.html' },
  police: { id: 'police', name: 'Police Control', color: 'var(--accent-blue)', icon: '🚔', dashboard: 'dashboard-police.html' },
  driver: { id: 'driver', name: 'Driver', color: 'var(--accent-green)', icon: '🚛', dashboard: 'dashboard-driver.html' },
  patrol: { id: 'patrol', name: 'Patrol Officer', color: 'var(--accent-amber)', icon: '👷', dashboard: 'dashboard-patrol.html' }
};

export function login(role, name) {
  const session = {
    role,
    name: name || defaultName(role),
    loginAt: Date.now()
  };
  sessionStorage.setItem('ner-session', JSON.stringify(session));
  return session;
}

export function getSession() {
  const raw = sessionStorage.getItem('ner-session');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function logout() {
  sessionStorage.removeItem('ner-session');
  window.location.href = 'index.html';
}

export function requireAuth() {
  const session = getSession();
  if (!session) {
    window.location.href = 'index.html';
    return null;
  }
  return session;
}

export function guardRole(expectedRole) {
  const session = requireAuth();
  if (!session) return null;
  if (session.role !== expectedRole) {
    window.location.href = ROLES[session.role].dashboard;
    return null;
  }
  return session;
}

function defaultName(role) {
  const names = {
    admin: 'System Administrator',
    police: 'Control Room Operator',
    driver: 'Driver',
    patrol: 'Patrol Officer'
  };
  return names[role] || 'User';
}

export function getStoredState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function saveStoredState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function navigateTo(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const view = document.getElementById(viewId);
  if (view) {
    view.classList.add('active');
    view.dispatchEvent(new Event('view-shown'));
  }
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-view="${viewId}"]`);
  if (navItem) navItem.classList.add('active');
  const topbarTitle = document.getElementById('topbar-title');
  const topbarSubtitle = document.getElementById('topbar-subtitle');
  if (navItem) {
    if (topbarTitle) topbarTitle.textContent = navItem.dataset.title || navItem.textContent.trim();
    if (topbarSubtitle) topbarSubtitle.textContent = navItem.dataset.subtitle || '';
  }
  if (window.innerWidth <= 768) closeSidebar();
}

export function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.mobile-overlay');
  if (!sidebar) return;
  sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('show');
}

export function closeSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.mobile-overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('show');
}
