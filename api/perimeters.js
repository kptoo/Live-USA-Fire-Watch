import fetch from 'node-fetch';

// Correct field names confirmed from ArcGIS REST service definition:
// attr_POOState, attr_IncidentName, poly_GISAcres, attr_PercentContained, attr_ModifiedOnDateTime_dt

const FIELDS = 'attr_IncidentName,poly_GISAcres,attr_PercentContained,attr_ModifiedOnDateTime_dt,attr_POOState,attr_IncidentSize';

const URLS = [
  // Query by correct state field attr_POOState
  `https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query?where=attr_POOState%3D%27US-OR%27&outFields=${FIELDS}&f=geojson&resultRecordCount=200`,
  // Fallback: spatial bbox query covering Oregon (no state field needed)
  `https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query?where=1%3D1&geometry=-124.7%2C41.9%2C-116.4%2C46.3&geometryType=esriGeometryEnvelope&spatialRel=esriSpatialRelIntersects&outFields=${FIELDS}&f=geojson&resultRecordCount=200`,
  // YTD version with correct field
  `https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_YearToDate/FeatureServer/0/query?where=attr_POOState%3D%27US-OR%27&outFields=${FIELDS}&f=geojson&resultRecordCount=200`,
];

// Normalize all possible field name variants → consistent shape
function normalize(features) {
  return features.map(f => {
    const p = f.properties || {};
    return {
      ...f,
      properties: {
        IncidentName:        p.attr_IncidentName   || p.poly_IncidentName   || p.IncidentName   || null,
        GISAcres:            p.poly_GISAcres        || p.attr_IncidentSize   || p.GISAcres        || null,
        PercentContained:    p.attr_PercentContained ?? p.PercentContained ?? null,
        ModifiedOnDateTime_dt: p.attr_ModifiedOnDateTime_dt || p.ModifiedOnDateTime_dt || null,
        POOState:            p.attr_POOState        || p.POOState            || null,
      }
    };
  });
}

let cache = null, cacheTs = 0;
const TTL = 30 * 60 * 1000;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=1800');

  if (cache && Date.now() - cacheTs < TTL) return res.json(cache);

  for (const url of URLS) {
    try {
      console.log('[NIFC] trying:', url.slice(0, 100));
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      if (!data.features?.length) throw new Error('empty response');
      data.features = normalize(data.features);
      cache = data;
      cacheTs = Date.now();
      console.log(`[NIFC] ✓ ${data.features.length} fires, first: "${data.features[0]?.properties?.IncidentName}"`);
      return res.json(cache);
    } catch(e) {
      console.warn('[NIFC] ✗ failed:', e.message);
    }
  }

  console.warn('[NIFC] all proxy attempts failed — returning 503 for frontend direct fetch');
  res.status(503).json({ type: 'FeatureCollection', features: [], error: 'upstream_unavailable' });
}