# 🔥 USA Fire Tracker

Live web map tracking active fire hotspots and perimeters across USA.

**Data sources:**
- **NASA FIRMS** — VIIRS SNPP satellite hotspots, updated every ~3–12h
- **NIFC** — Interagency fire perimeters (named fires, acreage, % contained)

---

## Quick Start

```bash
npm install
node server.js
# → open http://localhost:3000
```

Without a FIRMS API key the server uses realistic mock data automatically —
good for UI development.

---

## Get Live Data (Free)

### 1. NASA FIRMS key
1. Register at https://firms.modaps.eosdis.nasa.gov/api/
2. Copy your MAP_KEY
3. Set the env variable:
   ```bash
   FIRMS_MAP_KEY=your_key_here node server.js
   ```

### 2. NIFC perimeters
No key needed — the NIFC ArcGIS REST endpoint is public.
The server queries Oregon fires automatically.

---

## API Endpoints

| Route | Description |
|-------|-------------|
| `GET /api/hotspots` | FIRMS hotspots as GeoJSON (Oregon bbox) |
| `GET /api/perimeters` | NIFC fire perimeters as GeoJSON |
| `GET /api/status` | Cache status + feature counts |

Responses are cached (hotspots: 1h, perimeters: 6h) to avoid hammering APIs.
The frontend auto-refreshes every hour.

---

## Add More Layers

### AQI / Smoke (AirNow)
```
https://www.airnowapi.org/aq/observation/latLong/current/
  ?format=application/json&latitude=44.0&longitude=-120.5
  &distance=300&API_KEY=YOUR_KEY
```
Free key at https://docs.airnowapi.org/account/request/

### Red Flag Warnings (NOAA WMS)
Add as a raster layer in MapLibre:
```
https://mapservices.weather.noaa.gov/eventdriven/services/
  fire_weather/SPC_firewxareas/MapServer/WMSServer
```

### Wind layer
Use OpenWeatherMap tile layer or Windy.com embed for fire spread context.

---

## Deployment

Works on any Node host. For Heroku / Render / Railway:
```bash
# Set env var FIRMS_MAP_KEY in your dashboard
# Set PORT if needed (defaults to 3000)
node server.js
```

For a static-only deploy (no backend), point the frontend directly at:
- NIFC GeoJSON: `https://services3.arcgis.com/T4QMspbfLg3qTGWY/...` (has CORS)
- FIRMS: requires a backend proxy (CORS blocked on direct browser fetch)
