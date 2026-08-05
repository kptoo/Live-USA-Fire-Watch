import fetch from 'node-fetch';
import { mockHotspots } from './mock-data.js';

const FIRMS_KEY = process.env.FIRMS_KEY || 'e35aa43361f5c16d78b16ffa92cef668';
const BBOX = '-124.7,41.9,-116.4,46.3';
const URL = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_KEY}/VIIRS_SNPP_NRT/${BBOX}/1`;

let cache = null, cacheTs = 0;
const TTL = 60 * 60 * 1000;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (cache && Date.now() - cacheTs < TTL) return res.json(cache);
  try {
    const r = await fetch(URL, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const text = await r.text();
    const lines = text.trim().split('\n');
    const header = lines[0].split(',');
    const col = n => header.indexOf(n);
    const features = lines.slice(1).flatMap(line => {
      const f = line.split(',');
      const lat = parseFloat(f[col('latitude')]);
      const lon = parseFloat(f[col('longitude')]);
      const frp = parseFloat(f[col('frp')]) || 0;
      if (isNaN(lat) || isNaN(lon)) return [];
      return [{ type:'Feature', geometry:{ type:'Point', coordinates:[lon,lat] },
        properties:{ frp, confidence:f[col('confidence')]||'n',
          acq_date:f[col('acq_date')]||'', acq_time:f[col('acq_time')]||'' } }];
    });
    if (!features.length) throw new Error('empty');
    cache = { type:'FeatureCollection', features };
    cacheTs = Date.now();
    res.json(cache);
  } catch(e) {
    console.warn('FIRMS failed, using mock:', e.message);
    res.json(mockHotspots);
  }
}