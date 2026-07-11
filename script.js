/* ============================================
   SKYLINE — Weather Console
   Vanilla JS app powered by the OpenWeatherMap API
   ============================================ */

// --------------------------------------------
// 1. CONFIG — put your OpenWeatherMap API key here
// Get a free key at https://openweathermap.org/api
// --------------------------------------------
const API_KEY = "6569debe9a744868d96066ec7f771e46";

const GEO_URL = "https://api.openweathermap.org/geo/1.0/direct";
const CURRENT_URL = "https://api.openweathermap.org/data/2.5/weather";
const FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast";
const ONECALL_URL = "https://api.openweathermap.org/data/3.0/onecall"; // used for UV index only

// --------------------------------------------
// 2. STATE
// --------------------------------------------
let unit = "C"; // "C" or "F"
let currentData = null; // raw metric data for the active city, used to re-render on unit toggle
let debounceTimer = null;
let activeSuggestionIndex = -1;

const FAVOURITES_KEY = "skyline_favourites";
// NOTE ON localStorage: this reads/writes real browser localStorage, which
// persists normally when this file is downloaded and opened directly (or
// hosted) in any browser. Sandboxed preview panels (like an in-chat artifact
// viewer) may restrict persistent storage — if favourites don't seem to
// stick there, open index.html directly in your browser instead.

// --------------------------------------------
// 3. DOM REFS
// --------------------------------------------
const cityInput = document.getElementById("cityInput");
const suggestionsEl = document.getElementById("suggestions");
const unitToggleBtn = document.getElementById("unitToggle");
const statusMsg = document.getElementById("statusMsg");
const mainContent = document.getElementById("mainContent");
const emptyState = document.getElementById("emptyState");
const favouritesRow = document.getElementById("favouritesRow");
const favBtn = document.getElementById("favBtn");
const apiKeyNotice = document.getElementById("apiKeyNotice");

// --------------------------------------------
// 4. INIT
// --------------------------------------------
function init() {
  if (!API_KEY || API_KEY === "YOUR_OPENWEATHERMAP_API_KEY") {
    showStatus(
      "Add your OpenWeatherMap API key at the top of script.js to activate live data.",
      true
    );
  } else {
    apiKeyNotice.classList.add("hidden");
  }

  renderFavourites();

  cityInput.addEventListener("input", onCityInput);
  cityInput.addEventListener("keydown", onCityKeydown);
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrap")) hideSuggestions();
  });

  unitToggleBtn.addEventListener("click", toggleUnit);
  favBtn.addEventListener("click", toggleFavouriteCurrentCity);

  // Load the last favourite (if any) on startup for convenience
  const favs = getFavourites();
  if (favs.length > 0) {
    fetchWeatherForCoords(favs[0].lat, favs[0].lon, favs[0].name, favs[0].country);
  }
}

// --------------------------------------------
// 5. AUTOCOMPLETE (Geocoding API)
// --------------------------------------------
function onCityInput() {
  const query = cityInput.value.trim();
  clearTimeout(debounceTimer);
  activeSuggestionIndex = -1;

  if (query.length < 2) {
    hideSuggestions();
    return;
  }

  debounceTimer = setTimeout(() => fetchSuggestions(query), 300);
}

async function fetchSuggestions(query) {
  if (!hasApiKey()) return;
  try {
    const url = `${GEO_URL}?q=${encodeURIComponent(query)}&limit=6&appid=${API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Geocoding request failed");
    const results = await res.json();
    renderSuggestions(results);
  } catch (err) {
    hideSuggestions();
  }
}

function renderSuggestions(results) {
  if (!results || results.length === 0) {
    hideSuggestions();
    return;
  }
  suggestionsEl.innerHTML = "";
  results.forEach((place, idx) => {
    const li = document.createElement("li");
    const region = [place.state, place.country].filter(Boolean).join(", ");
    li.innerHTML = `<span>${place.name}</span><span class="sugg-region">${region}</span>`;
    li.addEventListener("click", () => selectSuggestion(place));
    suggestionsEl.appendChild(li);
  });
  suggestionsEl.classList.remove("hidden");
}

function onCityKeydown(e) {
  const items = Array.from(suggestionsEl.querySelectorAll("li"));
  if (suggestionsEl.classList.contains("hidden") || items.length === 0) {
    if (e.key === "Enter") {
      // fall back to a direct geocode + fetch if user hits enter with no dropdown
      const query = cityInput.value.trim();
      if (query.length > 1) geocodeAndFetch(query);
    }
    return;
  }

  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeSuggestionIndex = Math.min(activeSuggestionIndex + 1, items.length - 1);
    updateActiveSuggestion(items);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeSuggestionIndex = Math.max(activeSuggestionIndex - 1, 0);
    updateActiveSuggestion(items);
  } else if (e.key === "Enter") {
    e.preventDefault();
    items[activeSuggestionIndex >= 0 ? activeSuggestionIndex : 0].click();
  } else if (e.key === "Escape") {
    hideSuggestions();
  }
}

function updateActiveSuggestion(items) {
  items.forEach((el, i) => el.classList.toggle("active-suggestion", i === activeSuggestionIndex));
  if (activeSuggestionIndex >= 0) items[activeSuggestionIndex].scrollIntoView({ block: "nearest" });
}

function selectSuggestion(place) {
  hideSuggestions();
  cityInput.value = `${place.name}${place.country ? ", " + place.country : ""}`;
  fetchWeatherForCoords(place.lat, place.lon, place.name, place.country);
}

async function geocodeAndFetch(query) {
  if (!hasApiKey()) return;
  try {
    const url = `${GEO_URL}?q=${encodeURIComponent(query)}&limit=1&appid=${API_KEY}`;
    const res = await fetch(url);
    const results = await res.json();
    if (results.length === 0) {
      showStatus(`No city found matching "${query}".`, true);
      return;
    }
    selectSuggestion(results[0]);
  } catch (err) {
    showStatus("Something went wrong looking up that city.", true);
  }
}

function hideSuggestions() {
  suggestionsEl.classList.add("hidden");
  suggestionsEl.innerHTML = "";
}

// --------------------------------------------
// 6. WEATHER FETCHING
// --------------------------------------------
async function fetchWeatherForCoords(lat, lon, name, country) {
  if (!hasApiKey()) return;
  showStatus("Loading weather…", false, true);

  try {
    const [currentRes, forecastRes] = await Promise.all([
      fetch(`${CURRENT_URL}?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`),
      fetch(`${FORECAST_URL}?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`),
    ]);

    if (!currentRes.ok || !forecastRes.ok) {
      throw new Error("City weather lookup failed");
    }

    const current = await currentRes.json();
    const forecast = await forecastRes.json();
    const uvi = await fetchUvIndex(lat, lon); // may be null if unavailable

    currentData = {
      lat,
      lon,
      name: name || current.name,
      country: country || current.sys?.country,
      current,
      forecast,
      uvi,
    };

    clearStatus();
    renderAll();
    updateFavButtonState();
  } catch (err) {
    showStatus(
      "Couldn't load weather for that city. Check the city name or your API key/plan.",
      true
    );
  }
}

async function fetchUvIndex(lat, lon) {
  // UV index lives on OpenWeatherMap's One Call 3.0 endpoint, which requires
  // a separate (free-tier available) subscription. We fail silently to "N/A"
  // if the account doesn't have access, so the rest of the app still works.
  try {
    const url = `${ONECALL_URL}?lat=${lat}&lon=${lon}&exclude=minutely,hourly,alerts,daily&units=metric&appid=${API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.current?.uvi === "number" ? data.current.uvi : null;
  } catch (err) {
    return null;
  }
}

// --------------------------------------------
// 7. RENDERING
// --------------------------------------------
function renderAll() {
  if (!currentData) return;

  mainContent.classList.remove("hidden");
  emptyState.classList.add("hidden");

  const { current, name, country } = currentData;

  document.getElementById("cityName").textContent = `${name}${country ? ", " + country : ""}`;
  document.getElementById("dateTime").textContent = formatDateTime(current.dt, current.timezone);

  const iconCode = current.weather?.[0]?.icon || "01d";
  const iconEl = document.getElementById("weatherIcon");
  iconEl.src = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
  iconEl.alt = current.weather?.[0]?.description || "weather icon";

  document.getElementById("conditionText").textContent = current.weather?.[0]?.description || "—";
  applyWeatherTheme(current.weather?.[0]?.main);

  renderTemps();
  renderReadouts();
  renderForecast();
}

function renderTemps() {
  const { current } = currentData;
  const tempC = current.main.temp;
  const feelsC = current.main.feels_like;

  document.getElementById("currentTemp").textContent = Math.round(convertTemp(tempC));
  document.getElementById("tempUnitLabel").textContent = `°${unit}`;
  document.getElementById("feelsLike").textContent = `Feels like ${Math.round(convertTemp(feelsC))}°${unit}`;
}

function renderReadouts() {
  const { current, uvi } = currentData;

  document.getElementById("humidityValue").textContent = current.main.humidity;

  const windSpeed = unit === "C" ? current.wind.speed : current.wind.speed * 2.23694;
  document.getElementById("windValue").textContent = windSpeed.toFixed(1);
  document.getElementById("windUnit").textContent = unit === "C" ? "m/s" : "mph";

  document.getElementById("pressureValue").textContent = current.main.pressure;

  const uvEl = document.getElementById("uvValue");
  const uvTag = document.getElementById("uvTag");
  if (typeof uvi === "number") {
    uvEl.textContent = uvi.toFixed(1);
    uvTag.textContent = uvLabel(uvi);
  } else {
    uvEl.textContent = "N/A";
    uvTag.textContent = "no access";
  }
}

function uvLabel(uvi) {
  if (uvi < 3) return "low";
  if (uvi < 6) return "moderate";
  if (uvi < 8) return "high";
  if (uvi < 11) return "very high";
  return "extreme";
}

function renderForecast() {
  const { forecast } = currentData;
  const strip = document.getElementById("forecastStrip");
  strip.innerHTML = "";

  const dailyBuckets = groupForecastByDay(forecast.list);

  dailyBuckets.slice(0, 5).forEach((day) => {
    const el = document.createElement("div");
    el.className = "forecast-day";
    el.innerHTML = `
      <div class="forecast-day-name">${day.label}</div>
      <img src="https://openweathermap.org/img/wn/${day.icon}@2x.png" alt="${day.description}" />
      <div class="forecast-day-temps">${Math.round(convertTemp(day.max))}°<span class="lo">${Math.round(convertTemp(day.min))}°</span></div>
      <div class="forecast-day-cond">${day.description}</div>
    `;
    strip.appendChild(el);
  });
}

// Groups the 3-hour forecast list into daily min/max + a representative
// (closest-to-midday) icon/description for each of the next 5 days.
function groupForecastByDay(list) {
  const days = {};

  list.forEach((entry) => {
    const date = new Date(entry.dt * 1000);
    const dayKey = date.toISOString().slice(0, 10);
    const hour = date.getUTCHours();

    if (!days[dayKey]) {
      days[dayKey] = {
        date,
        min: entry.main.temp_min,
        max: entry.main.temp_max,
        entries: [],
      };
    }

    days[dayKey].min = Math.min(days[dayKey].min, entry.main.temp_min);
    days[dayKey].max = Math.max(days[dayKey].max, entry.main.temp_max);
    days[dayKey].entries.push({ hour, entry });
  });

  return Object.values(days).map((day) => {
    // pick the entry closest to midday (12:00) as the representative icon
    const rep = day.entries.reduce((best, curr) =>
      Math.abs(curr.hour - 12) < Math.abs(best.hour - 12) ? curr : best
    ).entry;

    return {
      label: day.date.toLocaleDateString(undefined, { weekday: "short" }),
      min: day.min,
      max: day.max,
      icon: rep.weather?.[0]?.icon || "01d",
      description: rep.weather?.[0]?.description || "—",
    };
  });
}

function applyWeatherTheme(main) {
  document.body.className = "";
  if (!main) return;
  document.body.classList.add(`weather-${main.toLowerCase()}`);
}

// --------------------------------------------
// 8. UNIT CONVERSION / TOGGLE
// --------------------------------------------
function convertTemp(celsius) {
  return unit === "C" ? celsius : celsius * (9 / 5) + 32;
}

function toggleUnit() {
  unit = unit === "C" ? "F" : "C";
  document.querySelectorAll(".unit-option").forEach((el) => {
    el.classList.toggle("active", el.dataset.unit === unit);
  });
  if (currentData) {
    renderTemps();
    renderReadouts();
    renderForecast();
  }
}

// --------------------------------------------
// 9. FAVOURITES (localStorage)
// --------------------------------------------
function getFavourites() {
  try {
    return JSON.parse(localStorage.getItem(FAVOURITES_KEY)) || [];
  } catch (err) {
    return [];
  }
}

function saveFavourites(favs) {
  try {
    localStorage.setItem(FAVOURITES_KEY, JSON.stringify(favs));
  } catch (err) {
    // localStorage may be unavailable in some sandboxed preview contexts —
    // fails silently there but works in a normal browser environment.
  }
}

function toggleFavouriteCurrentCity() {
  if (!currentData) return;
  const favs = getFavourites();
  const { lat, lon, name, country } = currentData;
  const existingIdx = favs.findIndex((f) => f.name === name && f.country === country);

  if (existingIdx >= 0) {
    favs.splice(existingIdx, 1);
  } else {
    favs.unshift({ lat, lon, name, country });
  }

  saveFavourites(favs.slice(0, 8));
  renderFavourites();
  updateFavButtonState();
}

function updateFavButtonState() {
  if (!currentData) return;
  const favs = getFavourites();
  const isFav = favs.some((f) => f.name === currentData.name && f.country === currentData.country);
  favBtn.textContent = isFav ? "★" : "☆";
  favBtn.classList.toggle("active", isFav);
}

function renderFavourites() {
  const favs = getFavourites();
  favouritesRow.innerHTML = "";

  favs.forEach((fav) => {
    const chip = document.createElement("div");
    chip.className = "fav-chip";
    chip.innerHTML = `<span>${fav.name}</span><span class="remove-fav" title="Remove">✕</span>`;

    chip.querySelector("span:first-child").addEventListener("click", () => {
      fetchWeatherForCoords(fav.lat, fav.lon, fav.name, fav.country);
    });

    chip.querySelector(".remove-fav").addEventListener("click", (e) => {
      e.stopPropagation();
      const updated = getFavourites().filter(
        (f) => !(f.name === fav.name && f.country === fav.country)
      );
      saveFavourites(updated);
      renderFavourites();
      updateFavButtonState();
    });

    favouritesRow.appendChild(chip);
  });
}

// --------------------------------------------
// 10. UTIL
// --------------------------------------------
function formatDateTime(dt, timezoneOffsetSeconds) {
  const localMs = (dt + (timezoneOffsetSeconds || 0)) * 1000;
  const date = new Date(localMs);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function hasApiKey() {
  if (!API_KEY || API_KEY === "YOUR_OPENWEATHERMAP_API_KEY") {
    showStatus("Add your OpenWeatherMap API key at the top of script.js first.", true);
    return false;
  }
  return true;
}

function showStatus(message, isError = false, isLoading = false) {
  statusMsg.textContent = message;
  statusMsg.classList.remove("hidden");
  statusMsg.style.color = isError ? "var(--amber)" : "var(--slate)";
  if (!isLoading) {
    emptyState.classList.add("hidden");
  }
}

function clearStatus() {
  statusMsg.classList.add("hidden");
  statusMsg.textContent = "";
}

// --------------------------------------------
// 11. GO
// --------------------------------------------
init();
