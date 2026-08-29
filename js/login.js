import { ROLES, login } from './app.js';
import { initTheme } from './theme.js';

initTheme();

let selectedRole = null;

const roleCards = document.querySelectorAll('.role-card');
roleCards.forEach(card => {
  card.addEventListener('click', () => {
    roleCards.forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    selectedRole = card.dataset.role;
    updateEmailPlaceholder();
  });
});

function updateEmailPlaceholder() {
  const emailInput = document.getElementById('login-email');
  const placeholders = {
    admin: 'admin@ner.gov.in',
    police: 'control@ner-police.gov.in',
    driver: 'driver@ner-transport.gov.in',
    patrol: 'patrol@ner-field.gov.in'
  };
  emailInput.placeholder = placeholders[selectedRole] || 'officer@ner.gov.in';
}

document.getElementById('demo-btn').addEventListener('click', () => {
  if (!selectedRole) {
    selectedRole = 'admin';
    document.querySelector('[data-role="admin"]').classList.add('selected');
  }
  doLogin();
});

document.getElementById('login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!selectedRole) {
    alert('Please select a role first.');
    return;
  }
  doLogin();
});

function doLogin() {
  const role = ROLES[selectedRole];
  const name = role.name === 'Driver' ? 'Bhobora Gogoi' : role.name === 'Patrol Officer' ? 'Khniam Phira' : null;
  login(selectedRole, name);
  window.location.href = role.dashboard;
}

const loginMapEl = document.getElementById('login-map');
if (loginMapEl && window.L) {
  const map = L.map('login-map', {
    center: [25.5788, 91.8933],
    zoom: 6,
    zoomControl: false,
    attributionControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd'
  }).addTo(map);

  const cities = [
    [26.1445, 91.7362], [25.5788, 91.8933], [27.3340, 94.5856],
    [24.8212, 93.9340], [23.7271, 91.2560], [25.8814, 91.8987]
  ];
  cities.forEach(([lat, lng]) => {
    L.circleMarker([lat, lng], {
      radius: 4,
      color: '#3b82f6',
      fillColor: '#3b82f6',
      fillOpacity: 0.5,
      weight: 1
    }).addTo(map);
  });
}
