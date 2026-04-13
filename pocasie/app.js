// Open-Meteo API — bez registrácie, bez API kľúča
const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';

const WMO_CODES = {
  0:  { label: 'Jasno', icon: '☀️' },
  1:  { label: 'Prevažne jasno', icon: '🌤️' },
  2:  { label: 'Čiastočne zamračené', icon: '⛅' },
  3:  { label: 'Zamračené', icon: '☁️' },
  45: { label: 'Hmla', icon: '🌫️' },
  48: { label: 'Mrazivá hmla', icon: '🌫️' },
  51: { label: 'Slabá mrholka', icon: '🌦️' },
  53: { label: 'Mierna mrholka', icon: '🌦️' },
  55: { label: 'Silná mrholka', icon: '🌧️' },
  61: { label: 'Slabý dážď', icon: '🌧️' },
  63: { label: 'Mierna dažďa', icon: '🌧️' },
  65: { label: 'Silný dážď', icon: '🌧️' },
  71: { label: 'Slabé sneženie', icon: '🌨️' },
  73: { label: 'Mierne sneženie', icon: '❄️' },
  75: { label: 'Silné sneženie', icon: '❄️' },
  77: { label: 'Snehové zrná', icon: '🌨️' },
  80: { label: 'Slabé prehánky', icon: '🌦️' },
  81: { label: 'Mierne prehánky', icon: '🌧️' },
  82: { label: 'Silné prehánky', icon: '⛈️' },
  85: { label: 'Snehové prehánky', icon: '🌨️' },
  86: { label: 'Silné snehové prehánky', icon: '❄️' },
  95: { label: 'Búrka', icon: '⛈️' },
  96: { label: 'Búrka s krúpami', icon: '⛈️' },
  99: { label: 'Silná búrka s krúpami', icon: '⛈️' },
};

function wmo(code) {
  return WMO_CODES[code] || { label: 'Neznáme', icon: '🌡️' };
}

const $ = id => document.getElementById(id);

function showError(msg) {
  const el = $('error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideError() {
  $('error').classList.add('hidden');
}

function showLoading(show) {
  $('loading').classList.toggle('hidden', !show);
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('sk-SK', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatDay(iso) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Dnes';
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return 'Zajtra';
  return d.toLocaleDateString('sk-SK', { weekday: 'short' });
}

// --- Autocomplete ---

let autocompleteResults = [];
let activeIndex = -1;

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

function hideSuggestions() {
  $('suggestions').classList.add('hidden');
  $('suggestions').innerHTML = '';
  activeIndex = -1;
}

function renderSuggestions(results) {
  const ul = $('suggestions');
  ul.innerHTML = '';
  activeIndex = -1;

  if (!results.length) { ul.classList.add('hidden'); return; }

  results.forEach((r, i) => {
    const li = document.createElement('li');
    const parts = [r.name, r.admin1, r.country].filter(Boolean);
    li.textContent = parts.join(', ');
    li.addEventListener('mousedown', e => {
      e.preventDefault();
      selectSuggestion(i);
    });
    ul.appendChild(li);
  });

  ul.classList.remove('hidden');
}

function selectSuggestion(i) {
  const r = autocompleteResults[i];
  if (!r) return;
  const parts = [r.name, r.admin1, r.country].filter(Boolean);
  $('cityInput').value = parts.join(', ');
  hideSuggestions();
  loadWeatherForCoords(r.latitude, r.longitude, r.name + (r.country ? `, ${r.country}` : ''));
}

const fetchSuggestions = debounce(async (query) => {
  if (query.length < 2) { hideSuggestions(); return; }
  try {
    const res = await fetch(`${GEO_URL}?name=${encodeURIComponent(query)}&count=6&language=sk`);
    const data = await res.json();
    autocompleteResults = data.results || [];
    renderSuggestions(autocompleteResults);
  } catch {
    hideSuggestions();
  }
}, 300);

// --- Weather API ---

async function geocode(city) {
  const res = await fetch(`${GEO_URL}?name=${encodeURIComponent(city)}&count=1&language=sk`);
  const data = await res.json();
  if (!data.results?.length) throw new Error(`Mesto "${city}" sa nenašlo.`);
  return data.results[0];
}

async function fetchWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,precipitation,weather_code',
    hourly: 'temperature_2m,apparent_temperature,weather_code,precipitation_probability,wind_speed_10m,relative_humidity_2m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum',
    timezone: 'auto',
    forecast_days: 7,
  });
  const res = await fetch(`${WEATHER_URL}?${params}`);
  return res.json();
}

// --- State ---
let cachedData = null;
let cachedCityName = '';
let selectedDayIndex = 0;
let selectedHourIndex = null;

// --- Render ---

function renderCurrent(data, cityName) {
  const c = data.current;
  const w = wmo(c.weather_code);

  $('cityName').textContent = cityName;
  $('currentDate').textContent = formatDate(c.time);
  $('currentIcon').textContent = w.icon;
  $('currentTemp').textContent = `${Math.round(c.temperature_2m)}°C`;
  $('currentTempMin').classList.add('hidden');
  $('currentDesc').textContent = w.label;
  $('feelsLike').textContent = `${Math.round(c.apparent_temperature)}°C`;
  $('humidity').textContent = `${c.relative_humidity_2m} %`;
  $('wind').textContent = `${Math.round(c.wind_speed_10m)} km/h`;
  $('precipitation').textContent = `${c.precipitation} mm`;

  $('current').classList.remove('hidden');
}

function renderDaySummary(data, dayIndex) {
  const d = data.daily;
  const h = data.hourly;
  const w = wmo(d.weather_code[dayIndex]);
  const dayStr = d.time[dayIndex];

  // Priemerné hodinové hodnoty pre daný deň
  const indices = h.time.reduce((acc, t, i) => {
    if (t.startsWith(dayStr)) acc.push(i);
    return acc;
  }, []);

  const avg = key => {
    const vals = indices.map(i => h[key][i]).filter(v => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  $('cityName').textContent = cachedCityName;
  $('currentDate').textContent = formatDate(dayStr + 'T12:00');
  $('currentIcon').textContent = w.icon;
  $('currentTemp').textContent = `${Math.round(d.temperature_2m_max[dayIndex])}°C`;
  $('currentTempMin').textContent = `min ${Math.round(d.temperature_2m_min[dayIndex])}°C`;
  $('currentTempMin').classList.remove('hidden');
  $('currentDesc').textContent = w.label;

  const feels = avg('apparent_temperature');
  $('feelsLike').textContent = feels != null ? `${Math.round(feels)}°C` : '—';

  const humidity = avg('relative_humidity_2m');
  $('humidity').textContent = humidity != null ? `${Math.round(humidity)} %` : '—';

  const wind = avg('wind_speed_10m');
  $('wind').textContent = wind != null ? `${Math.round(wind)} km/h` : '—';

  $('precipitation').textContent = `${d.precipitation_sum[dayIndex]} mm`;

  $('current').classList.remove('hidden');
}

function renderHourly(data, dayIndex) {
  const { time, temperature_2m, apparent_temperature, weather_code,
          precipitation_probability, wind_speed_10m, relative_humidity_2m } = data.hourly;

  const dayStr = data.daily.time[dayIndex];
  const isToday = dayIndex === 0;
  const nowHour = new Date().getHours();

  $('hourlyTitle').textContent = isToday
    ? 'Dnes po hodinách'
    : formatDay(dayStr) + ' — po hodinách';

  const container = $('hourlyCards');
  container.innerHTML = '';
  $('hourDetail').classList.add('hidden');
  selectedHourIndex = null;

  let scrollTarget = null;

  time.forEach((t, i) => {
    if (!t.startsWith(dayStr)) return;
    const hour = new Date(t).getHours();
    const w = wmo(weather_code[i]);
    const isNow = isToday && hour === nowHour;

    const card = document.createElement('div');
    card.className = 'hour-card' + (isNow ? ' now' : '');
    card.dataset.index = i;
    card.innerHTML = `
      <div class="hc-time">${isNow ? 'Teraz' : String(hour).padStart(2, '0') + ':00'}</div>
      <div class="hc-icon">${w.icon}</div>
      <div class="hc-temp">${Math.round(temperature_2m[i])}°</div>
      <div class="hc-rain">💧 ${precipitation_probability[i]} %</div>
    `;

    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.index);
      // Odznačíme všetky
      container.querySelectorAll('.hour-card').forEach(c => c.classList.remove('selected'));

      if (selectedHourIndex === idx) {
        // Klik na rovnakú — skryje detail
        selectedHourIndex = null;
        $('hourDetail').classList.add('hidden');
      } else {
        selectedHourIndex = idx;
        card.classList.add('selected');
        showHourDetail({
          time: t,
          temp: temperature_2m[idx],
          feels: apparent_temperature[idx],
          wind: wind_speed_10m[idx],
          humidity: relative_humidity_2m[idx],
          rain: precipitation_probability[idx],
          wmo: w,
        });
      }
    });

    container.appendChild(card);
    if (isNow) scrollTarget = card;
  });

  $('hourly').classList.remove('hidden');

  if (scrollTarget) {
    requestAnimationFrame(() => {
      scrollTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    });
  }
}

function showHourDetail({ time, temp, feels, wind, humidity, rain, wmo: w }) {
  const detail = $('hourDetail');
  const hour = new Date(time).getHours();
  detail.innerHTML = `
    <div class="hd-row"><span class="hd-label">Čas</span><span class="hd-value">${String(hour).padStart(2,'0')}:00 ${w.icon}</span></div>
    <div class="hd-row"><span class="hd-label">Teplota</span><span class="hd-value">${Math.round(temp)}°C</span></div>
    <div class="hd-row"><span class="hd-label">Pocitová</span><span class="hd-value">${Math.round(feels)}°C</span></div>
    <div class="hd-row"><span class="hd-label">Vietor</span><span class="hd-value">${Math.round(wind)} km/h</span></div>
    <div class="hd-row"><span class="hd-label">Vlhkosť</span><span class="hd-value">${humidity} %</span></div>
    <div class="hd-row"><span class="hd-label">Zrážky</span><span class="hd-value">${rain} %</span></div>
  `;
  detail.classList.remove('hidden');
}

function renderForecast(data) {
  const { time, weather_code, temperature_2m_max, temperature_2m_min, precipitation_sum } = data.daily;
  const container = $('forecastCards');
  container.innerHTML = '';

  time.forEach((date, i) => {
    const w = wmo(weather_code[i]);
    const card = document.createElement('div');
    card.className = 'forecast-card' + (i === selectedDayIndex ? ' selected' : '');
    card.innerHTML = `
      <div class="day">${formatDay(date)}</div>
      <div class="fc-icon">${w.icon}</div>
      <div class="fc-max">${Math.round(temperature_2m_max[i])}°</div>
      <div class="fc-min">${Math.round(temperature_2m_min[i])}°</div>
      <div class="fc-rain">💧 ${precipitation_sum[i]} mm</div>
    `;

    card.addEventListener('click', () => {
      selectedDayIndex = i;
      container.querySelectorAll('.forecast-card').forEach((c, j) => {
        c.classList.toggle('selected', j === i);
      });
      if (i === 0) {
        renderCurrent(cachedData, cachedCityName);
      } else {
        renderDaySummary(cachedData, i);
      }
      renderHourly(cachedData, i);
      $('current').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    container.appendChild(card);
  });

  $('forecast').classList.remove('hidden');
}

// --- Load weather ---

async function loadWeatherForCoords(lat, lon, displayName) {
  hideError();
  showLoading(true);
  $('current').classList.add('hidden');
  $('hourly').classList.add('hidden');
  $('forecast').classList.add('hidden');

  try {
    if (!displayName) {
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
      const geoData = await geoRes.json();
      const city = geoData.address?.city || geoData.address?.town || geoData.address?.village || 'Moja poloha';
      const country = geoData.address?.country || '';
      displayName = [city, country].filter(Boolean).join(', ');
    }

    const data = await fetchWeather(lat, lon);
    cachedData = data; cachedCityName = displayName; selectedDayIndex = 0; selectedHourIndex = null;
    renderCurrent(data, displayName);
    renderHourly(data, 0);
    renderForecast(data);
  } catch (e) {
    showError(e.message || 'Nastala chyba pri načítavaní počasia.');
  } finally {
    showLoading(false);
  }
}

async function loadWeatherForCity(city) {
  hideError();
  showLoading(true);
  $('current').classList.add('hidden');
  $('hourly').classList.add('hidden');
  $('forecast').classList.add('hidden');

  try {
    const loc = await geocode(city);
    const displayName = [loc.name, loc.country].filter(Boolean).join(', ');
    const data = await fetchWeather(loc.latitude, loc.longitude);
    cachedData = data; cachedCityName = displayName; selectedDayIndex = 0; selectedHourIndex = null;
    renderCurrent(data, displayName);
    renderHourly(data, 0);
    renderForecast(data);
  } catch (e) {
    showError(e.message || 'Nastala chyba pri načítavaní počasia.');
  } finally {
    showLoading(false);
  }
}

// --- Event listeners ---

const cityInput = $('cityInput');

cityInput.addEventListener('input', () => {
  fetchSuggestions(cityInput.value.trim());
});

cityInput.addEventListener('keydown', e => {
  const ul = $('suggestions');
  const items = ul.querySelectorAll('li');

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    activeIndex = Math.min(activeIndex + 1, items.length - 1);
    items.forEach((li, i) => li.classList.toggle('active', i === activeIndex));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    activeIndex = Math.max(activeIndex - 1, -1);
    items.forEach((li, i) => li.classList.toggle('active', i === activeIndex));
  } else if (e.key === 'Enter') {
    if (activeIndex >= 0) {
      selectSuggestion(activeIndex);
    } else {
      hideSuggestions();
      const city = cityInput.value.trim();
      if (city) loadWeatherForCity(city);
    }
  } else if (e.key === 'Escape') {
    hideSuggestions();
  }
});

cityInput.addEventListener('blur', () => {
  setTimeout(hideSuggestions, 150);
});

$('searchBtn').addEventListener('click', () => {
  hideSuggestions();
  const city = cityInput.value.trim();
  if (city) loadWeatherForCity(city);
});

$('geoBtn').addEventListener('click', () => {
  if (!navigator.geolocation) {
    showError('Geolokácia nie je podporovaná v tomto prehliadači.');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => loadWeatherForCoords(pos.coords.latitude, pos.coords.longitude),
    () => showError('Nepodarilo sa získať polohu. Skontroluj povolenia prehliadača.'),
  );
});

// Predvolené mesto
loadWeatherForCity('Bratislava');
