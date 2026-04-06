import React, { useState, useEffect } from 'react';
import styles from './InputBar.module.css';
import { fetchElevation } from '../utils/calculator';

function InputBar({ onCalculate, startingPoint, targetPoint, onUpdateStartingPoint, onUpdateTargetPoint }) {
  const [mode, setMode] = useState('forward'); // 'forward' | 'targeting'
  const [solveFor, setSolveFor] = useState('elevationLow'); // 'elevationLow' | 'elevationHigh' | 'velocity'
  
  const [elevationAngle, setElevationAngle] = useState('45');
  const [azimuthAngle, setAzimuthAngle] = useState('0');
  const [velocity, setVelocity] = useState('300');
  const [windSpeed, setWindSpeed] = useState('0');
  const [windDirection, setWindDirection] = useState('0');
  const [startLat, setStartLat] = useState('');
  const [startLng, setStartLng] = useState('');
  const [targetLat, setTargetLat] = useState('');
  const [targetLng, setTargetLng] = useState('');
  const [startElevation, setStartElevation] = useState('0');
  const [targetElevation, setTargetElevation] = useState('0');
  const [gravity, setGravity] = useState('9.81');
  const [dragCoeff, setDragCoeff] = useState('0.005'); // tuned for realistic firearm trajectories
  const [mass, setMass] = useState('1'); // kg
  const [loadingElevation, setLoadingElevation] = useState(false);
  const [elevationStatus, setElevationStatus] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('custom');

  const presets = {
    custom: { name: 'Custom' },
    // Realistic
    stoneThrow: { name: 'Stone Throw (Average)', velocity: '25', elevationAngle: '45', dragCoeff: '0.0007', mass: '0.15' },
    pistol9mm: { name: '9mm Pistol (Standard)', velocity: '380', elevationAngle: '0', dragCoeff: '0.00001', mass: '0.0075' },
    sniper50cal: { name: '.50 BMG Sniper', velocity: '928', elevationAngle: '0', dragCoeff: '0.000016', mass: '0.042' },
    mortar81mm: { name: '81mm Mortar', velocity: '250', elevationAngle: '65', dragCoeff: '0.0006', mass: '4.2' },
    howitzer155mm: { name: '155mm Howitzer', velocity: '827', elevationAngle: '45', dragCoeff: '0.0019', mass: '43.2' },
    // Funny
    paperAirplane: { name: 'Paper Airplane', velocity: '5', elevationAngle: '15', dragCoeff: '0.011', mass: '0.004' },
    bowlingCannon: { name: 'Bowling Ball (Cannon)', velocity: '200', elevationAngle: '35', dragCoeff: '0.008', mass: '7.2' },
    trebuchetCow: { name: 'A Cow (Trebuchet)', velocity: '60', elevationAngle: '45', dragCoeff: '0.8', mass: '600' },
    toyotaCorolla: { name: 'Toyota Corolla (Tornado)', velocity: '80', elevationAngle: '40', dragCoeff: '0.35', mass: '1300' },
  };

  const handlePresetChange = (e) => {
    const key = e.target.value;
    setSelectedPreset(key);
    if (key !== 'custom') {
      const p = presets[key];
      setVelocity(p.velocity);
      setElevationAngle(p.elevationAngle);
      setDragCoeff(p.dragCoeff);
      setMass(p.mass);
    }
  };

  useEffect(() => {
    setStartLat(startingPoint.lat.toString());
    setStartLng(startingPoint.lng.toString());
  }, [startingPoint]);

  useEffect(() => {
    if (targetPoint) {
      setTargetLat(targetPoint.lat.toString());
      setTargetLng(targetPoint.lng.toString());
    }
  }, [targetPoint]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const params = {
      elevationAngle: parseFloat(elevationAngle),
      azimuthAngle: parseFloat(azimuthAngle) || 0,
      velocity: parseFloat(velocity),
      windSpeed: parseFloat(windSpeed) || 0,
      windDirection: parseFloat(windDirection) || 0,
      startLat: parseFloat(startLat) || 0,
      startLng: parseFloat(startLng) || 0,
      startElevation: parseFloat(startElevation) || 0,
      targetElevation: parseFloat(targetElevation) || 0,
      gravity: parseFloat(gravity),
      dragCoeff: parseFloat(dragCoeff),
      mass: parseFloat(mass),
      mode,
      solveFor,
      targetLatLng: mode === 'targeting' ? { lat: parseFloat(targetLat) || 0, lng: parseFloat(targetLng) || 0 } : null,
    };

    // Validate required parameters based on mode
    if (mode === 'forward') {
      if (isNaN(params.elevationAngle) || isNaN(params.velocity) || isNaN(params.mass)) {
        alert('Please enter valid numerical values');
        return;
      }
    } else {
      // Targeting Mode Validation
      if (isNaN(params.mass) || isNaN(params.targetLatLng.lat) || isNaN(params.targetLatLng.lng)) {
        alert('Please enter valid numerical values for Mass and Target Coordinates');
        return;
      }
      if (solveFor === 'velocity' && isNaN(params.elevationAngle)) {
        alert('You must provide a fixed Elevation Angle to solve for Velocity');
        return;
      }
      if (solveFor.startsWith('elevation') && isNaN(params.velocity)) {
        alert('You must provide a fixed Velocity to solve for Elevation');
        return;
      }
    }

    if (onCalculate) {
      onCalculate(params);
    }
  };

  const handleLatChange = (e) => {
    const value = e.target.value;
    setStartLat(value);
    if (onUpdateStartingPoint) onUpdateStartingPoint(parseFloat(value) || 0, parseFloat(startLng) || 0);
  };

  const handleLngChange = (e) => {
    const value = e.target.value;
    setStartLng(value);
    if (onUpdateStartingPoint) onUpdateStartingPoint(parseFloat(startLat) || 0, parseFloat(value) || 0);
  };

  const handleTargetLatChange = (e) => {
    const value = e.target.value;
    setTargetLat(value);
    if (onUpdateTargetPoint) onUpdateTargetPoint(parseFloat(value) || 0, parseFloat(targetLng) || 0);
  };

  const handleTargetLngChange = (e) => {
    const value = e.target.value;
    setTargetLng(value);
    if (onUpdateTargetPoint) onUpdateTargetPoint(parseFloat(targetLat) || 0, parseFloat(value) || 0);
  };

  const fetchStartingElevation = async () => {
    const lat = parseFloat(startLat);
    const lng = parseFloat(startLng);
    if (isNaN(lat) || isNaN(lng)) {
      setElevationStatus('Please enter valid coordinates');
      return;
    }
    
    setLoadingElevation(true);
    setElevationStatus('Fetching elevation...');
    try {
      const elevation = await fetchElevation(lat, lng);
      setStartElevation(elevation.toString());
      setElevationStatus(`Starting elevation: ${elevation.toFixed(1)}m`);
    } catch (error) {
      setElevationStatus('Error fetching elevation');
    } finally {
      setLoadingElevation(false);
    }
  };

  const fetchTargetElevationData = async () => {
    const lat = parseFloat(startLat);
    const lng = parseFloat(startLng);
    if (isNaN(lat) || isNaN(lng)) {
      setElevationStatus('Please enter valid coordinates');
      return;
    }
    
    setLoadingElevation(true);
    setElevationStatus('Fetching target elevation...');
    try {
      const elevation = await fetchElevation(lat, lng);
      setTargetElevation(elevation.toString());
      setElevationStatus(`Target elevation: ${elevation.toFixed(1)}m`);
    } catch (error) {
      setElevationStatus('Error fetching elevation');
    } finally {
      setLoadingElevation(false);
    }
  };

  return (
    <form className={styles.inputBar} onSubmit={handleSubmit}>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', background: '#e1e5e9', padding: '4px', borderRadius: '8px' }}>
        <button 
          type="button" 
          onClick={() => setMode('forward')}
          style={{ flex: 1, padding: '8px', border: 'none', background: mode === 'forward' ? '#fff' : 'transparent', borderRadius: '4px', fontWeight: mode === 'forward' ? 'bold' : 'normal', cursor: 'pointer', boxShadow: mode === 'forward' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
        >
          Forward Sim
        </button>
        <button 
          type="button" 
          onClick={() => setMode('targeting')}
          style={{ flex: 1, padding: '8px', border: 'none', background: mode === 'targeting' ? '#fff' : 'transparent', borderRadius: '4px', fontWeight: mode === 'targeting' ? 'bold' : 'normal', cursor: 'pointer', boxShadow: mode === 'targeting' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
        >
          Targeting
        </button>
      </div>

      <h3>Presets</h3>
      <div className={styles.field} style={{ marginBottom: '10px' }}>
        <select 
          value={selectedPreset} 
          onChange={handlePresetChange}
          style={{ padding: '10px', borderRadius: '6px', border: '2px solid #e1e5e9', fontSize: '14px' }}
        >
          {Object.entries(presets).map(([key, preset]) => (
            <option key={key} value={key}>{preset.name}</option>
          ))}
        </select>
        <small style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>Auto-fills common projectile profiles</small>
      </div>

      <h3>Starting Position</h3>
      <div className={styles.field}>
        <label htmlFor="startLat">Latitude</label>
        <input
          type="number"
          id="startLat"
          value={startLat}
          onChange={handleLatChange}
          placeholder="0.0000"
          step="0.0001"
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="startLng">Longitude</label>
        <input
          type="number"
          id="startLng"
          value={startLng}
          onChange={handleLngChange}
          placeholder="0.0000"
          step="0.0001"
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="startElevation">Starting Elevation (m)</label>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="number"
            id="startElevation"
            value={startElevation}
            onChange={(e) => setStartElevation(e.target.value)}
            placeholder="0"
            step="1"
            style={{ flex: 1 }}
          />
          <button 
            type="button" 
            onClick={fetchStartingElevation}
            disabled={loadingElevation}
            style={{ 
              padding: '8px 12px', 
              fontSize: '12px', 
              cursor: loadingElevation ? 'not-allowed' : 'pointer',
              opacity: loadingElevation ? 0.6 : 1
            }}
          >
            {loadingElevation ? 'Loading...' : 'Fetch'}
          </button>
        </div>
      </div>

      {mode === 'targeting' && (
        <>
          <h3 style={{ color: '#e53e3e' }}>Target Location (Inverse Sim)</h3>
          <p style={{ fontSize: '12px', color: '#666', margin: '4px 0 12px 0' }}>Right-click on the map to set quickly.</p>
          <div className={styles.field}>
            <label htmlFor="targetLat">Target Latitude</label>
            <input
              type="number"
              id="targetLat"
              value={targetLat}
              onChange={handleTargetLatChange}
              placeholder="0.0000"
              step="0.0001"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="targetLng">Target Longitude</label>
            <input
              type="number"
              id="targetLng"
              value={targetLng}
              onChange={handleTargetLngChange}
              placeholder="0.0000"
              step="0.0001"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="solveFor">Solve For...</label>
            <select 
              id="solveFor"
              value={solveFor} 
              onChange={(e) => setSolveFor(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="elevationLow">Elevation Angle (Direct Fire)</option>
              <option value="elevationHigh">Elevation Angle (Mortar/High Arc)</option>
              <option value="velocity">Velocity (Given Fixed Arc)</option>
            </select>
          </div>
        </>
      )}

      <h3>Ballistics Parameters</h3>
      
      {(mode === 'forward' || solveFor === 'velocity') && (
        <div className={styles.field}>
          <label htmlFor="elevationAngle">Elevation Angle (°)</label>
          <input
            type="number"
            id="elevationAngle"
            value={elevationAngle}
            onChange={(e) => setElevationAngle(e.target.value)}
            placeholder="45"
            min="0"
            max="90"
          />
          <small style={{ color: '#666', fontSize: '12px' }}>Angle above horizontal (0°-90°)</small>
        </div>
      )}

      {mode === 'forward' && (
        <div className={styles.field}>
          <label htmlFor="azimuthAngle">Azimuth Angle (°)</label>
          <input
            type="number"
            id="azimuthAngle"
            value={azimuthAngle}
            onChange={(e) => setAzimuthAngle(e.target.value)}
            placeholder="0"
            min="0"
            max="360"
          />
          <small style={{ color: '#666', fontSize: '12px' }}>0°=North, 90°=East, 180°=South, 270°=West</small>
        </div>
      )}

      {(mode === 'forward' || solveFor.startsWith('elevation')) && (
        <div className={styles.field}>
          <label htmlFor="velocity">Initial Velocity (m/s)</label>
          <input
            type="number"
            id="velocity"
            value={velocity}
            onChange={(e) => setVelocity(e.target.value)}
            placeholder="300"
          />
        </div>
      )}

      <h3>Environmental Factors</h3>
      <div className={styles.field}>
        <label htmlFor="windSpeed">Wind Speed (m/s)</label>
        <input
          type="number"
          id="windSpeed"
          value={windSpeed}
          onChange={(e) => setWindSpeed(e.target.value)}
          placeholder="5"
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="windDirection">Wind Direction (°)</label>
        <input
          type="number"
          id="windDirection"
          value={windDirection}
          onChange={(e) => setWindDirection(e.target.value)}
          placeholder="0"
        />
      </div>

      <h3>Terrain Settings</h3>
      <div className={styles.field}>
        <label htmlFor="targetElevation">Target Elevation (m)</label>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="number"
            id="targetElevation"
            value={targetElevation}
            onChange={(e) => setTargetElevation(e.target.value)}
            placeholder="0"
            step="1"
            style={{ flex: 1 }}
          />
          <button 
            type="button" 
            onClick={fetchTargetElevationData}
            disabled={loadingElevation}
            style={{ 
              padding: '8px 12px', 
              fontSize: '12px', 
              cursor: loadingElevation ? 'not-allowed' : 'pointer',
              opacity: loadingElevation ? 0.6 : 1
            }}
          >
            {loadingElevation ? 'Loading...' : 'Fetch'}
          </button>
        </div>
        <small style={{ color: '#666', fontSize: '12px' }}>Elevation of target location - projectile impacts when it reaches this height</small>
      </div>
      {elevationStatus && (
        <p style={{ fontSize: '12px', color: '#667eea', margin: '8px 0', fontWeight: 500 }}>
          {elevationStatus}
        </p>
      )}

      <h3>Advanced Settings</h3>
      <p style={{ fontSize: '12px', color: '#666', margin: '10px 0' }}>
        Advanced calculations include: air resistance, wind effects, Coriolis effect, variable gravity, variable atmospheric density, and Eötvös effect
      </p>
      <div className={styles.field}>
        <label htmlFor="gravity">Gravity (m/s²)</label>
        <input
          type="number"
          id="gravity"
          value={gravity}
          onChange={(e) => setGravity(e.target.value)}
          placeholder="9.81"
          step="0.01"
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="dragCoeff">Drag Coefficient</label>
        <input
          type="number"
          id="dragCoeff"
          value={dragCoeff}
          onChange={(e) => setDragCoeff(e.target.value)}
          placeholder="0.001"
          step="0.000001"
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="mass">Projectile Mass (kg)</label>
        <input
          type="number"
          id="mass"
          value={mass}
          onChange={(e) => setMass(e.target.value)}
          placeholder="1.0"
          step="0.001"
        />
      </div>

      <button type="submit" className={styles.calculateBtn}>
        Calculate Trajectory
      </button>
    </form>
  );
}

export default InputBar;
