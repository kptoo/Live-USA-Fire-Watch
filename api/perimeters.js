import fetch from 'node-fetch';

const URL = 'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/' +
  'WFIGS_Interagency_Perimeters_YTD/FeatureServer/0/query?' +
  'where=POOState%3D%27US-OR%27&outFields=IncidentName,GISAcres,PercentContained,ModifiedOnDateTime_dt' +
  '&f=geojson&resultRecordCount=100';

let cache = null, cacheTs = 0;
const TTL = 6 * 60 * 60 * 1000;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (cache && Date.now() - cacheTs < TTL) return res.json(cache);
  try {
    const r = await fetch(URL, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    cache = await r.json();
    cacheTs = Date.now();
    res.json(cache);
  } catch(e) {
    res.json({ type:'FeatureCollection', features:[] });
  }
}