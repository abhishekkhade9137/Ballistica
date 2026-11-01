import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import styles from './Map.module.css';
import { haversineDistance, calculateBearing } from '../utils/calculator';

// Fix Leaflet's default icon paths broken by bundlers
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Custom Tactical SVG Markers
const createTacticalBatteryIcon = () => {
  return L.divIcon({
    className: 'tactical-battery-marker',
    html: `
      <div style="
        width: 34px; height: 34px;
        background: rgba(0, 240, 255, 0.25);
        border: 2px solid #00f0ff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 16px rgba(0, 240, 255, 0.9);
        cursor: grab;
      ">
        <div style="width: 10px; height: 10px; background: #00f0ff; border-radius: 50%;"></div>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
};

const createTacticalTargetIcon = () => {
  return L.divIcon({
    className: 'tactical-target-marker',
    html: `
      <div style="
        width: 32px; height: 32px;
        background: rgba(239, 68, 68, 0.25);
        border: 2px dashed #ef4444;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 16px rgba(239, 68, 68, 0.9);
        cursor: grab;
      ">
        <div style="width: 8px; height: 8px; background: #ef4444; border-radius: 50%;"></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
};

function Map({
  trajectoryData,
  availableSolutions,
  activeSolutionType = 'directFire',
  onSelectSolution,
  onSetStartingPoint,
  onSetTargetPoint,
  onClearMarkings,
  startingPoint,
  targetPoint,
  placementMode,
  setPlacementMode
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef([]);
  const rangeRingsRef = useRef([]);
  const startMarkerRef = useRef(null);
  const targetMarkerRef = useRef(null);
  const lineOfSightRef = useRef(null);
  const tileLayerRef = useRef(null);
  const userInteractedRef = useRef(false);
  const boundsPointsRef = useRef([]);
  const lastCoordsKeyRef = useRef('');

  const [activeLayer, setActiveLayer] = useState('dark');
  const [cursorCoords, setCursorCoords] = useState(null);

  // Local placement mode if not controlled externally
  const [internalMode, setInternalMode] = useState('battery');
  const activeMode = placementMode || internalMode;
  const updateMode = setPlacementMode || setInternalMode;

  const tileServers = {
    dark: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      attrib: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
      className: '',
      maxZoom: 16
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attrib: 'Tiles &copy; Esri &mdash; Source: Esri, USGS, GIS User Community',
      className: '',
      maxZoom: 18
    },
    osm: {
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attrib: '&copy; OpenStreetMap contributors',
      className: '',
      maxZoom: 19
    }
  };

  const onSetStartingPointRef = useRef(onSetStartingPoint);
  const onSetTargetPointRef = useRef(onSetTargetPoint);
  const onSelectSolutionRef = useRef(onSelectSolution);
  useEffect(() => { onSetStartingPointRef.current = onSetStartingPoint; }, [onSetStartingPoint]);
  useEffect(() => { onSetTargetPointRef.current = onSetTargetPoint; }, [onSetTargetPoint]);
  useEffect(() => { onSelectSolutionRef.current = onSelectSolution; }, [onSelectSolution]);

  // Initialise Leaflet Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialCenter = startingPoint?.lat ? [startingPoint.lat, startingPoint.lng] : [34.4280, 75.7600];
    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom: 11,
      attributionControl: false,
      zoomControl: true,
    });

    const tileCfg = tileServers.dark;
    tileLayerRef.current = L.tileLayer(tileCfg.url, {
      maxZoom: tileCfg.maxZoom,
      attribution: tileCfg.attrib,
      className: tileCfg.className,
    }).addTo(map);

    map.on('mousemove', (e) => {
      setCursorCoords({ lat: e.latlng.lat.toFixed(4), lng: e.latlng.lng.toFixed(4) });
    });

    // Mark when user actively zooms or pans the map so auto-fit bounds doesn't override them
    map.on('zoomstart', () => {
      userInteractedRef.current = true;
    });
    map.on('dragstart', () => {
      userInteractedRef.current = true;
    });

    // Single intuitive click handler based on active mode
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      const currentToolMode = mapRef.current?._currentPlacementMode || 'battery';

      if (currentToolMode === 'battery') {
        if (onSetStartingPointRef.current) {
          onSetStartingPointRef.current({ lat, lng });
        }
        // Automatically switch mode to target for the next click
        updateMode('target');
      } else {
        if (onSetTargetPointRef.current) {
          onSetTargetPointRef.current({ lat, lng });
        }
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    mapRef.current = map;

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep mapRef._currentPlacementMode in sync with activeMode
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current._currentPlacementMode = activeMode;
    }
  }, [activeMode]);

  const handleLayerSwitch = (layerKey) => {
    setActiveLayer(layerKey);
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const tileCfg = tileServers[layerKey];
    tileLayerRef.current = L.tileLayer(tileCfg.url, {
      maxZoom: tileCfg.maxZoom,
      attribution: tileCfg.attrib,
      className: tileCfg.className,
    }).addTo(map);
  };

  const updateRangeRings = (lat, lng) => {
    const map = mapRef.current;
    if (!map) return;

    rangeRingsRef.current.forEach(layer => map.removeLayer(layer));
    rangeRingsRef.current = [];

    const rings = [
      { radius: 5000, label: '5 KM' },
      { radius: 10000, label: '10 KM' },
      { radius: 20000, label: '20 KM' }
    ];

    rings.forEach(({ radius }) => {
      const circle = L.circle([lat, lng], {
        radius,
        color: '#00f0ff',
        weight: 1,
        dashArray: '4, 8',
        opacity: 0.35,
        fill: false,
      }).addTo(map);
      rangeRingsRef.current.push(circle);
    });
  };

  // Trajectory Layer updates (renders both Direct and High-Arc options when available)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    layersRef.current.forEach(layer => map.removeLayer(layer));
    layersRef.current = [];

    // If gun or target is not placed, wipe all trajectory polylines and exit
    if (!startingPoint || !targetPoint || !startingPoint.lat || !targetPoint.lat) {
      boundsPointsRef.current = [];
      return;
    }

    const boundsPoints = [];

    // Helper to render a trajectory polyline on the tactical map
    const renderTraj = (result, color, isActive, label, solType) => {
      if (!result?.trajectory || result.trajectory.length === 0) return;
      const step = Math.max(1, Math.floor(result.trajectory.length / 2000));
      const latlngs = result.trajectory
        .filter((_, i) => i % step === 0 || i === result.trajectory.length - 1)
        .map(p => [p.lat, p.lng]);

      latlngs.forEach(pt => boundsPoints.push(pt));

      if (isActive) {
        const glowLine = L.polyline(latlngs, {
          color,
          weight: 7,
          opacity: 0.35,
        }).addTo(map);
        layersRef.current.push(glowLine);

        const activeLine = L.polyline(latlngs, {
          color: '#ffffff',
          weight: 3,
          opacity: 0.95,
          dashArray: '6, 4',
        }).addTo(map);
        activeLine.bindTooltip(label, { sticky: true, className: 'tactical-tooltip' });
        layersRef.current.push(activeLine);
      } else {
        const inactiveLine = L.polyline(latlngs, {
          color,
          weight: 2,
          opacity: 0.45,
          dashArray: '4, 8',
        }).addTo(map);
        inactiveLine.bindTooltip(`${label} (Click to select)`, { sticky: true, className: 'tactical-tooltip' });
        inactiveLine.on('click', () => {
          if (onSelectSolutionRef.current) onSelectSolutionRef.current(solType);
        });
        layersRef.current.push(inactiveLine);
      }
    };

    if (availableSolutions) {
      if (availableSolutions.directFire) {
        renderTraj(
          availableSolutions.directFire.result,
          '#00f0ff',
          activeSolutionType === 'directFire',
          `Option 1: Direct Fire (${availableSolutions.directFire.config.elevationAngle.toFixed(1)}° QE)`,
          'directFire'
        );
      }
      if (availableSolutions.highArc) {
        renderTraj(
          availableSolutions.highArc.result,
          '#10b981',
          activeSolutionType === 'highArc',
          `Option 2: High-Arc Plunging (${availableSolutions.highArc.config.elevationAngle.toFixed(1)}° QE)`,
          'highArc'
        );
      }

      // If no viable solution exists, render tactical unreachable marker
      if (!availableSolutions.directFire && !availableSolutions.highArc && startingPoint && targetPoint) {
        const unreachableLine = L.polyline(
          [[startingPoint.lat, startingPoint.lng], [targetPoint.lat, targetPoint.lng]],
          {
            color: '#ef4444',
            weight: 2.5,
            dashArray: '6, 6',
            opacity: 0.85,
          }
        ).addTo(map);
        unreachableLine.bindTooltip(
          `UNREACHABLE: No viable trajectory (${(availableSolutions.targetRange / 1000).toFixed(2)} km)`,
          { sticky: true, className: 'tactical-tooltip' }
        );
        layersRef.current.push(unreachableLine);
        boundsPoints.push([startingPoint.lat, startingPoint.lng]);
        boundsPoints.push([targetPoint.lat, targetPoint.lng]);
      }
    } else if (trajectoryData) {
      renderTraj(trajectoryData, '#00f0ff', true, 'Ballistic Trajectory', 'directFire');
    }

    boundsPointsRef.current = boundsPoints;

    // Only auto-fit bounds on initial shot load or when battery/target coordinates change.
    // NEVER when the user is actively zooming or exploring the map!
    const currentCoordsKey = `${startingPoint?.lat?.toFixed(4)},${startingPoint?.lng?.toFixed(4)}_${targetPoint?.lat?.toFixed(4)},${targetPoint?.lng?.toFixed(4)}`;
    const coordsChanged = lastCoordsKeyRef.current !== currentCoordsKey;
    if (coordsChanged) {
      lastCoordsKeyRef.current = currentCoordsKey;
      userInteractedRef.current = false;
    }

    if (boundsPoints.length > 0 && !userInteractedRef.current) {
      const bounds = L.latLngBounds(boundsPoints);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [trajectoryData, availableSolutions, activeSolutionType, startingPoint, targetPoint]);

  const handleRecenter = () => {
    userInteractedRef.current = false;
    const map = mapRef.current;
    if (!map) return;
    if (boundsPointsRef.current && boundsPointsRef.current.length > 0) {
      map.fitBounds(L.latLngBounds(boundsPointsRef.current), { padding: [50, 50] });
    } else if (startingPoint?.lat && targetPoint?.lat) {
      map.fitBounds([[startingPoint.lat, startingPoint.lng], [targetPoint.lat, targetPoint.lng]], { padding: [50, 50] });
    }
  };

  // Battery Launch Position Marker (Draggable)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (startMarkerRef.current) {
      map.removeLayer(startMarkerRef.current);
      startMarkerRef.current = null;
    }

    if (startingPoint && startingPoint.lat != null && startingPoint.lng != null && (startingPoint.lat !== 0 || startingPoint.lng !== 0)) {
      const marker = L.marker([startingPoint.lat, startingPoint.lng], {
        icon: createTacticalBatteryIcon(),
        draggable: true,
      })
        .addTo(map)
        .bindPopup(`<div style="font-family: var(--font-hud);">
          <strong style="color: #00f0ff;">GUN / BATTERY POSITION</strong><br>
          Lat: ${startingPoint.lat.toFixed(4)}°N<br>
          Lng: ${startingPoint.lng.toFixed(4)}°E<br>
          <small style="color: #94a3b8;">(Drag to reposition)</small>
        </div>`);

      marker.on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng();
        if (onSetStartingPointRef.current) {
          onSetStartingPointRef.current({ lat, lng });
        }
      });

      startMarkerRef.current = marker;
      updateRangeRings(startingPoint.lat, startingPoint.lng);
    } else {
      rangeRingsRef.current.forEach(layer => map.removeLayer(layer));
      rangeRingsRef.current = [];
    }
  }, [startingPoint]);

  // Target Marker (Draggable)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (targetMarkerRef.current) {
      map.removeLayer(targetMarkerRef.current);
      targetMarkerRef.current = null;
    }

    if (targetPoint && targetPoint.lat != null && targetPoint.lng != null && (targetPoint.lat !== 0 || targetPoint.lng !== 0)) {
      const marker = L.marker([targetPoint.lat, targetPoint.lng], {
        icon: createTacticalTargetIcon(),
        draggable: true,
      })
        .addTo(map)
        .bindPopup(`<div style="font-family: var(--font-hud);">
          <strong style="color: #ef4444;">TARGET OBJECTIVE</strong><br>
          Lat: ${targetPoint.lat.toFixed(4)}°N<br>
          Lng: ${targetPoint.lng.toFixed(4)}°E<br>
          <small style="color: #94a3b8;">(Drag to reposition)</small>
        </div>`);

      marker.on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng();
        if (onSetTargetPointRef.current) {
          onSetTargetPointRef.current({ lat, lng });
        }
      });

      targetMarkerRef.current = marker;
    }
  }, [targetPoint]);

  // Direct Line-of-Fire / Bearing Line between Gun and Target
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (lineOfSightRef.current) {
      map.removeLayer(lineOfSightRef.current);
      lineOfSightRef.current = null;
    }

    if (startingPoint && targetPoint && startingPoint.lat && targetPoint.lat) {
      const distanceM = haversineDistance(startingPoint, targetPoint);
      const bearingDeg = calculateBearing(startingPoint.lat, startingPoint.lng, targetPoint.lat, targetPoint.lng);

      const line = L.polyline(
        [[startingPoint.lat, startingPoint.lng], [targetPoint.lat, targetPoint.lng]],
        {
          color: 'rgba(245, 158, 11, 0.65)',
          weight: 1.5,
          dashArray: '5, 8',
        }
      ).addTo(map);

      line.bindTooltip(
        `Range: ${(distanceM / 1000).toFixed(2)} km | Bearing: ${bearingDeg.toFixed(1)}°`,
        { permanent: false, sticky: true, className: 'tactical-tooltip' }
      );

      lineOfSightRef.current = line;
    }

    return () => {
      if (lineOfSightRef.current && map) {
        map.removeLayer(lineOfSightRef.current);
        lineOfSightRef.current = null;
      }
    };
  }, [startingPoint, targetPoint]);

  // Completely wipe markers, lines of fire, trajectories, and range rings from map
  const handleClear = () => {
    const map = mapRef.current;
    if (map) {
      if (lineOfSightRef.current) {
        map.removeLayer(lineOfSightRef.current);
        lineOfSightRef.current = null;
      }
      if (startMarkerRef.current) {
        map.removeLayer(startMarkerRef.current);
        startMarkerRef.current = null;
      }
      if (targetMarkerRef.current) {
        map.removeLayer(targetMarkerRef.current);
        targetMarkerRef.current = null;
      }
      rangeRingsRef.current.forEach((ring) => map.removeLayer(ring));
      rangeRingsRef.current = [];
      layersRef.current.forEach((layer) => map.removeLayer(layer));
      layersRef.current = [];
      boundsPointsRef.current = [];
      lastCoordsKeyRef.current = '';
    }
    if (onClearMarkings) {
      onClearMarkings();
    }
  };

  return (
    <div className={styles.mapWrapper}>
      {/* Unified Top Map Controls Ribbon (Left: Set Gun/Target, Right: Base Layers) */}
      <div className={styles.topControlsBar}>
        <div className={styles.placementButtons}>
          <button
            type="button"
            onClick={() => updateMode('battery')}
            className={`${styles.placementBtn} ${activeMode === 'battery' ? styles.activeBattery : ''}`}
          >
            1. Set Gun
          </button>
          <button
            type="button"
            onClick={() => updateMode('target')}
            className={`${styles.placementBtn} ${activeMode === 'target' ? styles.activeTarget : ''}`}
          >
            2. Set Target
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={!startingPoint?.lat && !targetPoint?.lat}
            className={`${styles.placementBtn} ${styles.clearBtn}`}
            title="Clear both Gun and Target markings and all connecting lines from map"
          >
            Clear Markings
          </button>
        </div>

        <div className={styles.layerControl}>
          <button
            type="button"
            onClick={() => handleLayerSwitch('dark')}
            className={`${styles.layerBtn} ${activeLayer === 'dark' ? styles.active : ''}`}
          >
            Tactical Dark
          </button>
          <button
            type="button"
            onClick={() => handleLayerSwitch('satellite')}
            className={`${styles.layerBtn} ${activeLayer === 'satellite' ? styles.active : ''}`}
          >
            Satellite
          </button>
          <button
            type="button"
            onClick={() => handleLayerSwitch('osm')}
            className={`${styles.layerBtn} ${activeLayer === 'osm' ? styles.active : ''}`}
          >
            Topographic
          </button>
          <button
            type="button"
            onClick={handleRecenter}
            className={styles.layerBtn}
            style={{ color: '#00e5ff', borderColor: 'rgba(0, 229, 255, 0.4)' }}
            title="Recenter view on battery, target, and trajectory"
          >
            Recenter View
          </button>
        </div>
      </div>

      {/* Real-time Cursor Coordinates Bar */}
      <div className={styles.coordsBar}>
        <span className={styles.gridBadge}>GRID: WGS-84</span>
        {cursorCoords ? (
          <span>{cursorCoords.lat}° N, {cursorCoords.lng}° E</span>
        ) : (
          <span className={styles.coordsHint}>Click map to place or drag markers</span>
        )}
      </div>

      <div id="leaflet-map" ref={containerRef} className={styles.leafletContainer} />
    </div>
  );
}

export default Map;
