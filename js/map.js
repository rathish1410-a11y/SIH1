const NER_CENTER = [25.5788, 91.8933];
const NER_ZOOM = 7;

const WEATHER_CONDITIONS = [
  { icon: '🌧', desc: 'Heavy Rain', temp: '22°C' },
  { icon: '⛅', desc: 'Partly Cloudy', temp: '28°C' },
  { icon: '⛈', desc: 'Thunderstorm', temp: '24°C' },
  { icon: '🌫', desc: 'Foggy', temp: '18°C' },
  { icon: '☀', desc: 'Clear', temp: '31°C' }
];

export function createMap(elementId, opts = {}) {
  const map = L.map(elementId, {
    center: opts.center || NER_CENTER,
    zoom: opts.zoom || NER_ZOOM,
    zoomControl: true,
    attributionControl: true
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap, © CARTO',
    subdomains: 'abcd',
    maxZoom: 18
  }).addTo(map);

  if (document.documentElement.getAttribute('data-theme') === 'light') {
    map.eachLayer(l => {
      if (l instanceof L.TileLayer) {
        l.setUrl('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png');
      }
    });
  }

  return map;
}

export function swapMapTheme(map, theme) {
  map.eachLayer(l => {
    if (l instanceof L.TileLayer) {
      const url = theme === 'light'
        ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      l.setUrl(url);
    }
  });
}

const SEVERITY_ICONS = {
  Flood: '🌊',
  Landslide: '⛰',
  'Road Blockage': '🚧',
  'Bridge Damage': '🏗',
  Other: '⚠'
};

export function addDisruptionMarker(map, disruption) {
  const icon = SEVERITY_ICONS[disruption.type] || '⚠';
  const marker = L.marker([disruption.lat, disruption.lng], {
    icon: L.divIcon({
      className: '',
      html: `<div class="custom-marker marker-disruption ${disruption.severity}">${icon}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    })
  });

  marker.bindPopup(`
    <div class="popup-title">${icon} ${disruption.type}</div>
    <div class="popup-row"><strong>${disruption.location}</strong></div>
    <div class="popup-row">Severity: ${disruption.severity}</div>
    <div class="popup-row">Status: ${disruption.status}</div>
    <div class="popup-row">Reported by: ${disruption.reportedBy}</div>
    ${disruption.description ? `<div class="popup-row" style="margin-top:6px">${disruption.description}</div>` : ''}
  `);

  marker.addTo(map);
  return marker;
}

export function addVehicleMarker(map, vehicle, cargoIcon) {
  const marker = L.marker([vehicle.lat, vehicle.lng], {
    icon: L.divIcon({
      className: '',
      html: `<div class="custom-marker marker-vehicle ${vehicle.status}">${cargoIcon}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    })
  });

  marker.bindPopup(`
    <div class="popup-title">🚛 ${vehicle.id}</div>
    <div class="popup-row"><strong>${vehicle.driverName}</strong></div>
    <div class="popup-row">Cargo: ${vehicle.cargo} (${vehicle.priority})</div>
    <div class="popup-row">Status: ${vehicle.status}</div>
    <div class="popup-row">Destination: ${vehicle.destination}</div>
    <div class="popup-row">ETA: ${vehicle.eta}</div>
  `);

  marker.addTo(map);
  return marker;
}

export function addOfficerMarker(map, officer) {
  const marker = L.marker([officer.lat, officer.lng], {
    icon: L.divIcon({
      className: '',
      html: `<div class="custom-marker marker-officer ${officer.status === 'off-duty' ? 'off-duty' : ''}">👷</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    })
  });

  marker.bindPopup(`
    <div class="popup-title">👷 ${officer.name}</div>
    <div class="popup-row">ID: ${officer.id}</div>
    <div class="popup-row">Zone: ${officer.zone}</div>
    <div class="popup-row">Status: ${officer.status}</div>
    <div class="popup-row">Assigned: ${officer.assignedIncidents.length} incident(s)</div>
  `);

  marker.addTo(map);
  return marker;
}

export function drawRoute(map, route, type = 'normal') {
  if (!route || !route.path) return null;
  const line = L.polyline(route.path, {
    color: type === 'blocked' ? '#ef4444' : type === 'alternate' ? '#f59e0b' : '#10b981',
    weight: type === 'blocked' ? 5 : 4,
    opacity: 0.8,
    dashArray: type === 'normal' ? '8 6' : type === 'alternate' ? '5 4' : null
  });
  line.addTo(map);
  return line;
}

export function drawRoutePath(map, path, type = 'normal') {
  if (!path) return null;
  const line = L.polyline(path, {
    color: type === 'blocked' ? '#ef4444' : type === 'alternate' ? '#f59e0b' : '#10b981',
    weight: type === 'blocked' ? 5 : 4,
    opacity: 0.8,
    dashArray: type === 'normal' ? '8 6' : type === 'alternate' ? '5 4' : null
  });
  line.addTo(map);
  return line;
}

export function fitToMarkers(map, markers) {
  if (markers.length === 0) return;
  const group = L.featureGroup(markers);
  map.fitBounds(group.getBounds().pad(0.15));
}

export function addLegend(map, items) {
  const legend = L.control({ position: 'bottomleft' });
  legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'map-legend');
    div.innerHTML = items.map(item =>
      `<div class="legend-item"><span class="legend-dot ${item.color}"></span>${item.label}</div>`
    ).join('');
    return div;
  };
  legend.addTo(map);
  return legend;
}

export function getRandomWeather() {
  return WEATHER_CONDITIONS[Math.floor(Math.random() * WEATHER_CONDITIONS.length)];
}

export function addWeatherOverlay(map) {
  const weather = getRandomWeather();
  const control = L.control({ position: 'topleft' });
  control.onAdd = function () {
    const div = L.DomUtil.create('div', 'weather-overlay');
    div.innerHTML = `
      <span class="weather-icon">${weather.icon}</span>
      <div>
        <div class="weather-temp">${weather.temp}</div>
        <div class="weather-desc">${weather.desc}</div>
      </div>
    `;
    return div;
  };
  control.addTo(map);
  return control;
}

export function animateVehicleAlongRoute(map, marker, routePath, duration = 10000) {
  if (!routePath || routePath.length < 2) return;
  let segIndex = 0;
  let progress = 0;
  const segDuration = duration / (routePath.length - 1);

  function step() {
    if (segIndex >= routePath.length - 1) {
      segIndex = 0;
      progress = 0;
    }
    const start = routePath[segIndex];
    const end = routePath[segIndex + 1];
    const lat = start[0] + (end[0] - start[0]) * progress;
    const lng = start[1] + (end[1] - start[1]) * progress;
    marker.setLatLng([lat, lng]);
    progress += 0.05;
    if (progress >= 1) {
      progress = 0;
      segIndex++;
    }
  }

  return setInterval(step, segDuration * 0.05);
}
