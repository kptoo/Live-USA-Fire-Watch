import fetch from 'node-fetch';
import { mockPerimeters } from './mock-data.js';

const URLS = [
  // 1. Current active perimeters REST API
  'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query?where=POOState%3D%27US-OR%27&outFields=*&f=geojson&resultRecordCount=200',
  // 2. YTD REST API
  'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_YTD/FeatureServer/0/query?where=POOState%3D%27US-OR%27&outFields=*&f=geojson&resultRecordCount=200',
  // 3. Full open data GeoJSON (different field names — normalized below)
  'https://opendata.arcgis.com/datasets/7c81ab78d8464e5c9771e49b64e834e9_0.geojson',
];

let cache = null, cacheTs = 0;
const TTL = 30 * 60 * 1000;

// Normalize any field name schema to a consistent shape
function normalizeFeature(f) {
  const p = f.properties || {};

  // Try every known field name variant for each value
  const name = p.IncidentName
    || p.attr_IncidentName
    || p.poly_IncidentName
    || p.INCIDENT_NAME
    || p.incidentname
    || null;

  const acres = p.GISAcres
    || p.attr_GISAcres
    || p.poly_GISAcres
    || p.GISACRES
    || p.gisacres
    || null;

  const pct = p.PercentContained
    ?? p.attr_PercentContained
    ?? p.poly_PercentContained
    ?? p.PERCENTCONTAINED
    ?? null;

  const modified = p.ModifiedOnDateTime_dt
    || p.attr_ModifiedOnDateTime_dt
    || p.poly_ModifiedOnDateTime_dt
    || p.MODIFIEDON
    || null;

  const state = p.POOState
    || p.attr_POOState
    || p.poly_POOState
    || p.STATE
    || null;

  return {
    ...f,
    properties: {
      IncidentName: name,
      GISAcres: acres ? parseFloat(acres) : null,
      PercentContained: pct !== null ? parseFloat(pct) : null,
      ModifiedOnDateTime_dt: modified,
      POOState: state,
    }
  };
}

async function tryFetch(url) {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FireWatchBot/1.0)' }
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();

  // Normalize all features to consistent field names
  let features = (data.features || []).map(normalizeFeature);

  // Filter to Oregon if it's the full USA dataset
  features = features.filter(f => {
    const s = f.properties.POOState || '';
    if (!s) return true; // no state field — keep it (REST query already filtered)
    return s === 'US-OR' || s === 'Oregon' || s === 'OR';
  });

  if (!features.length) throw new Error('empty after filter');
  return { type: 'FeatureCollection', features };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=1800');

  if (cache && Date.now() - cacheTs < TTL) return res.json(cache);

  for (const url of URLS) {
    try {
      console.log(`[NIFC] trying ${url.slice(0, 70)}...`);
      const data = await tryFetch(url);
      cache = data;
      cacheTs = Date.now();
      console.log(`[NIFC] ✓ ${data.features.length} Oregon fires, first: ${data.features[0]?.properties?.IncidentName}`);
      return res.json(cache);
    } catch(e) {
      console.warn(`[NIFC] ✗ ${e.message}`);
    }
  }

  console.warn('[NIFC] all sources failed — mock');
  res.json(mockPerimeters);
}