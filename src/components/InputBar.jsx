import React, { useState, useEffect, useCallback } from 'react';
import styles from './InputBar.module.css';
import { fetchElevation, fetchTerrainPath, haversineDistance, calculateBearing } from '../utils/calculator';
import { logger } from '../utils/logger';

function InputBar({
  onCalculate,
  onFindSolutions,
  onClearMarkings,
  activeScenario,
  startingPoint,
  targetPoint,
  availableSolutions,
  activeSolutionType = 'directFire',
  onSelectSolution,
}) {
  const [selectedGun, setSelectedGun] = useState('shortRangeInterceptor');

  // Environmental & Weather State (3D Wind & ISA Atmosphere)
  const [windSpeed, setWindSpeed] = useState(4); // m/s
  const [windDirection, setWindDirection] = useState(270); // degrees (coming from West)
  const [groundTempC, setGroundTempC] = useState(15); // °C
  const [groundPressureHpa, setGroundPressureHpa] = useState(1013); // hPa

  // Ground Altitudes & Path Terrain (Auto-fetched in background)
  const [startAlt, setStartAlt] = useState(3089);
  const [targetAlt, setTargetAlt] = useState(3742);
  const [pathTerrain, setPathTerrain] = useState(null);
  const [fetchingStartAlt, setFetchingStartAlt] = useState(false);
  const [fetchingTargetAlt, setFetchingTargetAlt] = useState(false);

  // Weapon System Specifications (Generic catalog with Calibre & Rifling Twist)
  const gunCatalog = {
    shortRangeInterceptor: {
      name: 'Short-Range Interceptor',
      role: 'Point Defence',
      velocity: 1100,
      mass: 0.4,
      dragCoeff: 0.00008,
      calibre: 0.035, // 35mm
      barrelTwist: 0.70, // 1:20 rifling twist
      maxRange: 5500, // 5.5 km
    },
    mediumAutocannon: {
      name: 'Medium Autocannon',
      role: 'Air Defence',
      velocity: 1000,
      mass: 0.96,
      dragCoeff: 0.00015,
      calibre: 0.040, // 40mm
      barrelTwist: 1.00,
      maxRange: 4200, // 4.2 km
    },
    mediumHowitzer: {
      name: 'Medium Field Howitzer (105mm)',
      role: 'Mountain & Field Artillery',
      velocity: 472,
      mass: 14.9,
      dragCoeff: 0.00045,
      calibre: 0.105, // 105mm
      barrelTwist: 2.10,
      maxRange: 11500, // 11.5 km
    },
    rapidAutocannon: {
      name: 'Rapid-Fire Autocannon',
      role: 'Close-In Defence',
      velocity: 970,
      mass: 0.19,
      dragCoeff: 0.00012,
      calibre: 0.023, // 23mm
      barrelTwist: 0.58,
      maxRange: 2500, // 2.5 km
    },
    heavyArtillery: {
      name: 'Heavy Field Artillery',
      role: 'Long-Range Ballistics',
      velocity: 827,
      mass: 43.2,
      dragCoeff: 0.0019,
      calibre: 0.155, // 155mm
      barrelTwist: 3.10, // 1:20 twist
      maxRange: 32000, // 32 km
    },
    highAngleMortar: {
      name: 'High-Angle Mortar',
      role: 'Plunging Mountain Fire',
      velocity: 250,
      mass: 4.2,
      dragCoeff: 0.0006,
      calibre: 0.081, // 81mm
      barrelTwist: 0, // Smoothbore mortar
      maxRange: 5600, // 5.6 km
    },
    precisionRifle: {
      name: 'Precision Rifle',
      role: 'Precision Fire',
      velocity: 928,
      mass: 0.042,
      dragCoeff: 0.000016,
      calibre: 0.0127, // 12.7mm
      barrelTwist: 0.38,
      maxRange: 1800, // 1.8 km
    },
  };

  const currentGun = gunCatalog[selectedGun] || gunCatalog.shortRangeInterceptor;
  const startLat = startingPoint?.lat;
  const startLng = startingPoint?.lng;
  const targetLat = targetPoint?.lat;
  const targetLng = targetPoint?.lng;

  // Auto-fetch Battery Altitude whenever Battery coordinates change
  useEffect(() => {
    let isMounted = true;
    if (startLat != null && startLng != null) {
      queueMicrotask(() => {
        if (isMounted) setFetchingStartAlt(true);
      });
      fetchElevation(startLat, startLng).then((alt) => {
        if (isMounted) {
          setStartAlt(alt);
          setFetchingStartAlt(false);
          logger.info('GIS', `Battery ground elevation resolved: ${alt.toFixed(0)}m ASL`);
        }
      });
    } else {
      queueMicrotask(() => {
        if (isMounted) {
          setStartAlt(null);
          setFetchingStartAlt(false);
        }
      });
    }
    return () => { isMounted = false; };
  }, [startLat, startLng]);

  // Auto-fetch Target Altitude whenever Target coordinates change
  useEffect(() => {
    let isMounted = true;
    if (targetLat != null && targetLng != null) {
      queueMicrotask(() => {
        if (isMounted) setFetchingTargetAlt(true);
      });
      fetchElevation(targetLat, targetLng).then((alt) => {
        if (isMounted) {
          setTargetAlt(alt);
          setFetchingTargetAlt(false);
          logger.info('GIS', `Target ground elevation resolved: ${alt.toFixed(0)}m ASL`);
        }
      });
    } else {
      queueMicrotask(() => {
        if (isMounted) {
          setTargetAlt(null);
          setFetchingTargetAlt(false);
        }
      });
    }
    return () => { isMounted = false; };
  }, [targetLat, targetLng]);

  // Auto-fetch continuous path elevation profile between Battery and Target
  useEffect(() => {
    let isMounted = true;
    if (startLat != null && startLng != null && targetLat != null && targetLng != null) {
      fetchTerrainPath({ lat: startLat, lng: startLng }, { lat: targetLat, lng: targetLng }).then((profile) => {
        if (isMounted && profile && profile.length > 0) {
          setPathTerrain(profile);
          const maxRidge = profile.reduce((max, p) => p.elevation > max ? p.elevation : max, 0);
          logger.info('GIS', `Flight path terrain profile sampled (${profile.length} waypoints, peak: ${maxRidge}m ASL)`);
        }
      });
    } else {
      queueMicrotask(() => {
        if (isMounted) {
          setPathTerrain(null);
        }
      });
    }
    return () => { isMounted = false; };
  }, [startLat, startLng, targetLat, targetLng]);

  // Compute Range and Bearing between Battery and Target
  const targetDistanceM = (startingPoint && targetPoint && startingPoint.lat && targetPoint.lat)
    ? haversineDistance(startingPoint, targetPoint)
    : 0;

  const targetBearing = (startingPoint && targetPoint && startingPoint.lat && targetPoint.lat)
    ? calculateBearing(startingPoint.lat, startingPoint.lng, targetPoint.lat, targetPoint.lng)
    : 0;

  const isTargetInRange = targetDistanceM <= currentGun.maxRange;

  // Run Simulation & Solve
  const handleFireSimulation = useCallback((e) => {
    if (e) e.preventDefault();

    if (!startingPoint || !targetPoint || !startingPoint.lat || !targetPoint.lat) {
      return;
    }

    const payload = {
      startLat: startingPoint.lat,
      startLng: startingPoint.lng,
      startElevation: startAlt,
      targetElevation: targetAlt,
      terrainProfile: pathTerrain,
      velocity: currentGun.velocity,
      mass: currentGun.mass,
      dragCoeff: currentGun.dragCoeff,
      calibre: currentGun.calibre,
      barrelTwist: currentGun.barrelTwist,
      windSpeed,
      windDirection,
      groundTempC,
      groundPressureHpa,
      gravity: 9.81,
      mode: 'targeting',
      solveFor: 'both',
      targetLatLng: targetPoint,
      gunName: currentGun.name,
      maxRange: currentGun.maxRange,
    };

    if (onFindSolutions) {
      onFindSolutions(payload);
    } else if (onCalculate) {
      onCalculate(payload);
    }
  }, [
    startingPoint,
    targetPoint,
    startAlt,
    targetAlt,
    pathTerrain,
    currentGun,
    windSpeed,
    windDirection,
    groundTempC,
    groundPressureHpa,
    onFindSolutions,
    onCalculate,
  ]);

  // Auto-solve firing solutions when locations, weapon, altitude, or path terrain changes
  useEffect(() => {
    if (startLat != null && targetLat != null && !fetchingStartAlt && !fetchingTargetAlt) {
      const timer = setTimeout(() => {
        handleFireSimulation();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [startLat, targetLat, fetchingStartAlt, fetchingTargetAlt, handleFireSimulation]);

  // Synchronize environmental and weapon settings when a historical scenario is loaded
  useEffect(() => {
    if (activeScenario) {
      let isMounted = true;
      queueMicrotask(() => {
        if (!isMounted) return;
        if (activeScenario.gunKey) setSelectedGun(activeScenario.gunKey);
        if (activeScenario.weather) {
          setWindSpeed(activeScenario.weather.windSpeed);
          setWindDirection(activeScenario.weather.windDirection);
          setGroundTempC(activeScenario.weather.groundTempC);
          setGroundPressureHpa(activeScenario.weather.groundPressureHpa);
        }
        if (activeScenario.startElevation != null) {
          setStartAlt(activeScenario.startElevation);
        }
        if (activeScenario.targetElevation != null) {
          setTargetAlt(activeScenario.targetElevation);
        }
      });
      return () => { isMounted = false; };
    }
  }, [activeScenario]);

  return (
    <div className={styles.inputBar}>
      {/* 1. Target Tracking Summary */}
      <div className={styles.sectionHeader}>
        <h3>Targeting & Positions</h3>
        {(startingPoint?.lat || targetPoint?.lat) && (
          <button
            type="button"
            onClick={onClearMarkings}
            className={styles.clearPositionsBtn}
            title="Clear Gun and Target markings from map"
          >
            Clear Markings
          </button>
        )}
      </div>

      <div className={styles.locationBox}>
        <div className={styles.locRow}>
          <span className={styles.locLabel}>Gun Battery:</span>
          <span className={styles.locCoords}>
            {startingPoint?.lat ? `${startingPoint.lat.toFixed(4)}°N, ${startingPoint.lng.toFixed(4)}°E` : 'Select on map'}
          </span>
        </div>
        <div className={styles.locRow}>
          <span className={styles.locLabel} style={{ color: 'var(--text-muted)' }}>Elevation:</span>
          <span className={styles.locAlt}>
            {fetchingStartAlt ? 'Querying...' : (startAlt != null ? `${startAlt.toFixed(0)}m ASL` : '--')}
          </span>
        </div>

        <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />

        <div className={styles.locRow}>
          <span className={styles.locLabel}>Target Objective:</span>
          <span className={styles.locCoords}>
            {targetPoint?.lat ? `${targetPoint.lat.toFixed(4)}°N, ${targetPoint.lng.toFixed(4)}°E` : 'Select on map'}
          </span>
        </div>
        <div className={styles.locRow}>
          <span className={styles.locLabel} style={{ color: 'var(--text-muted)' }}>Elevation:</span>
          <span className={styles.locAlt}>
            {fetchingTargetAlt ? 'Querying...' : (targetAlt != null ? `${targetAlt.toFixed(0)}m ASL` : '--')}
          </span>
        </div>
      </div>

      {/* Range & Bearing HUD strip */}
      <div className={styles.rangeStrip}>
        <div>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Range</span>
          <div className={styles.rangeVal}>
            {startingPoint?.lat && targetPoint?.lat
              ? (targetDistanceM >= 1000
                ? `${(targetDistanceM / 1000).toFixed(2)} km`
                : `${targetDistanceM.toFixed(0)} m`)
              : '--'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Azimuth</span>
          <div className={styles.rangeVal}>
            {startingPoint?.lat && targetPoint?.lat ? `${targetBearing.toFixed(1)}°` : '--'}
          </div>
        </div>
      </div>

      {/* 2. Weapon Selection */}
      <div className={styles.field}>
        <label htmlFor="gunSelect">Weapon System</label>
        <select
          id="gunSelect"
          value={selectedGun}
          onChange={(e) => {
            const nextKey = e.target.value;
            setSelectedGun(nextKey);
            const nextGun = gunCatalog[nextKey];
            if (nextGun) {
              logger.tactical('WEAPON', `Equipped weapon switched to ${nextGun.name} (Max range: ${(nextGun.maxRange / 1000).toFixed(1)} km)`);
            }
          }}
        >
          {Object.entries(gunCatalog).map(([key, gun]) => (
            <option key={key} value={key}>
              {gun.name} &bull; Max {(gun.maxRange / 1000).toFixed(1)} km
            </option>
          ))}
        </select>
      </div>

      {/* Live Weapon Range Check Badge */}
      <div
        className={`${styles.rangeBadge} ${
          isTargetInRange ? styles.inRange : styles.outOfRange
        }`}
      >
        {isTargetInRange ? (
          <span>TARGET IN RANGE ({(targetDistanceM / 1000).toFixed(2)} km &le; {(currentGun.maxRange / 1000).toFixed(1)} km max)</span>
        ) : (
          <span>TARGET OUT OF RANGE ({(targetDistanceM / 1000).toFixed(2)} km &gt; {(currentGun.maxRange / 1000).toFixed(1)} km max)</span>
        )}
      </div>

      {/* Atmospheric & 3D Wind Conditions */}
      <div className={styles.field}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label style={{ margin: 0, fontWeight: 700, color: '#ffffff' }}>
            Atmosphere &amp; 3D Wind
          </label>
          <span style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
            ISA MODEL
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Wind Speed (m/s)</span>
            <input
              type="number"
              min="0"
              max="50"
              step="1"
              value={windSpeed}
              onChange={(e) => setWindSpeed(Math.max(0, parseFloat(e.target.value) || 0))}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: '#ffffff',
                padding: '5px 8px',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                marginTop: '2px',
              }}
            />
          </div>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Wind Bearing (°)</span>
            <input
              type="number"
              min="0"
              max="360"
              step="5"
              value={windDirection}
              onChange={(e) => setWindDirection(((parseFloat(e.target.value) || 0) + 360) % 360)}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: '#ffffff',
                padding: '5px 8px',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                marginTop: '2px',
              }}
            />
          </div>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Air Temp (°C)</span>
            <input
              type="number"
              min="-50"
              max="55"
              step="1"
              value={groundTempC}
              onChange={(e) => setGroundTempC(parseFloat(e.target.value) || 0)}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: '#ffffff',
                padding: '5px 8px',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                marginTop: '2px',
              }}
            />
          </div>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Pressure (hPa)</span>
            <input
              type="number"
              min="600"
              max="1100"
              step="5"
              value={groundPressureHpa}
              onChange={(e) => setGroundPressureHpa(parseFloat(e.target.value) || 1013)}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: '#ffffff',
                padding: '5px 8px',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                marginTop: '2px',
              }}
            />
          </div>
        </div>
      </div>

      {/* 3. Tactical Ways to Hit Target (Interactive Trajectory Choice) */}
      <div className={styles.field}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <label style={{ margin: 0, fontWeight: 700, color: '#ffffff' }}>
            Firing Solutions
          </label>
          {availableSolutions && (
            <span style={{ fontSize: '13px', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              {(availableSolutions.targetRange / 1000).toFixed(2)} km
            </span>
          )}
        </div>

        <div className={styles.modeContainer}>
          {availableSolutions && !availableSolutions.hasViableSolution && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '12px',
              color: '#ef4444',
              fontFamily: 'var(--font-hud)',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '10px'
            }}>
              <span>TARGET UNREACHABLE (NO SOLUTION)</span>
            </div>
          )}

          {availableSolutions?.directFire ? (
            <button
              type="button"
              onClick={() => {
                if (onSelectSolution) onSelectSolution('directFire');
              }}
              className={`${styles.modeOptionBtn} ${activeSolutionType === 'directFire' ? styles.activeDirect : ''}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span>Option 1: Direct Fire</span>
                <span style={{ fontSize: '11px', background: 'rgba(0, 229, 255, 0.2)', padding: '2px 8px', borderRadius: '4px', color: '#00e5ff', fontWeight: 700 }}>
                  {activeSolutionType === 'directFire' ? 'SELECTED' : 'SELECT'}
                </span>
              </div>
              <span className={styles.modeSubtext}>
                QE: {availableSolutions.directFire.config.elevationAngle.toFixed(1)}° &bull; Defl: {availableSolutions.directFire.config.deflectionMils > 0 ? '+' : ''}{availableSolutions.directFire.config.deflectionMils || 0}mils &bull; {availableSolutions.directFire.result.analysis.timeOfFlight}s
              </span>
            </button>
          ) : (
            <button
              type="button"
              disabled
              className={styles.modeOptionBtn}
              style={{ opacity: 0.5, cursor: 'not-allowed' }}
            >
              <span>Option 1: Direct Fire</span>
              <span className={styles.modeSubtext}>
                {isTargetInRange ? 'Blocked by terrain crest' : 'Beyond maximum range'}
              </span>
            </button>
          )}

          {availableSolutions?.highArc ? (
            <button
              type="button"
              onClick={() => {
                if (onSelectSolution) onSelectSolution('highArc');
              }}
              className={`${styles.modeOptionBtn} ${activeSolutionType === 'highArc' ? styles.activeHighArc : ''}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span>Option 2: High-Arc Plunging</span>
                <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.2)', padding: '2px 8px', borderRadius: '4px', color: '#10b981', fontWeight: 700 }}>
                  {activeSolutionType === 'highArc' ? 'SELECTED' : 'SELECT'}
                </span>
              </div>
              <span className={styles.modeSubtext}>
                QE: {availableSolutions.highArc.config.elevationAngle.toFixed(1)}° &bull; Defl: {availableSolutions.highArc.config.deflectionMils > 0 ? '+' : ''}{availableSolutions.highArc.config.deflectionMils || 0}mils &bull; {availableSolutions.highArc.result.analysis.timeOfFlight}s
              </span>
            </button>
          ) : (
            <button
              type="button"
              disabled
              className={styles.modeOptionBtn}
              style={{ opacity: 0.5, cursor: 'not-allowed' }}
            >
              <span>Option 2: High-Arc Plunging</span>
              <span className={styles.modeSubtext}>
                {isTargetInRange ? 'No mathematical high-arc solution' : 'Beyond maximum range'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* 4. Action Button */}
      <button
        type="button"
        onClick={handleFireSimulation}
        className={styles.solveBtn}
      >
        Re-Calculate Solutions
      </button>
    </div>
  );
}

export default InputBar;
