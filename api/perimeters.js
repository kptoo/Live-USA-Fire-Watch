import fetch from 'node-fetch';

const URLS = [
  'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query?where=POOState%3D%27US-OR%27&outFields=IncidentName,GISAcres,PercentContained,ModifiedOnDateTime_dt&f=geojson&resultRecordCount=200',
  'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_YearToDate/FeatureServer/0/query?where=POOState%3D%27US-OR%27&outFields=IncidentName,GISAcres,PercentContained,ModifiedOnDateTime_dt&f=geojson&resultRecordCount=200',
];

let cache = null, cacheTs = 0;
const TTL = 30 * 60 * 1000;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=1800');
  if (cache && Date.now() - cacheTs < TTL) return res.json(cache);

  for (const url of URLS) {
    try {
      console.log('[NIFC] trying:', url.slice(0, 80));
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      if (!data.features?.length) throw new Error('empty response');
      cache = data;
      cacheTs = Date.now();
      console.log(`[NIFC] success: ${data.features.length} Oregon fires`);
      return res.json(cache);
    } catch(e) {
      console.warn('[NIFC] failed:', e.message);
    }
  }

  console.warn('[NIFC] all proxy attempts failed — frontend will fetch directly');
  res.status(503).json({ type: 'FeatureCollection', features: [], error: 'upstream_unavailable' });
}