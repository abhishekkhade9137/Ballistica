import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  haversineDistance,
  calculateBearing,
  generatePathCoordinates,
  getTerrainElevation,
  calculateTrajectory,
  calculateTargetingSolution,
  calculateAllTargetingSolutions,
  gravityAtAltitude,
  airDensityAtAltitude
} from '../src/utils/calculator.js';

describe('Ballistica C2 — Geodetic & Physical Constants', () => {
  test('haversineDistance correctly calculates distance between two WGS-84 points', () => {
    const p1 = { lat: 28.6139, lng: 77.2090 };
    const p2 = { lat: 28.6450, lng: 77.2580 };
    const dist = haversineDistance(p1, p2);
    assert.ok(dist > 5800 && dist < 6000, `Expected ~5900m, got ${dist}`);
  });

  test('calculateBearing returns valid compass azimuth (0° - 360°)', () => {
    const bearing = calculateBearing(28.6139, 77.2090, 28.6450, 77.2580);
    assert.ok(bearing >= 0 && bearing <= 360, `Bearing ${bearing} out of range`);
    assert.ok(bearing > 40 && bearing < 70, `Expected northeast bearing, got ${bearing}`);
  });

  test('Atmospheric model decreases air density with altitude', () => {
    const rhoSeaLevel = airDensityAtAltitude(0);
    const rhoHighAlt = airDensityAtAltitude(5000);
    assert.ok(rhoSeaLevel > 1.2 && rhoSeaLevel < 1.25, `Expected ~1.225 kg/m^3, got ${rhoSeaLevel}`);
    assert.ok(rhoHighAlt < rhoSeaLevel, `Air density at 5000m (${rhoHighAlt}) must be lower than sea level (${rhoSeaLevel})`);
  });

  test('gravityAtAltitude accounts for inverse-square variation with height', () => {
    const g0 = gravityAtAltitude(0);
    const g10k = gravityAtAltitude(10000);
    assert.ok(g0 >= 9.80 && g0 <= 9.82, `Expected ~9.81 m/s^2, got ${g0}`);
    assert.ok(g10k < g0, `Gravity at 10km (${g10k}) must be less than surface (${g0})`);
  });
});

describe('Ballistica C2 — Intermediate Path Geodetic Waypoints Sampling', () => {
  test('generatePathCoordinates produces evenly spaced waypoints along flight bearing', () => {
    const start = { lat: 34.428, lng: 75.760 }; // Dras Base
    const target = { lat: 34.460, lng: 75.810 }; // Tiger Hill Objective
    const waypoints = generatePathCoordinates(start, target, 10);

    assert.equal(waypoints.length, 10, 'Should generate exactly 10 waypoints');
    assert.equal(waypoints[0].lat, 34.428, 'First waypoint must match start lat');
    assert.equal(waypoints[0].distance, 0, 'First waypoint distance must be 0');
    assert.equal(waypoints[9].lat, 34.460, 'Last waypoint must match target lat');

    // Check distance monotonically increases along path
    for (let i = 1; i < waypoints.length; i++) {
      assert.ok(
        waypoints[i].distance > waypoints[i - 1].distance,
        `Distance at index ${i} (${waypoints[i].distance}) must exceed index ${i - 1} (${waypoints[i - 1].distance})`
      );
    }
  });

  test('getTerrainElevation queries continuous ground profile along path', () => {
    const profile = [
      { distance: 0, elevation: 3100 },
      { distance: 2500, elevation: 4350 }, // Mountain crest
      { distance: 5000, elevation: 3800 }
    ];

    const atStart = getTerrainElevation(0, 5000, 3100, 3800, profile);
    assert.equal(atStart, 3100);

    const atPeak = getTerrainElevation(2500, 5000, 3100, 3800, profile);
    assert.equal(atPeak, 4350);

    // Midpoint between crest and target
    const midway = getTerrainElevation(3750, 5000, 3100, 3800, profile);
    assert.ok(midway > 3800 && midway < 4350, `Expected interpolated elevation, got ${midway}`);
  });
});

describe('Ballistica C2 — Real Mountain Ridge Collision & Crest Clearance Tests', () => {
  // Real coordinates in Kargil Sector (Dras Valley to Tiger Hill across Tololing Ridge)
  const drasBattery = { lat: 34.4280, lng: 75.7600, elevation: 3091 };
  const tigerHillTarget = { lat: 34.4600, lng: 75.8100, elevation: 4169 };

  // Real mountain profile with high ridge in the middle (Peak at 4,354m ASL)
  const kargilMountainProfile = [
    { distance: 0, elevation: 3091 },
    { distance: 1500, elevation: 3450 },
    { distance: 3000, elevation: 4354 }, // Intermediate crest peak blocking line of sight
    { distance: 4500, elevation: 3950 },
    { distance: 5900, elevation: 4169 }
  ];

  test('Direct Fire shell strikes mountain in the middle and terminates early', () => {
    // 155mm Howitzer fired at low direct angle (15° QE)
    const directShotParams = {
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
      windSpeed: 0,
      windDirection: 0,
    };

    const sim = calculateTrajectory(directShotParams);

    // Direct fire trajectory must hit the mountain ridge
    assert.ok(sim.collision, 'Direct fire must detect terrain collision with the mountain');
    assert.equal(sim.collision.occurred, true);
    assert.ok(
      sim.collision.distance > 1000 && sim.collision.distance < 4000,
      `Collision should occur on the mountain slope/crest, happened at ${sim.collision.distance}m`
    );
    assert.equal(sim.analysis.crestStatus, 'COLLISION DETECTED');
  });

  test('High-Arc Plunging Fire lofts over the 4,354m mountain peak and clears crest', () => {
    // High angle plunging fire (72° QE)
    const highArcParams = {
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
      windSpeed: 0,
      windDirection: 0,
    };

    const sim = calculateTrajectory(highArcParams);

    // High arc must clear the mountain peak without collision
    assert.equal(sim.collision, null, 'High-Arc plunging fire must NOT collide with the mountain');
    assert.equal(sim.analysis.crestStatus, 'CLEAR');
    assert.ok(
      parseFloat(sim.analysis.maxAltitude) > 4354,
      `Kinematic apex (${sim.analysis.maxAltitude}m) must easily clear the 4,354m mountain peak`
    );
  });

  test('calculateAllTargetingSolutions discards blocked Direct Fire and presents only viable High-Arc', () => {
    const weaponParams = {
      startLat: drasBattery.lat,
      startLng: drasBattery.lng,
      startElevation: drasBattery.elevation,
      targetElevation: tigerHillTarget.elevation,
      terrainProfile: kargilMountainProfile,
      velocity: 827,
      mass: 43.2,
      dragCoeff: 0.0019,
      windSpeed: 0,
      windDirection: 0,
      gravity: 9.81,
    };

    const solutions = calculateAllTargetingSolutions(weaponParams, tigerHillTarget);

    // Direct fire hits mountain, so it must be null (filtered out!)
    assert.equal(solutions.directFire, null, 'Direct Fire must NOT be offered as a viable solution when mountain is in the way');

    // High-arc plunging fire clears the peak, so it must be available!
    assert.ok(solutions.highArc, 'High-Arc Plunging Fire must be available as viable route to hit target');
    assert.ok(solutions.highArc.config.elevationAngle > 45, 'High arc QE must exceed 45°');
  });
});

describe('Ballistica C2 — Siachen Glacier High-Altitude Thin-Air Trajectory', () => {
  test('High altitude environment (5500m ASL) extends range due to reduced air density', () => {
    // Low altitude sea-level baseline
    const seaLevelSim = calculateTrajectory({
      startLat: 28.0,
      startLng: 77.0,
      startElevation: 100,
      targetElevation: 100,
      velocity: 800,
      elevationAngle: 45,
      mass: 40,
      dragCoeff: 0.002,
    });

    // Siachen glacier high altitude (5,500m ASL)
    const siachenSim = calculateTrajectory({
      startLat: 35.42,
      startLng: 77.10,
      startElevation: 5500,
      targetElevation: 5500,
      velocity: 800,
      elevationAngle: 45,
      mass: 40,
      dragCoeff: 0.002,
    });

    const seaLevelRange = parseFloat(seaLevelSim.analysis.groundDistance);
    const siachenRange = parseFloat(siachenSim.analysis.groundDistance);

    // Due to thin air (lower rho), drag is significantly less, so round flies farther!
    assert.ok(
      siachenRange > seaLevelRange,
      `Siachen range (${siachenRange}m) must exceed sea level range (${seaLevelRange}m) due to reduced air density`
    );
  });
});

describe('Ballistica C2 — Real DEM Elevation API & Dynamic Relief Tests', () => {
  test('fetchElevation retrieves real-world mountain elevation in J&K sector', async () => {
    const { fetchElevation } = await import('../src/utils/calculator.js');
    const elev = await fetchElevation(34.4280, 75.7600);
    assert.ok(typeof elev === 'number', 'Elevation must be numeric');
    assert.ok(elev > 2500 && elev < 4000, `Expected mountain elevation (~3089m), got ${elev}m`);
  });

  test('fetchTerrainPath samples non-flat topographical relief across mountain ridge', async () => {
    const { fetchTerrainPath } = await import('../src/utils/calculator.js');
    const start = { lat: 34.4280, lng: 75.7600 };
    const target = { lat: 34.4550, lng: 75.7950 };
    const path = await fetchTerrainPath(start, target, 10);
    assert.equal(path.length, 10, 'Expected 10 terrain path waypoints');
    const elevs = path.map(p => p.elevation);
    const minElev = Math.min(...elevs);
    const maxElev = Math.max(...elevs);
    const reliefDelta = maxElev - minElev;
    assert.ok(reliefDelta > 200, `Terrain must show elevation change > 200m across mountain slope, got ${reliefDelta}m`);
  });

  test('calculateAllTargetingSolutions explicitly flags hasViableSolution: false when target is unreachable', () => {
    const start = { lat: 34.4280, lng: 75.7600 };
    const farTarget = { lat: 34.9000, lng: 76.5000 }; // ~85 km away
    const params = {
      startLat: start.lat,
      startLng: start.lng,
      startElevation: 3000,
      targetElevation: 3500,
      velocity: 1100, // C-UAS max ~5.5 km
      mass: 0.4,
      dragCoeff: 0.00008,
      windSpeed: 2,
      windDirection: 270,
      gravity: 9.81,
      mode: 'targeting',
      solveFor: 'elevationLow',
      targetLatLng: farTarget,
    };

    const res = calculateAllTargetingSolutions(params, farTarget);
    assert.equal(res.hasViableSolution, false, 'hasViableSolution must be false for unreachable target');
    assert.equal(res.directFire, null, 'Direct fire must be null');
    assert.equal(res.highArc, null, 'High-arc fire must be null');
    assert.ok(res.directReason.includes('range') || res.directReason.includes('beyond'), 'Direct reason must state range limit');
  });

  test('Trajectory clears mountain crest when projectile altitude at crest distance exceeds terrain elevation', () => {
    const terrainProfile = [
      { distance: 0, elevation: 416 },
      { distance: 14000, elevation: 1367 }, // Crest at 14km
      { distance: 17360, elevation: 614 },
    ];
    const sim = calculateTrajectory({
      startLat: 34.0,
      startLng: 75.0,
      startElevation: 416,
      targetElevation: 614,
      velocity: 827,
      elevationAngle: 14.5,
      mass: 43.2,
      dragCoeff: 0.0019,
      terrainProfile,
      _fastMode: false,
    });

    assert.equal(sim.collision, null, 'Must clear crest without collision');
    const ptAt14k = sim.trajectory.find(p => Math.sqrt(p.x * p.x + p.y * p.y) >= 14000);
    assert.ok(ptAt14k.altitude > 1367, `Altitude at 14km (${ptAt14k.altitude}m) must clear 1367m crest`);
  });
});

describe('Ballistica C2 — Phase 1: ISA Atmosphere & Thermodynamic Variance', () => {
  test('ISA temperature lapse rate drops 6.5 K/km and affects speed of sound', async () => {
    const { getAtmosphericState } = await import('../src/utils/calculator.js');
    const seaLevel = getAtmosphericState(0, 15, 1013.25);
    const mountain5k = getAtmosphericState(5000, 15, 1013.25);

    assert.ok(Math.abs(seaLevel.temperatureC - 15) < 0.1, 'Sea level temp should be 15°C');
    assert.ok(Math.abs(mountain5k.temperatureC - (-17.5)) < 0.1, '5000m temp should be -17.5°C');

    assert.ok(seaLevel.speedOfSound > 339 && seaLevel.speedOfSound < 342, `Expected ~340.3 m/s, got ${seaLevel.speedOfSound}`);
    assert.ok(mountain5k.speedOfSound < seaLevel.speedOfSound, 'Speed of sound in cold mountain air must be lower than sea level');
  });

  test('Hot vs cold weather variance changes surface air density and alters ballistic drag', async () => {
    const { getAtmosphericState } = await import('../src/utils/calculator.js');
    const desertHot = getAtmosphericState(0, 45, 1013.25); // 45°C
    const arcticCold = getAtmosphericState(0, -20, 1013.25); // -20°C

    assert.ok(desertHot.density < 1.15, `Hot desert air density (${desertHot.density}) should be thin (< 1.15)`);
    assert.ok(arcticCold.density > 1.35, `Cold arctic air density (${arcticCold.density}) should be dense (> 1.35)`);
    assert.ok(arcticCold.density > desertHot.density, 'Cold air must be significantly denser than hot air');
  });

  test('Mach-dependent wave drag multiplier increases through transonic barrier', async () => {
    const { getMachDragMultiplier } = await import('../src/utils/calculator.js');
    const subsonic = getMachDragMultiplier(0.5);
    const transonic = getMachDragMultiplier(1.0);
    const supersonic = getMachDragMultiplier(2.4);

    assert.ok(transonic > subsonic, 'Transonic wave drag must exceed subsonic laminar drag');
    assert.ok(supersonic >= 1.0, 'Supersonic cruise multiplier should normalize near 1.0');
  });
});

describe('Ballistica C2 — Phase 2: 3D Wind & Altitude Wind Shear', () => {
  test('Altitude wind shear increases wind velocity aloft via power law', async () => {
    const { getWindVectorAtAltitude } = await import('../src/utils/calculator.js');
    const surfaceWind = getWindVectorAtAltitude(10, 0, 10, 270);
    const apexWind = getWindVectorAtAltitude(4000, 0, 10, 270);

    assert.ok(apexWind.speed > surfaceWind.speed, 'Wind speed aloft must exceed surface wind speed due to atmospheric shear');
    assert.ok(apexWind.wx > 0, 'Wind coming from 270° (West) must have positive Eastward velocity component wx');
  });

  test('Headwind compresses ground range compared to tailwind', () => {
    const baseConfig = {
      startLat: 34.0,
      startLng: 75.0,
      velocity: 800,
      elevationAngle: 30,
      azimuthAngle: 0, // Firing due North
      mass: 43.2,
      dragCoeff: 0.0019,
    };

    // Firing North (0°) with 15 m/s headwind coming from North (0°)
    const headwindSim = calculateTrajectory({
      ...baseConfig,
      windSpeed: 15,
      windDirection: 0,
    });

    // Firing North (0°) with 15 m/s tailwind coming from South (180°)
    const tailwindSim = calculateTrajectory({
      ...baseConfig,
      windSpeed: 15,
      windDirection: 180,
    });

    const headwindRange = parseFloat(headwindSim.analysis.groundDistance);
    const tailwindRange = parseFloat(tailwindSim.analysis.groundDistance);

    assert.ok(tailwindRange > headwindRange, `Tailwind range (${tailwindRange}m) must exceed headwind range (${headwindRange}m)`);
  });

  test('Crosswind causes lateral deflection off the bore line', () => {
    // Firing due North (0°) with 12 m/s crosswind blowing from West (270°)
    const sim = calculateTrajectory({
      startLat: 34.0,
      startLng: 75.0,
      velocity: 827,
      elevationAngle: 35,
      azimuthAngle: 0,
      mass: 43.2,
      dragCoeff: 0.0019,
      windSpeed: 12,
      windDirection: 270,
    });

    // Projectile must be pushed toward the East (positive x / positive lateral deflection)
    assert.ok(sim.impactPoint.x > 50, `Crosswind must deflect projectile to East, got x = ${sim.impactPoint.x}m`);
    assert.ok(parseFloat(sim.analysis.netLateralDeflection) > 50, 'Crosswind lateral deflection must be registered in analysis');
  });
});

describe('Ballistica C2 — Phase 3 & 4: Planetary Dynamics & Spin Drift', () => {
  test('Northern Hemisphere Coriolis accelerates shell to the right of trajectory', () => {
    // Northern hemisphere (lat = 34°N), zero wind, smoothbore (twist = 0)
    const simNorth = calculateTrajectory({
      startLat: 34.0,
      startLng: 75.0,
      velocity: 827,
      elevationAngle: 45,
      azimuthAngle: 0, // Firing due North
      mass: 43.2,
      dragCoeff: 0.0019,
      barrelTwist: 0, // Isolate Coriolis
      windSpeed: 0,
    });

    // In Northern hemisphere, Coriolis pushes North-flying shell to the East (right)
    assert.ok(simNorth.impactPoint.x > 0, 'Northern hemisphere Coriolis must deflect North-bound shell to the right (East)');
  });

  test('Right-hand rifling spin induces rightward gyroscopic spin drift', () => {
    // Zero wind, rifled barrel (twist = 3.0m)
    const rifledSim = calculateTrajectory({
      startLat: 0.0, // Equator (zero horizontal Coriolis)
      startLng: 75.0,
      velocity: 827,
      elevationAngle: 40,
      azimuthAngle: 0,
      mass: 43.2,
      dragCoeff: 0.0019,
      barrelTwist: 3.1, // 155mm standard rifling
      windSpeed: 0,
    });

    // Smoothbore equivalent
    const smoothSim = calculateTrajectory({
      startLat: 0.0,
      startLng: 75.0,
      velocity: 827,
      elevationAngle: 40,
      azimuthAngle: 0,
      mass: 43.2,
      dragCoeff: 0.0019,
      barrelTwist: 0,
      windSpeed: 0,
    });

    assert.ok(rifledSim.impactPoint.x > smoothSim.impactPoint.x, 'Rifled projectile must experience rightward spin drift beyond smoothbore');
  });
});

describe('Ballistica C2 — Phase 5: Automated Fire-Control Laying Solver', () => {
  test('Solver calculates required azimuth deflection angle to hit target under crosswind & spin drift', () => {
    const start = { lat: 34.4280, lng: 75.7600 };
    const target = { lat: 34.4550, lng: 75.7950 };
    const targetDist = haversineDistance(start, target);

    const crosswindParams = {
      startLat: start.lat,
      startLng: start.lng,
      startElevation: 3089,
      targetElevation: 3742,
      velocity: 827,
      mass: 43.2,
      dragCoeff: 0.0019,
      calibre: 0.155,
      barrelTwist: 3.1,
      windSpeed: 8,
      windDirection: 270, // 8 m/s crosswind from West
      targetLatLng: target,
    };

    const solution = calculateTargetingSolution(crosswindParams, target, 'elevationLow');

    assert.ok(solution.elevationAngle > 0 && solution.elevationAngle < 45, 'Direct fire QE must be within 0-45°');
    assert.ok(solution.deflectionAngle !== 0, 'Solver must compute non-zero bearing deflection angle to negate drift');
    assert.ok(Math.abs(solution.rangeError) < 100, `Target range error (${solution.rangeError}m) must be within 100m for ${targetDist}m shot`);
  });
});
