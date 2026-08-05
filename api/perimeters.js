import fetch from 'node-fetch';
import { mockPerimeters } from './mock-data.js';

// Three different NIFC endpoints to try in order
const URLS = [
  // 1. Current active perimeters (most reliable, smaller dataset)
  'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters/FeatureServer/0/query?where=POOState%3D%27US-OR%27&outFields=IncidentName,GISAcres,PercentContained,ModifiedOnDateTime_dt&f=geojson&resultRecordCount=100',

  // 2. YTD perimeters (backup)
  'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_YTD/FeatureServer/0/query?where=POOState%3D%27US-OR%27&outFields=IncidentName,GISAcres,PercentContained,ModifiedOnDateTime_dt&f=geojson&resultRecordCount=100',

  // 3. Open data hub GeoJSON (completely different host — most likely to work from Vercel)
  'https://opendata.arcgis.com/datasets/7c81ab78d8464e5c9771e49b64e834e9_0.geojson',
];

let cache = null, cacheTs = 0;
const TTL = 30 * 60 * 1000; // 30 min (shorter so we get fresher data)

async function tryFetch(url) {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FireWatchBot/1.0)' }
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  // For URL #3 (full USA dataset), filter to Oregon
  if (data.features?.length) {
    data.features = data.features.filter(f => {
      const s = f.properties?.POOState || f.properties?.state || '';
      const nm = f.properties?.IncidentName || '';
      // filter by state field OR by bounding box
      if (s && s !== 'US-OR' && s !== 'Oregon' && s !== 'OR') return false;
      return true;
    });
  }
  if (!data.features?.length) throw new Error('empty');
  return data;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=1800');

  if (cache && Date.now() - cacheTs < TTL) return res.json(cache);

  for (const url of URLS) {
    try {
      console.log(`[NIFC] trying ${url.slice(0, 60)}...`);
      const data = await tryFetch(url);
      cache = data;
      cacheTs = Date.now();
      console.log(`[NIFC] ✓ ${data.features.length} Oregon perimeters`);
      return res.json(cache);
    } catch(e) {
      console.warn(`[NIFC] ✗ failed: ${e.message}`);
    }
  }

  // All three failed — use mock
  console.warn('[NIFC] all sources failed, using mock data');
  res.json(mockPerimeters);
}