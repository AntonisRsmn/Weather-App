// Basic UI wire-up
const cityInput = document.getElementById('city');
const statusEl = document.getElementById('status');
const weatherSection = document.getElementById('weather');
const currentEl = document.getElementById('current');
const forecastEl = document.getElementById('forecast');

cityInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') getWeather();
});

// Open-Meteo free APIs (no key required)
const GEO_API = 'https://geocoding-api.open-meteo.com/v1/search';
// Weather + forecast
const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';
// Air quality (optional)
const AIR_API = 'https://air-quality-api.open-meteo.com/v1/air-quality';

function setStatus(msg, busy = false) {
    statusEl.textContent = msg || '';
    weatherSection.setAttribute('aria-busy', String(busy));
}

function showWeather() {
    weatherSection.classList.add('show');
}

function hideWeather() {
    weatherSection.classList.remove('show');
}

function dayNameFromISODate(isoDate, locale = navigator.language || 'en-US') {
    try {
        return new Date(isoDate).toLocaleDateString(locale, { weekday: 'short' });
    } catch {
        return isoDate;
    }
}

function dateShortFromISO(isoDate, locale = navigator.language || 'en-US') {
    try {
        return new Date(isoDate).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    } catch {
        return isoDate;
    }
}

function toCompass(deg) {
    if (deg == null || isNaN(deg)) return '—';
    const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    const i = Math.round(((deg % 360) / 22.5)) % 16;
    return dirs[i];
}

function fmt(n, unit = '', digits = 0) {
    if (n == null || isNaN(n)) return '—';
    const v = typeof digits === 'number' ? Number(n).toFixed(digits) : n;
    return `${v}${unit}`;
}

// Simplified mapping of WMO weather codes to emoji + text
const WMO_MAP = {
    0: ['☀️', 'Clear'],
    1: ['🌤️', 'Mainly clear'],
    2: ['⛅', 'Partly cloudy'],
    3: ['☁️', 'Overcast'],
    45: ['🌫️', 'Fog'],
    48: ['🌫️', 'Depositing rime fog'],
    51: ['🌦️', 'Light drizzle'],
    53: ['🌦️', 'Moderate drizzle'],
    55: ['🌧️', 'Dense drizzle'],
    56: ['🌧️', 'Light freezing drizzle'],
    57: ['🌧️', 'Dense freezing drizzle'],
    61: ['🌦️', 'Slight rain'],
    63: ['🌧️', 'Moderate rain'],
    65: ['🌧️', 'Heavy rain'],
    66: ['🌧️', 'Light freezing rain'],
    67: ['🌧️', 'Heavy freezing rain'],
    71: ['🌨️', 'Slight snow'],
    73: ['🌨️', 'Moderate snow'],
    75: ['❄️', 'Heavy snow'],
    77: ['🌨️', 'Snow grains'],
    80: ['🌦️', 'Rain showers'],
    81: ['🌧️', 'Heavy rain showers'],
    82: ['⛈️', 'Violent rain showers'],
    85: ['🌨️', 'Snow showers'],
    86: ['❄️', 'Heavy snow showers'],
    95: ['⛈️', 'Thunderstorm'],
    96: ['⛈️', 'Thunderstorm with hail'],
    99: ['⛈️', 'Thunderstorm with heavy hail']
};

function codeToIconText(code) {
    const [icon, text] = WMO_MAP[code] || ['❓', 'Unknown'];
    return { icon, text };
}

function isNight(localISO) {
    if (!localISO) return false;
    const hour = new Date(localISO).getHours();
    return hour < 6 || hour >= 20;
}

function themeFromWMO(code, night = false) {
    // Group codes per WMO convention
    if (night) {
        if (code === 0) return 'clear-night';
        if (code === 1 || code === 2) return 'partly-night';
    }
    if (code === 0) return 'sunny';
    if (code === 1 || code === 2) return 'partly';
    if (code === 3) return 'cloudy';
    if ([45,48].includes(code)) return 'fog';
    if ([61,63,65,66,67,80,81,82].includes(code)) return 'rain';
    if ([71,73,75,77,85,86].includes(code)) return 'snow';
    if ([95,96,99].includes(code)) return 'thunder';
    return 'partly';
}

async function geocodeCity(name) {
    const url = `${GEO_API}?name=${encodeURIComponent(name)}&count=1&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Geocoding failed');
    const data = await res.json();
    if (!data.results || data.results.length === 0) throw new Error('City not found');
    const r = data.results[0];
    return { lat: r.latitude, lon: r.longitude, label: `${r.name}${r.admin1 ? ', ' + r.admin1 : ''}, ${r.country_code}` };
}

async function fetchWeather(lat, lon, tz = Intl.DateTimeFormat().resolvedOptions().timeZone) {
    const params = new URLSearchParams({
        latitude: lat,
        longitude: lon,
        current: [
            'temperature_2m',
            'apparent_temperature',
            'relative_humidity_2m',
            'wind_speed_10m',
            'wind_gusts_10m',
            'wind_direction_10m',
            'pressure_msl',
            'cloud_cover',
            'visibility',
            'precipitation',
            'rain',
            'showers',
            'snowfall',
            'uv_index',
            'weather_code'
        ].join(','),
        daily: [
            'weather_code',
            'temperature_2m_max',
            'temperature_2m_min',
            'precipitation_probability_max',
            'precipitation_sum',
            'uv_index_max',
            'sunrise',
            'sunset',
            'wind_speed_10m_max',
            'wind_gusts_10m_max'
        ].join(','),
        timezone: tz
    });
    const url = `${WEATHER_API}?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather fetch failed');
    return res.json();
}

async function fetchAirQuality(lat, lon) {
    const params = new URLSearchParams({
        latitude: lat,
        longitude: lon,
        current: ['us_aqi', 'pm2_5', 'pm10', 'ozone', 'nitrogen_dioxide', 'sulphur_dioxide', 'carbon_monoxide'].join(',')
    });
    const url = `${AIR_API}?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('AQ fetch failed');
    return res.json();
}

function aqiCategory(aqi) {
    if (aqi == null || isNaN(aqi)) return { cat: '—', cls: 'aqi-unknown' };
    const v = Number(aqi);
    if (v <= 50) return { cat: 'Good', cls: 'aqi-good' };
    if (v <= 100) return { cat: 'Moderate', cls: 'aqi-mod' };
    if (v <= 150) return { cat: 'Unhealthy (SG)', cls: 'aqi-usg' };
    if (v <= 200) return { cat: 'Unhealthy', cls: 'aqi-unh' };
    if (v <= 300) return { cat: 'Very Unhealthy', cls: 'aqi-vunh' };
    return { cat: 'Hazardous', cls: 'aqi-haz' };
}

function renderWeather(label, wx, air) {
    const c = wx.current;
    const d = wx.daily;
    const { icon, text } = codeToIconText(c.weather_code);
    // Decide theme using current time from API if present
    const currentTime = wx.current && wx.current.time ? wx.current.time : null;
    const night = isNight(currentTime);
    const theme = themeFromWMO(c.weather_code, night);
    document.body.classList.remove(
        'theme-sunny','theme-partly','theme-cloudy','theme-rain','theme-snow','theme-thunder','theme-fog','theme-clear-night','theme-partly-night'
    );
    document.body.classList.add(`theme-${theme}`);

    // Optional AQI
    let aqiHtml = '';
    if (air && air.current) {
        const aqi = air.current.us_aqi;
        const pm25 = air.current.pm2_5;
        const info = aqiCategory(aqi);
        aqiHtml = `
            <div class="aqi-pill ${info.cls}" title="PM2.5: ${fmt(pm25, ' µg/m³')}">AQI ${Math.round(aqi)} • ${info.cat}</div>
        `;
    }

    currentEl.innerHTML = `
        <div class="location">${label}</div>
        <div class="temp">${Math.round(c.temperature_2m)}°C <span class="desc">${icon} ${text}</span></div>
        <div class="meta">
            <span>💧 ${fmt(c.relative_humidity_2m, '%')}</span>
            <span>💨 ${fmt(c.wind_speed_10m, ' km/h')}</span>
            ${aqiHtml}
        </div>
        <div class="details-grid">
            <div class="detail-item"><span class="label">Feels like</span><span class="value">${fmt(c.apparent_temperature, '°C')}</span></div>
            <div class="detail-item"><span class="label">Pressure</span><span class="value">${fmt(c.pressure_msl, ' hPa')}</span></div>
            <div class="detail-item"><span class="label">Cloud cover</span><span class="value">${fmt(c.cloud_cover, '%')}</span></div>
            <div class="detail-item"><span class="label">Visibility</span><span class="value">${c.visibility != null ? (c.visibility/1000).toFixed(1) + ' km' : '—'}</span></div>
            <div class="detail-item"><span class="label">Wind gust</span><span class="value">${fmt(c.wind_gusts_10m, ' km/h')}</span></div>
            <div class="detail-item"><span class="label">Wind dir</span><span class="value">${toCompass(c.wind_direction_10m)} (${fmt(c.wind_direction_10m, '°')})</span></div>
            <div class="detail-item"><span class="label">Precip</span><span class="value">${fmt(c.precipitation, ' mm')}</span></div>
            <div class="detail-item"><span class="label">UV index</span><span class="value">${fmt(c.uv_index, '')}</span></div>
        </div>
        <div class="sun-times">
            <span>🌅 ${d.sunrise && d.sunrise[0] ? new Date(d.sunrise[0]).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '—'}</span>
            <span>🌇 ${d.sunset && d.sunset[0] ? new Date(d.sunset[0]).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '—'}</span>
        </div>
    `;

    const cards = d.time.map((date, i) => {
        const { icon, text } = codeToIconText(d.weather_code[i]);
        const max = Math.round(d.temperature_2m_max[i]);
        const min = Math.round(d.temperature_2m_min[i]);
        const pop = d.precipitation_probability_max ? d.precipitation_probability_max[i] : null;
        const dateLabel = dateShortFromISO(date);
        return `
            <div class="day-card" title="${text}">
                <div class="name">${dayNameFromISODate(date)}</div>
                <div class="date">${dateLabel}</div>
                <div class="icon">${icon}</div>
                <div class="range">${max}° <span>/ ${min}°</span></div>
                ${pop != null ? `<div class="pop">💧 ${pop}%</div>` : ''}
            </div>
        `;
    }).join('');
    forecastEl.innerHTML = cards;

    showWeather();
}

async function getWeather() {
    const q = cityInput.value.trim();
    if (!q) { setStatus('Please enter a city name.'); return; }
    setStatus('Searching…', true);
    hideWeather();
    try {
        const loc = await geocodeCity(q);
        const [wx, air] = await Promise.all([
            fetchWeather(loc.lat, loc.lon),
            fetchAirQuality(loc.lat, loc.lon).catch(() => null)
        ]);
        renderWeather(loc.label, wx, air);
        setStatus('');
    } catch (err) {
        console.error(err);
        setStatus(err.message || 'Failed to load weather');
    } finally {
        weatherSection.setAttribute('aria-busy', 'false');
    }
}

function getPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
            (err) => reject(new Error(err.message || 'Location unavailable')),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    });
}

async function useMyLocation() {
    setStatus('Getting your location…', true);
    hideWeather();
    try {
        const { lat, lon } = await getPosition();
        const [wx, air] = await Promise.all([
            fetchWeather(lat, lon),
            fetchAirQuality(lat, lon).catch(() => null)
        ]);
        // Reverse geocode to label (optional best-effort)
        let label = 'Your location';
        try {
            const rev = await fetch(`${GEO_API}?latitude=${lat}&longitude=${lon}&count=1&language=en`);
            if (rev.ok) {
                const data = await rev.json();
                if (data.results && data.results[0]) {
                    const r = data.results[0];
                    label = `${r.name}${r.admin1 ? ', ' + r.admin1 : ''}, ${r.country_code}`;
                }
            }
        } catch {}
        renderWeather(label, wx, air);
        setStatus('');
    } catch (err) {
        console.error(err);
        setStatus(err.message || 'Could not get your location');
    } finally {
        weatherSection.setAttribute('aria-busy', 'false');
    }
}

// Expose to global scope for inline onclick handlers
window.getWeather = getWeather;
window.useMyLocation = useMyLocation;