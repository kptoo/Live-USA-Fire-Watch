// Realistic mock data for Oregon fires — used when external APIs are unreachable
export const mockHotspots = {
  type: 'FeatureCollection',
  features: [
    // Grasshopper Fire area (Maupin/Wasco County)
    ...Array.from({length: 45}, (_, i) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-121.05 + (Math.random()-0.5)*0.3, 45.18 + (Math.random()-0.5)*0.2] },
      properties: { frp: Math.random()*180 + 5, confidence: ['n','h','l'][Math.floor(Math.random()*3)], acq_date: '2026-08-04', acq_time: '0824' }
    })),
    // South Willamette Valley fire cluster
    ...Array.from({length: 28}, (_, i) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-123.2 + (Math.random()-0.5)*0.4, 43.8 + (Math.random()-0.5)*0.3] },
      properties: { frp: Math.random()*90 + 3, confidence: 'n', acq_date: '2026-08-04', acq_time: '1012' }
    })),
    // Eastern Oregon cluster
    ...Array.from({length: 60}, (_, i) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-118.5 + (Math.random()-0.5)*1.5, 43.5 + (Math.random()-0.5)*1.5] },
      properties: { frp: Math.random()*220 + 2, confidence: ['n','h'][Math.floor(Math.random()*2)], acq_date: '2026-08-04', acq_time: '0930' }
    })),
    // Rogue Valley / Medford area
    ...Array.from({length: 22}, (_, i) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-122.8 + (Math.random()-0.5)*0.5, 42.4 + (Math.random()-0.5)*0.4] },
      properties: { frp: Math.random()*60 + 8, confidence: 'h', acq_date: '2026-08-04', acq_time: '0748' }
    }))
  ]
};

export const mockPerimeters = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-121.12, 45.25], [-120.95, 45.28], [-120.88, 45.18], [-120.95, 45.08],
          [-121.08, 45.05], [-121.18, 45.12], [-121.12, 45.25]
        ]]
      },
      properties: { IncidentName: 'GRASSHOPPER FIRE', GISAcres: 87420, PercentContained: 12, ModifiedOnDateTime_dt: '2026-08-04T18:00:00Z' }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-118.8, 44.2], [-118.5, 44.3], [-118.3, 44.1], [-118.5, 43.9],
          [-118.9, 43.95], [-118.8, 44.2]
        ]]
      },
      properties: { IncidentName: 'BUCHANAN COMPLEX', GISAcres: 214300, PercentContained: 5, ModifiedOnDateTime_dt: '2026-08-04T12:00:00Z' }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-117.9, 43.1], [-117.6, 43.2], [-117.4, 43.0], [-117.6, 42.8],
          [-117.95, 42.85], [-117.9, 43.1]
        ]]
      },
      properties: { IncidentName: 'OWYHEE FIRE', GISAcres: 156800, PercentContained: 31, ModifiedOnDateTime_dt: '2026-08-03T20:00:00Z' }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-122.85, 42.55], [-122.65, 42.6], [-122.55, 42.45], [-122.65, 42.3],
          [-122.88, 42.35], [-122.85, 42.55]
        ]]
      },
      properties: { IncidentName: 'ROGUE RIVER FIRE', GISAcres: 43200, PercentContained: 58, ModifiedOnDateTime_dt: '2026-08-04T08:00:00Z' }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-123.3, 43.9], [-123.1, 43.95], [-123.0, 43.8], [-123.1, 43.65],
          [-123.35, 43.7], [-123.3, 43.9]
        ]]
      },
      properties: { IncidentName: 'CALAPOOIA FIRE', GISAcres: 28900, PercentContained: 0, ModifiedOnDateTime_dt: '2026-08-04T22:00:00Z' }
    }
  ]
};
