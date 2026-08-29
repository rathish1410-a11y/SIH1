const WEATHER_CONDITIONS = [
  { icon: '🌧', desc: 'Heavy Rain', temp: '22°C', alert: 'Flood risk elevated in low-lying areas' },
  { icon: '⛅', desc: 'Partly Cloudy', temp: '28°C', alert: null },
  { icon: '⛈', desc: 'Thunderstorm', temp: '24°C', alert: 'Landslide risk in hilly terrain' },
  { icon: '🌫', desc: 'Foggy', temp: '18°C', alert: 'Reduced visibility — drive with caution' },
  { icon: '☀', desc: 'Clear', temp: '31°C', alert: null }
];

export function getCurrentWeather() {
  return WEATHER_CONDITIONS[Math.floor(Math.random() * WEATHER_CONDITIONS.length)];
}

export function getWeatherForRegion(lat, lng) {
  return WEATHER_CONDITIONS[Math.floor((lat + lng) % WEATHER_CONDITIONS.length)];
}

export function getWeatherAlert(weather) {
  return weather.alert;
}

export function getAllWeatherConditions() {
  return WEATHER_CONDITIONS;
}
