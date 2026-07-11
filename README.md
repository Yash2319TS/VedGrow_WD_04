# Skyline — Weather Console

A vanilla HTML/CSS/JS weather app powered by the OpenWeatherMap API.

## Setup

1. Get a free API key at https://openweathermap.org/api (sign up, then
   **API keys** tab). New keys can take up to a couple of hours to activate.
2. Open `script.js` and replace:
   ```js
   const API_KEY = "YOUR_OPENWEATHERMAP_API_KEY";
   ```
   with your real key.
3. Open `index.html` directly in a browser (double-click it), or serve the
   folder with any static server (e.g. `python3 -m http.server` from inside
   the folder, then visit `http://localhost:8000`).

That's it — no build step, no dependencies.

## What's using which endpoint

| Feature | Endpoint |
|---|---|
| City autocomplete | Geocoding API — `/geo/1.0/direct` |
| Current weather | `/data/2.5/weather` |
| 5-day forecast | `/data/2.5/forecast` (3-hour steps, grouped into days client-side) |
| UV index | One Call API 3.0 — `/data/3.0/onecall` |

**About the UV index:** it lives on One Call 3.0, which needs a separate
(free, 1,000 calls/day) subscription enrollment on your OpenWeatherMap
account, even though the base key is the same. If your account isn't
enrolled, the app just shows "N/A" for UV rather than breaking — everything
else keeps working.

## Favourites & localStorage

Favourite cities are saved with `localStorage`, so they persist between
visits in a normal browser tab. If you're viewing this inside a sandboxed
preview panel (rather than a real browser tab or a locally-hosted page),
`localStorage` may be blocked by that sandbox and favourites won't stick —
downloading the files and opening `index.html` yourself avoids that.

## Notes

- Unit toggle (°C/°F) converts client-side from the metric data already
  fetched, so switching units doesn't re-hit the API.
- The forecast card background subtly re-tints based on the current
  condition (clear / clouds / rain / snow / thunderstorm).
