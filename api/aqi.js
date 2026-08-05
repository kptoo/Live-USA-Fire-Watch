import fetch from 'node-fetch';

const AIRNOW_KEY = process.env.AIRNOW_KEY || '7F466AA7-3BF5-4547-9A9C-294F9C325952';
const URL = `https://www.airnowapi.org/aq/observation/latLong/current/` +
  `?format=application/json&latitude=44.0&longitude=-120.5&distance=350&API_KEY=${AIRNOW_KEY}`;

let cache = null, cacheTs = 0;
const TTL = 30 * 60 * 1000;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (cache && Date.now() - cacheTs < TTL) return res.json(cache);
  try {
    const r = await fetch(URL, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const stations = {};
    for (const obs of data) {
      const key = `${obs.Latitude},${obs.Longitude}`;
      if (!stations[key]) {
        stations[key] = { type:'Feature',
          geometry:{ type:'Point', coordinates:[obs.Longitude, obs.Latitude] },
          properties:{ city:obs.ReportingArea, state:obs.StateCode,
            date:obs.DateObserved, hour:obs.HourObserved, pollutants:{} }
        };
      }
      stations[key].properties.pollutants[obs.ParameterName] = { aqi:obs.AQI, category:obs.Category.Name };
      const cur = stations[key].properties.aqi || 0;
      if (obs.AQI > cur) {
        stations[key].properties.aqi = obs.AQI;
        stations[key].properties.category = obs.Category.Name;
      }
    }
    cache = { type:'FeatureCollection', features: Object.values(stations) };
    cacheTs = Date.now();
    res.json(cache);
  } catch(e) {
    res.json({ type:'FeatureCollection', features:[] });
  }
}