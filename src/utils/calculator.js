// Advanced ballistics calculation utilities

// Constants
const EARTH_RADIUS = 6371000; // meters (mean radius)
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const EARTH_ANGULAR_VELOCITY = 7.292e-5; // rad/s
const GRAVITY_SEA_LEVEL = 9.80665; // m/s^2 at sea level
const ATMOSPHERIC_SCALE_HEIGHT = 8500; // meters

// Convert lat/lng to cartesian displacement from reference point
function latLngToXY(lat, lng, refLat, refLng) {
  const dLat = (lat - refLat) * DEG_TO_RAD;
  const dLng = (lng - refLng) * DEG_TO_RAD;
  const x = EARTH_RADIUS * dLng * Math.cos(refLat * DEG_TO_RAD);
  const y = EARTH_RADIUS * dLat;
  return { x, y };
}

// Convert cartesian displacement back to lat/lng
function xyToLatLng(x, y, refLat, refLng) {
  const dLat = y / EARTH_RADIUS;
  const dLng = x / (EARTH_RADIUS * Math.cos(refLat * DEG_TO_RAD));
  const lat = refLat + dLat * RAD_TO_DEG;
  const lng = refLng + dLng * RAD_TO_DEG;
  return { lat, lng };
}

// Gravity decreases with altitude: g(h) = g0 * (R/(R+h))^2
function gravityAtAltitude(altitude) {
  return GRAVITY_SEA_LEVEL * Math.pow(EARTH_RADIUS / (EARTH_RADIUS + Math.max(0, altitude)), 2);
}

// Atmospheric density as function of altitude (exponential model)
function airDensityAtAltitude(altitude) {
  const seaLevelDensity = 1.225; // kg/m^3
  return seaLevelDensity * Math.exp(-Math.max(0, altitude) / ATMOSPHERIC_SCALE_HEIGHT);
}

// Eotvos effect on effective gravity
function eotvosCorrection(latitude, velocityEast, velocityNorth) {
  const latRad = latitude * DEG_TO_RAD;
  const centrifugal = 2 * EARTH_ANGULAR_VELOCITY * EARTH_ANGULAR_VELOCITY * EARTH_RADIUS * Math.sin(2 * latRad);
  const rotational = 2 * EARTH_ANGULAR_VELOCITY * (velocityEast * Math.sin(latRad) - velocityNorth * Math.cos(latRad));
  return centrifugal + rotational;
}

// Fetch elevation from Open-Elevation API (free, no API key required)
export async function fetchElevation(lat, lng) {
  try {
    const response = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`);
    if (!response.ok) throw new Error('Failed to fetch elevation');
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      return data.results[0].elevation;
    }
    return 0;
  } catch (error) {
    console.error('Error fetching elevation:', error);
    return 0;
  }
}

// Fetch elevations for multiple points (batch query)
export async function fetchElevations(locations) {
  try {
    const locString = locations.map(([lat, lng]) => `${lat},${lng}`).join('|');
    const response = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${locString}`);
    if (!response.ok) throw new Error('Failed to fetch elevations');
    const data = await response.json();
    if (data.results) return data.results.map(r => r.elevation);
    return locations.map(() => 0);
  } catch (error) {
    console.error('Error fetching elevations:', error);
    return locations.map(() => 0);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// calculateTrajectory  — fixed physics integrator
//
// DRAG MODEL:  F_drag = dragCoeff * rhoLocal * |v_rel| / mass   (per-axis)
//   dragCoeff acts as a tunable linear damping factor.  The default 0.05 keeps
//   the deceleration reasonable across typical muzzle velocities (100-1500 m/s).
//   Using quadratic drag with the same coefficient produced deceleration orders
//   of magnitude too large (e.g. 7600 m/s^2 at v=500), causing the simulation
//   to flip vz negative in a single step and terminate immediately.
//
// LOOP  EXIT RULES (fixed):
//   • Never exit before the projectile has genuinely risen AND FALLEN back to
//     target elevation — tracked by the "peaked" flag.
//   • A hard minimum of MIN_FLIGHT_STEPS ensures at least 20 integration steps
//     before any early-exit can trigger, preventing 1-step degenerate results.
//   • Safety caps: t < 1200 s and trajectory < MAX_POINTS.
// ─────────────────────────────────────────────────────────────────────────────
export function calculateTrajectory(params) {
  const {
    startLat,
    startLng,
    velocity,            // m/s, muzzle velocity
    elevationAngle,      // degrees, 0-90 above horizontal
    azimuthAngle = 0,    // degrees, 0=North 90=East 180=South 270=West
    windSpeed = 0,       // m/s
    windDirection = 0,   // degrees (direction wind blows TOWARD)
    // gravity param accepted for UI parity but we use the physics model
    dragCoeff = 0.005,   // linear drag factor (tuned down from 0.05 for realism)
    mass = 1,            // kg
    startElevation = 0,  // metres ASL at launch
    targetElevation = 0, // metres ASL at target surface
    dt = 0.01,           // integration time-step (seconds) — keep small for Euler stability
    _fastMode = false,   // internal flag for fast iterative solvers
  } = params;

  // ── Input validation ──────────────────────────────────────────────────────
  if (
    isNaN(velocity) || isNaN(elevationAngle) ||
    velocity <= 0 || elevationAngle < 0 || elevationAngle > 90
  ) {
    throw new Error('Invalid: velocity must be > 0 and elevation angle must be 0–90°');
  }

  const elevationRad = elevationAngle * DEG_TO_RAD;
  const azimuthRad   = azimuthAngle   * DEG_TO_RAD;
  const latitudeRad  = startLat       * DEG_TO_RAD;

  // ── Initial velocity components (ENU: East-North-Up) ─────────────────────
  let vx = velocity * Math.cos(elevationRad) * Math.sin(azimuthRad); // East
  let vy = velocity * Math.cos(elevationRad) * Math.cos(azimuthRad); // North
  let vz = velocity * Math.sin(elevationRad);                         // Up

  // ── Wind velocity components ─────────────────────────────────────────────
  const windRad = windDirection * DEG_TO_RAD;
  const windVx  = windSpeed * Math.sin(windRad);
  const windVy  = windSpeed * Math.cos(windRad);

  let x = 0, y = 0, z = 0, t = 0;
  const trajectory = [
    { lat: startLat, lng: startLng, x: 0, y: 0, z: 0, altitude: startElevation },
  ];

  const MAX_POINTS = 20000; // hard cap — prevents browser freeze
  const MIN_FLIGHT_STEPS = 20; // always run at least this many steps

  // "peaked" means the projectile has passed its apex and is now descending
  let peaked = false;
  let stepCount = 0;

  // ── Main integration loop ─────────────────────────────────────────────────
  while (t < 1200 && trajectory.length < MAX_POINTS) {
    const absAlt  = Math.max(0, startElevation + z);
    const gLocal  = gravityAtAltitude(absAlt);
    const rhoLocal = airDensityAtAltitude(absAlt);

    // Velocity relative to air mass (accounts for wind)
    const vrx = vx - windVx;
    const vry = vy - windVy;
    const vrz = vz;
    const vRel = Math.sqrt(vrx * vrx + vry * vry + vrz * vrz);

    // Quadratic drag acceleration magnitude: a = dragCoeff * rho * v_rel^2 / mass
    // This is applied as: a_x = - (dragCoeff * rho * v_rel / mass) * v_rx
    let dragFactor = vRel > 0 ? (dragCoeff * rhoLocal * vRel) / mass : 0;
    
    // NATIVE PHYSICS FIX: Prevent Explicit Euler Instability
    // If deceleration is so high that it would reduce velocity past zero in one step,
    // the simulation will oscillate and explode exponentially.
    // Clamp the drag factor so it removes at most 95% of relative velocity per step.
    if (dragFactor * dt > 0.95) {
      dragFactor = 0.95 / dt;
    }

    // Coriolis:  2 * (omega x v) in ENU frame
    const coriolisAx =  2 * EARTH_ANGULAR_VELOCITY * (vy * Math.sin(latitudeRad) - vz * Math.cos(latitudeRad));
    const coriolisAy = -2 * EARTH_ANGULAR_VELOCITY *  vx * Math.sin(latitudeRad);
    const coriolisAz =  2 * EARTH_ANGULAR_VELOCITY *  vx * Math.cos(latitudeRad);

    // Eotvos effect on gravity
    const eotvos  = eotvosCorrection(startLat, vx, vy);
    const gTotal  = gLocal + eotvos;

    // Net acceleration
    const ax = -dragFactor * vrx + coriolisAx;
    const ay = -dragFactor * vry + coriolisAy;
    const az = -gTotal    - dragFactor * vrz + coriolisAz;

    // Euler integration
    vx += ax * dt;
    vy += ay * dt;
    vz += az * dt;

    x += vx * dt;
    y += vy * dt;
    z += vz * dt;
    t += dt;
    stepCount++;

    const currentAbsAlt = startElevation + z;
    const { lat, lng } = xyToLatLng(x, y, startLat, startLng);
    if (!_fastMode) {
      trajectory.push({ lat, lng, x, y, z, altitude: currentAbsAlt });
    }

    // Track apex after minimum steps
    if (stepCount >= MIN_FLIGHT_STEPS && !peaked && vz < 0) {
      peaked = true;
    }

    // For non-zero elevation angle: stop once past apex and back at target surface
    if (elevationAngle > 0 && peaked && currentAbsAlt <= targetElevation) break;

    // For flat / downward shots: stop when the projectile goes below target surface
    // but only after giving it a minimum run
    if (elevationAngle === 0 && stepCount >= MIN_FLIGHT_STEPS && currentAbsAlt < targetElevation) break;

    // Emergency bail-out if projectile buries deeply underground
    if (currentAbsAlt < targetElevation - 5000) break;
  }

  // ── Guard: always need at least 2 points ─────────────────────────────────
  if (!_fastMode && trajectory.length < 2) {
    trajectory.push({ ...trajectory[0], z: -0.1, altitude: startElevation - 0.1 });
  }

  const impactPoint = _fastMode 
    ? { lat: xyToLatLng(x,y,startLat,startLng).lat, lng: xyToLatLng(x,y,startLat,startLng).lng, x, y, z, t, altitude: startElevation + z }
    : trajectory[trajectory.length - 1];

  if (_fastMode) {
    return { 
      impactPoint, 
      analysis: { groundDistance: haversineDistance({lat: startLat, lng: startLng}, impactPoint).toFixed(2) } 
    };
  }

  const impactIndex = trajectory.length - 1;

  // ── Analysis metrics ─────────────────────────────────────────────────────
  const timeOfFlight = t;
  const groundDistance = haversineDistance(
    { lat: startLat, lng: startLng },
    { lat: impactPoint.lat, lng: impactPoint.lng }
  );
  const horizontalDistance = Math.sqrt(trajectory[impactIndex].x ** 2 + trajectory[impactIndex].y ** 2);

  let maxAltitude = startElevation;
  trajectory.forEach(pt => {
    if (startElevation + pt.z > maxAltitude) maxAltitude = startElevation + pt.z;
  });

  const coriolisDeflection = calculateCoriolisDeflection(trajectory, azimuthAngle);

  let impactVelocity = 0;
  if (impactIndex > 0) {
    const last = trajectory[impactIndex];
    const prev = trajectory[impactIndex - 1];
    const dx = last.x - prev.x;
    const dy = last.y - prev.y;
    const dz = last.z - prev.z;
    impactVelocity = Math.sqrt(dx * dx + dy * dy + dz * dz) / dt;
  }

  let totalDistance = 0;
  for (let i = 1; i < trajectory.length; i++) {
    const dx = trajectory[i].x - trajectory[i - 1].x;
    const dy = trajectory[i].y - trajectory[i - 1].y;
    const dz = trajectory[i].z - trajectory[i - 1].z;
    totalDistance += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  const analysis = {
    timeOfFlight: timeOfFlight.toFixed(2),
    groundDistance: groundDistance.toFixed(2),
    horizontalDistance: horizontalDistance.toFixed(2),
    maxAltitude: maxAltitude.toFixed(2),
    coriolisDeflection: coriolisDeflection.toFixed(2),
    impactVelocity: impactVelocity.toFixed(2),
    totalDistance: totalDistance.toFixed(2),
    impactAngle: (
      impactIndex > 0
        ? calculateImpactAngle(trajectory[impactIndex - 1], trajectory[impactIndex])
        : 0
    ).toFixed(2),
  };

  return { trajectory, impactPoint, analysis };
}

// Haversine great-circle distance
function haversineDistance(pos1, pos2) {
  const R = 6371000;
  const lat1 = pos1.lat * DEG_TO_RAD;
  const lat2 = pos2.lat * DEG_TO_RAD;
  const dLat = (pos2.lat - pos1.lat) * DEG_TO_RAD;
  const dLng = (pos2.lng - pos1.lng) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Lateral Coriolis deflection estimate (perpendicular to intended azimuth)
function calculateCoriolisDeflection(trajectory, azimuthAngle) {
  if (trajectory.length < 2) return 0;
  const last  = trajectory[trajectory.length - 1];
  const first = trajectory[0];
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const azRad = azimuthAngle * DEG_TO_RAD;
  const along = dx * Math.sin(azRad) + dy * Math.cos(azRad);
  const total = Math.sqrt(dx * dx + dy * dy);
  const perpSq = Math.max(0, total * total - along * along);
  return Math.sqrt(perpSq);
}

// Impact angle in degrees below horizontal
function calculateImpactAngle(prevPoint, impactPoint) {
  const dx = impactPoint.x - prevPoint.x;
  const dy = impactPoint.y - prevPoint.y;
  const dz = impactPoint.z - prevPoint.z;
  const hDist = Math.sqrt(dx * dx + dy * dy);
  if (hDist === 0) return 90;
  return Math.atan2(Math.abs(dz), hDist) * RAD_TO_DEG;
}

// Legacy wrapper
export function calculateLandingPoint(params) {
  return calculateTrajectory(params).impactPoint;
}

export function convertUnits(value, fromUnit, toUnit) {
  return value;
}

// Calculate geographic bearing from one lat/lng to another
export function calculateBearing(lat1, lng1, lat2, lng2) {
  const phi1 = lat1 * DEG_TO_RAD;
  const phi2 = lat2 * DEG_TO_RAD;
  const dLambda = (lng2 - lng1) * DEG_TO_RAD;
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  const brng = Math.atan2(y, x) * RAD_TO_DEG;
  return (brng + 360) % 360;
}

// ─────────────────────────────────────────────────────────────────────────────
// calculateTargetingSolution  — Inverse Kinematics solver
// ─────────────────────────────────────────────────────────────────────────────
export function calculateTargetingSolution(params, targetLatLng, solveFor = 'elevationLow') {
  const startPos = { lat: params.startLat, lng: params.startLng };
  const targetRange = haversineDistance(startPos, targetLatLng);
  const baseAzimuth = calculateBearing(startPos.lat, startPos.lng, targetLatLng.lat, targetLatLng.lng);
  
  // Create a copy of params with fastMode enabled for iterative solver
  const baseParams = { ...params, _fastMode: true };

  // Helper: Bisection search for Elevation Angle given fixed Azimuth
  const solveElevation = (azimuth, minAngle, maxAngle, isHighAngle) => {
    let low = minAngle, high = maxAngle;
    let lastError = Infinity;
    let bestAngle = -1;
    for (let i = 0; i < 20; i++) {
      let mid = (low + high) / 2;
      const res = calculateTrajectory({ ...baseParams, elevationAngle: mid, azimuthAngle: azimuth });
      const r = parseFloat(res.analysis.groundDistance);
      const rError = r - targetRange;
      
      if (Math.abs(rError) < Math.abs(lastError)) { 
        lastError = rError; 
        bestAngle = mid; 
      }
      
      if (isHighAngle) {
          // For high angle (>45), aiming higher decreases range.
          if (r < targetRange) high = mid; else low = mid;
      } else {
          // For low angle (<45), aiming higher increases range.
          if (r < targetRange) low = mid; else high = mid;
      }
    }
    return { angle: bestAngle, rangeError: lastError };
  };

  // Helper: Bisection search for Velocity given fixed Elevation Angle
  const solveVelocity = (azimuth, fixedAngle) => {
    let low = 0, high = 4000;
    let lastError = Infinity;
    let bestV = -1;
    for (let i = 0; i < 25; i++) {
      let mid = (low + high) / 2;
      const res = calculateTrajectory({ ...baseParams, velocity: mid, elevationAngle: fixedAngle, azimuthAngle: azimuth });
      const r = parseFloat(res.analysis.groundDistance);
      const rError = r - targetRange;
      
      if (Math.abs(rError) < Math.abs(lastError)) { 
        lastError = rError; 
        bestV = mid; 
      }
      if (r < targetRange) low = mid; else high = mid;
    }
    return { velocity: bestV, rangeError: lastError };
  };

  // Run the solver iteratively to correct for Coriolis & Wind cross-range drift
  let currentAzimuth = baseAzimuth;
  let finalPrimaryVar = -1;
  let finalError = Infinity;

  const isHighAngle = solveFor === 'elevationHigh';
  const solveForVel = solveFor === 'velocity';

  for (let iter = 0; iter < 4; iter++) {
    let opt;
    if (solveForVel) {
      opt = solveVelocity(currentAzimuth, params.elevationAngle);
      finalPrimaryVar = opt.velocity;
    } else {
      opt = solveElevation(currentAzimuth, isHighAngle ? 45 : 0, isHighAngle ? 90 : 45, isHighAngle);
      finalPrimaryVar = opt.angle;
    }
    
    finalError = opt.rangeError;

    // Simulate one more time to check azimuth drift
    const testParams = solveForVel 
      ? { ...baseParams, velocity: finalPrimaryVar, elevationAngle: params.elevationAngle, azimuthAngle: currentAzimuth }
      : { ...baseParams, elevationAngle: finalPrimaryVar, azimuthAngle: currentAzimuth };
      
    const sim = calculateTrajectory(testParams);
    const simBearing = calculateBearing(startPos.lat, startPos.lng, sim.impactPoint.lat, sim.impactPoint.lng);
    
    let angularError = targetRange === 0 ? 0 : (baseAzimuth - simBearing);
    if (angularError > 180) angularError -= 360;
    if (angularError < -180) angularError += 360;
    
    currentAzimuth = (currentAzimuth + angularError + 360) % 360;
    if (Math.abs(angularError) < 0.001) break;
  }

  // Return the configured parameters to the UI
  return {
    ...params,
    azimuthAngle: parseFloat(currentAzimuth.toFixed(4)),
    elevationAngle: solveForVel ? params.elevationAngle : parseFloat(finalPrimaryVar.toFixed(4)),
    velocity: solveForVel ? parseFloat(finalPrimaryVar.toFixed(2)) : params.velocity,
    targetRange: parseFloat(targetRange.toFixed(2)),
    rangeError: parseFloat(finalError.toFixed(2))
  };
}
