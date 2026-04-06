import React, { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import styles from './Map.module.css';

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

function Map({ trajectoryData, onSetStartingPoint, startingPoint }) {
  const containerRef  = useRef(null); // the DOM <div>
  const mapRef        = useRef(null); // Leaflet map instance
  const layersRef     = useRef([]);   // trajectory / impact layers
  const startMarkerRef = useRef(null);

  // Stable ref so the click handler never needs to be re-bound
  const onSetStartingPointRef = useRef(onSetStartingPoint);
  useEffect(() => { onSetStartingPointRef.current = onSetStartingPoint; }, [onSetStartingPoint]);

  // ── Initialise map once ──────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return; // already initialised

    const map = L.map(containerRef.current, {
      center: [35.1, -79.0],
      zoom: 8,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      if (onSetStartingPointRef.current) {
        onSetStartingPointRef.current(lat, lng);
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); // empty deps – run once

  // ── Draw trajectory when data changes ────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !trajectoryData) return;

    // Remove previous trajectory layers
    layersRef.current.forEach(layer => map.removeLayer(layer));
    layersRef.current = [];

    const { trajectory, impactPoint } = trajectoryData;
    if (!trajectory || trajectory.length === 0) return;

    // Starting point marker
    const startMarker = L.marker([trajectory[0].lat, trajectory[0].lng])
      .addTo(map)
      .bindPopup('<b>Launch Point</b>');
    layersRef.current.push(startMarker);

    // Impact point marker
    const impactMarker = L.marker([impactPoint.lat, impactPoint.lng])
      .addTo(map)
      .bindPopup('<b>Impact Point</b>');
    layersRef.current.push(impactMarker);

    // Impact area circle
    const impactCircle = L.circle([impactPoint.lat, impactPoint.lng], {
      color: '#ff4444',
      fillColor: '#ff4444',
      fillOpacity: 0.25,
      radius: 50,
    }).addTo(map);
    layersRef.current.push(impactCircle);

    // Trajectory polyline (downsample if needed for performance)
    const step = Math.max(1, Math.floor(trajectory.length / 2000));
    const latlngs = trajectory
      .filter((_, i) => i % step === 0 || i === trajectory.length - 1)
      .map(p => [p.lat, p.lng]);

    const polyline = L.polyline(latlngs, {
      color: '#667eea',
      weight: 3,
      opacity: 0.9,
    }).addTo(map);
    layersRef.current.push(polyline);

    // Fit map to show the full trajectory
    const bounds = L.latLngBounds(latlngs);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [trajectoryData]);

  // ── Update "starting point" preview marker ─────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (startMarkerRef.current) {
      map.removeLayer(startMarkerRef.current);
      startMarkerRef.current = null;
    }

    if (startingPoint && (startingPoint.lat !== 0 || startingPoint.lng !== 0)) {
      const marker = L.marker([startingPoint.lat, startingPoint.lng])
        .addTo(map)
        .bindPopup('<b>Selected Start</b><br>Click Calculate to fire from here.');
      startMarkerRef.current = marker;
    }
  }, [startingPoint]);

  return (
    <div
      id="leaflet-map"
      ref={containerRef}
      className={styles.leafletContainer}
    />
  );
}

export default Map;
