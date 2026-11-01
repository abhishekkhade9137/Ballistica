// Client-Side Self-Test Diagnostic Suite for Ballistica C2
import {
  haversineDistance,
  calculateBearing,
  getTerrainElevation,
  calculateTrajectory,
  calculateAllTargetingSolutions,
  gravityAtAltitude,
  airDensityAtAltitude
} from './calculator';
import { logger } from './logger';

export async function runClientDiagnostics() {
  const results = [];
  const t0 = performance.now();
  logger.test('DIAGNOSTICS', 'Starting Ballistica C2 Automated Diagnostics Suite...');

  function runTest(suite, name, fn) {
    const start = performance.now();
    try {
      fn();
      const durationMs = (performance.now() - start).toFixed(2);
      const res = { suite, name, status: 'PASS', durationMs, error: null };
      results.push(res);
      logger.test('PASS', `[${suite}] ${name} (${durationMs}ms)`);
    } catch (err) {
      const durationMs = (performance.now() - start).toFixed(2);
      const res = { suite, name, status: 'FAIL', durationMs, error: err.message };
      results.push(res);
      logger.error('FAIL', `[${suite}] ${name}: ${err.message} (${durationMs}ms)`);
    }
  }

  // 1. Geodetic & Physical Math
  runTest('Geodetic', 'WGS-84 Haversine Distance Calculation', () => {
    const p1 = { lat: 28.6139, lng: 77.2090 };
    const p2 = { lat: 28.6450, lng: 77.2580 };
    const d = haversineDistance(p1, p2);
    if (d < 5800 || d > 6000) throw new Error(`Expected ~5900m, got ${d.toFixed(1)}m`);
  });

  runTest('Geodetic', 'Azimuth Bearing Heading', () => {
    const b = calculateBearing(28.6139, 77.2090, 28.6450, 77.2580);
    if (b < 40 || b > 70) throw new Error(`Expected NE azimuth (40°-70°), got ${b.toFixed(1)}°`);
  });

  runTest('Atmospheric', 'Barometric Air Density & Gravity Modeling', () => {
    const rho0 = airDensityAtAltitude(0);
    const rho5k = airDensityAtAltitude(5000);
    const g0 = gravityAtAltitude(0);
    const g10k = gravityAtAltitude(10000);
    if (rho5k >= rho0) throw new Error('Air density at 5km must be lower than sea level');
    if (g10k >= g0) throw new Error('Gravity at 10km must be lower than surface');
  });

  // 2. Terrain Interpolation
  runTest('GIS Terrain', 'Linear Altitude Interpolation Across Path', () => {
    const elev = getTerrainElevation(2500, 5000, 200, 300, null);
    if (Math.round(elev) !== 250) throw new Error(`Expected 250m, got ${elev}m`);
  });

  // 3. Forward Ballistic Euler Integration
  runTest('Ballistics', 'Numerical Euler Step Integration (45° Arc)', () => {
    const sim = calculateTrajectory({
      startLat: 28.6139,
      startLng: 77.2090,
      velocity: 1000,
      elevationAngle: 45,
      azimuthAngle: 90,
      mass: 0.96,
      dragCoeff: 0.00015,
      startElevation: 200,
      targetElevation: 200,
      windSpeed: 0,
      windDirection: 0,
    });
    if (!sim.trajectory || sim.trajectory.length < 50) throw new Error('Trajectory integration failed');
    if (parseFloat(sim.analysis.groundDistance) < 1000) throw new Error('Insufficient simulated range');
  });

  // 4. Dual Target Solver
  runTest('Targeting Solver', 'Simultaneous Direct Fire & High-Arc Convergence', () => {
    const solutions = calculateAllTargetingSolutions({
      startLat: 28.6139,
      startLng: 77.2090,
      startElevation: 215,
      targetElevation: 220,
      velocity: 1100,
      mass: 0.4,
      dragCoeff: 0.00008,
      windSpeed: 2.5,
      windDirection: 270,
      gravity: 9.81,
    }, { lat: 28.6450, lng: 77.2580 });

    if (!solutions.directFire) throw new Error('Direct Fire solution missing');
    if (!solutions.highArc) throw new Error('High Arc plunging solution missing');

    const directAngle = solutions.directFire.config.elevationAngle;
    const highAngle = solutions.highArc.config.elevationAngle;
    if (directAngle <= 0 || directAngle >= 45) throw new Error(`Invalid direct angle: ${directAngle}°`);
    if (highAngle < 45 || highAngle >= 90) throw new Error(`Invalid high arc angle: ${highAngle}°`);
  });

  // 5. Real Mountain in the Middle (Kargil Sector: Dras to Tiger Hill across Tololing Ridge)
  const drasBattery = { lat: 34.4280, lng: 75.7600, elevation: 3091 };
  const tigerHillTarget = { lat: 34.4600, lng: 75.8100, elevation: 4169 };
  const kargilMountainProfile = [
    { distance: 0, elevation: 3091 },
    { distance: 1500, elevation: 3450 },
    { distance: 3000, elevation: 4354 }, // Intermediate peak blocking line of fire
    { distance: 4500, elevation: 3950 },
    { distance: 5900, elevation: 4169 }
  ];

  runTest('Mountain Clearance', 'Direct Fire Collides with 4354m Mountain Crest', () => {
    const sim = calculateTrajectory({
      startLat: drasBattery.lat,
      startLng: drasBattery.lng,
      startElevation: drasBattery.elevation,
      targetElevation: tigerHillTarget.elevation,
      terrainProfile: kargilMountainProfile,
      velocity: 827,
      elevationAngle: 15,
      azimuthAngle: 50,
      mass: 43.2,
      dragCoeff: 0.0019,
    });
    if (!sim.collision || !sim.collision.occurred) {
      throw new Error('Direct fire should have collided with intermediate mountain peak');
    }
  });

  runTest('Mountain Clearance', 'High-Arc Plunging Fire Clears Crest (Apex > 4354m)', () => {
    const sim = calculateTrajectory({
      startLat: drasBattery.lat,
      startLng: drasBattery.lng,
      startElevation: drasBattery.elevation,
      targetElevation: tigerHillTarget.elevation,
      terrainProfile: kargilMountainProfile,
      velocity: 827,
      elevationAngle: 72,
      azimuthAngle: 50,
      mass: 43.2,
      dragCoeff: 0.0019,
    });
    if (sim.collision) {
      throw new Error('High-arc plunging fire should NOT collide with mountain');
    }
    if (parseFloat(sim.analysis.maxAltitude) <= 4354) {
      throw new Error('Kinematic apex must exceed 4,354m mountain peak');
    }
  });

  runTest('Tactical Solver', 'Mountain in Middle Filters Out Blocked Direct Fire', () => {
    const solutions = calculateAllTargetingSolutions({
      startLat: drasBattery.lat,
      startLng: drasBattery.lng,
      startElevation: drasBattery.elevation,
      targetElevation: tigerHillTarget.elevation,
      terrainProfile: kargilMountainProfile,
      velocity: 827,
      mass: 43.2,
      dragCoeff: 0.0019,
      gravity: 9.81,
    }, tigerHillTarget);

    if (solutions.directFire !== null) {
      throw new Error('Direct Fire must be discarded when mountain is in the way');
    }
    if (!solutions.highArc) {
      throw new Error('High-Arc Plunging Fire must be returned as valid viable route');
    }
  });

  const totalTimeMs = (performance.now() - t0).toFixed(1);
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;

  logger.test('COMPLETE', `Diagnostics completed: ${passCount} Passed, ${failCount} Failed in ${totalTimeMs}ms`);

  return {
    results,
    passCount,
    failCount,
    totalCount: results.length,
    totalTimeMs,
    timestamp: new Date().toLocaleTimeString(),
  };
}
