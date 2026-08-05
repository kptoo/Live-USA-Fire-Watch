import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import { mockHotspots, mockPerimeters } from './mock-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// ── API Keys ─────────────────────────────────────────────────────────────────
const FIRMS_KEY    = process.env.FIRMS_KEY    || 'e35aa43361f5c16d78b16ffa92cef668';
const AIRNOW_KEY   = process.env.AIRNOW_KEY   || '7F466AA7-3BF5-4547-9A9C-294F9C325952';

// ── Cache ────────────────────────────────────────────────────────────────────
const cache = {};
const TTL   = { firms: 60*60*1000, perimeters: 6*60*60*1000, aqi: 30*60*1000 };

function cached(key, ttl, fn) {
  if (cache[key] && Date.now() - cache[key].ts < ttl) return Promise.resolve(cache[key].data);
  return fn().then(data => { cache[key] = { ts: Date.now(), data }; return data; });
}

// ── FIRMS — VIIRS SNPP NRT, 24h, Oregon bbox ─────────────────────────────────
// Docs: https://firms.modaps.eosdis.nasa.gov/api/area/
async function fetchFIRMS() {
  return cached('firms', TTL.firms, async () => {
    // bbox: west,south,east,north
    const bbox = '-124.7,41.9,-116.4,46.3';
    const url  = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_KEY}/VIIRS_SNPP_NRT/${bbox}/1`;
    console.log('[FIRMS] fetching…');
    try {
      const res  = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const lines  = text.trim().split('\n');
      const header = lines[0].split(',');
      const col    = n => header.indexOf(n);

      const features = lines.slice(1).flatMap(line => {
        const f   = line.split(',');
        const lat = parseFloat(f[col('latitude')]);
        const lon = parseFloat(f[col('longitude')]);
        const frp = parseFloat(f[col('frp')]) || 0;
        if (isNaN(lat) || isNaN(lon)) return [];
        return [{
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lon, lat] },
          properties: {
            frp,
            confidence: f[col('confidence')] || 'n',
            acq_date:   f[col('acq_date')]   || '',
            acq_time:   f[col('acq_time')]   || '',
            bright_ti4: parseFloat(f[col('bright_ti4')]) || null,
          }
        }];
      });

      console.log(`[FIRMS] ${features.length} hotspots`);
      return { type: 'FeatureCollection', features };
    } catch (e) {
      console.warn('[FIRMS] failed, using mock:', e.message);
      return mockHotspots;
    }
  });
}

// ── NIFC fire perimeters ──────────────────────────────────────────────────────
async function fetchPerimeters() {
  return cached('perimeters', TTL.perimeters, async () => {
    const url = 'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/' +
      'WFIGS_Interagency_Perimeters_YTD/FeatureServer/0/query?' +
      'where=POOState%3D%27US-OR%27' +
      '&outFields=IncidentName,GISAcres,PercentContained,ModifiedOnDateTime_dt' +
      '&f=geojson&resultRecordCount=100';
    console.log('[NIFC] fetching perimeters…');
    try {
      const res  = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      console.log(`[NIFC] ${json.features?.length} perimeters`);
      return json;
    } catch (e) {
      console.warn('[NIFC] failed, using mock:', e.message);
      return mockPerimeters;
    }
  });
}

// ── AirNow — current AQI observations around Oregon ──────────────────────────
// Docs: https://docs.airnowapi.org/CurrentObservationsByLatLon/docs
// We query a 350-mile radius around the Oregon center point
async function fetchAQI() {
  return cached('aqi', TTL.aqi, async () => {
    const url = `https://www.airnowapi.org/aq/observation/latLong/current/` +
      `?format=application/json` +
      `&latitude=44.0&longitude=-120.5&distance=350` +
      `&API_KEY=${AIRNOW_KEY}`;
    console.log('[AirNow] fetching AQI…');
    try {
      const res  = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Convert to GeoJSON — one point per observation station
      // AirNow returns one row per pollutant per station; group by station
      const stations = {};
      for (const obs of data) {
        const key = `${obs.Latitude},${obs.Longitude}`;
        if (!stations[key]) {
          stations[key] = {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [obs.Longitude, obs.Latitude] },
            properties: {
              city:        obs.ReportingArea,
              state:       obs.StateCode,
              date:        obs.DateObserved,
              hour:        obs.HourObserved,
              pollutants:  {}
            }
          };
        }
        stations[key].properties.pollutants[obs.ParameterName] = {
          aqi:      obs.AQI,
          category: obs.Category.Name,
          number:   obs.Category.Number   // 1=Good … 6=Hazardous
        };
        // Top-level AQI = worst pollutant
        const cur = stations[key].properties.aqi || 0;
        if (obs.AQI > cur) {
          stations[key].properties.aqi      = obs.AQI;
          stations[key].properties.category = obs.Category.Name;
          stations[key].properties.catNum   = obs.Category.Number;
        }
      }

      const features = Object.values(stations);
      console.log(`[AirNow] ${features.length} stations`);
      return { type: 'FeatureCollection', features };
    } catch (e) {
      console.warn('[AirNow] failed:', e.message);
      return { type: 'FeatureCollection', features: [] };
    }
  });
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/api/hotspots',   async (req, res) => { try { res.json(await fetchFIRMS());      } catch(e){ res.status(500).json({error:e.message}); } });
app.get('/api/perimeters', async (req, res) => { try { res.json(await fetchPerimeters()); } catch(e){ res.status(500).json({error:e.message}); } });
app.get('/api/aqi',        async (req, res) => { try { res.json(await fetchAQI());        } catch(e){ res.status(500).json({error:e.message}); } });

app.get('/api/status', async (req, res) => {
  const [h, p, a] = await Promise.allSettled([fetchFIRMS(), fetchPerimeters(), fetchAQI()]);
  res.json({
    hotspots:   h.value?.features?.length  ?? 0,
    perimeters: p.value?.features?.length  ?? 0,
    aqi_stations: a.value?.features?.length ?? 0,
    firms_updated:      cache.firms?.ts      ? new Date(cache.firms.ts).toISOString()      : null,
    perimeters_updated: cache.perimeters?.ts ? new Date(cache.perimeters.ts).toISOString() : null,
    aqi_updated:        cache.aqi?.ts        ? new Date(cache.aqi.ts).toISOString()        : null,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🔥 Wildfire tracker → http://localhost:${PORT}`));
