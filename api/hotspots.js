import fetch from 'node-fetch';
import { mockHotspots } from './mock-data.js';

const FIRMS_KEY = process.env.FIRMS_KEY || 'e35aa43361f5c16d78b16ffa92cef668';
const BBOX = '-124.7,41.9,-116.4,46.3';

const URLS = [
  // 1. Bbox API with key (best — Oregon only)
  `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_KEY}/VIIRS_SNPP_NRT/${BBOX}/1`,
  // 2. Public CSV download (no key, full USA — we filter)
  'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_USA_contiguous_and_Hawaii_24h.csv',
];

let cache = null, cacheTs = 0;
const TTL = 60 * 60 * 1000;

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const header = lines[0].split(',');
  const col = n => header.indexOf(n);
  return lines.slice(1).flatMap(line => {
    const f = line.split(',');
    const lat = parseFloat(f[col('latitude')]);
    const lon = parseFloat(f[col('longitude')]);
    const frp = parseFloat(f[col('frp')]) || 0;
    if (isNaN(lat) || isNaN(lon)) return [];
    // Oregon bbox filter
    if (lat < 41.9 || lat > 46.3 || lon < -124.7 || lon > -116.4) return [];
    return [{ type:'Feature', geometry:{ type:'Point', coordinates:[lon,lat] },
      properties:{ frp, confidence:f[col('confidence')]||'n',
        acq_date:f[col('acq_date')]||'', acq_time:f[col('acq_time')]||'' }}];
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600');

  if (cache && Date.now() - cacheTs < TTL) return res.json(cache);

  for (const url of URLS) {
    try {
      console.log(`[FIRMS] trying ${url.slice(0, 60)}...`);
      const r = await fetch(url, {
        signal: AbortSignal.timeout(20000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FireWatchBot/1.0)' }
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const text = await r.text();
      const features = parseCSV(text);
      if (!features.length) throw new Error('empty');
      cache = { type:'FeatureCollection', features };
      cacheTs = Date.now();
      console.log(`[FIRMS] ✓ ${features.length} hotspots`);
      return res.json(cache);
    } catch(e) {
      console.warn(`[FIRMS] ✗ ${e.message}`);
    }
  }

  console.warn('[FIRMS] all sources failed, using mock');
  res.json(mockHotspots);
}