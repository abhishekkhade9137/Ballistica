// Advanced ballistics calculation utilities with 3D Vectors, ISA Thermodynamics, Wind, Coriolis, & Spin Dynamics

// Constants
export const EARTH_RADIUS = 6371000; // meters (mean radius)
export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;
export const EARTH_ANGULAR_VELOCITY = 7.292115e-5; // rad/s
export const GRAVITY_SEA_LEVEL = 9.80665; // m/s^2 at sea level
export const ATMOSPHERIC_SCALE_HEIGHT = 8500; // meters

// ISA Thermodynamic Model Constants
export const ISA_CONSTANTS = {
  T0: 288.15, // K (15°C baseline sea-level)
  P0: 101325, // Pa (1013.25 hPa standard sea-level)
  L: 0.0065,  // K/m lapse rate in troposphere (up to 11km)
  R_DRY: 287.058, // J/(kg·K) gas constant for dry air
  R_VAP: 461.495, // J/(kg·K) gas constant for water vapor
  GAMMA: 1.4, // Adiabatic index for air
  MOLAR_MASS_AIR: 0.0289644, // kg/mol
  UNIVERSAL_GAS: 8.31446, // J/(mol·K)
};

// Convert lat/lng to cartesian displacement from reference point
export function latLngToXY(lat, lng, refLat, refLng) {
  const dLat = (lat - refLat) * DEG_TO_RAD;
  const dLng = (lng - refLng) * DEG_TO_RAD;
  const x = EARTH_RADIUS * dLng * Math.cos(refLat * DEG_TO_RAD);
  const y = EARTH_RADIUS * dLat;
  return { x, y };
}

// Convert cartesian displacement back to lat/lng
export function xyToLatLng(x, y, refLat, refLng) {
  const dLat = y / EARTH_RADIUS;
  const dLng = x / (EARTH_RADIUS * Math.cos(refLat * DEG_TO_RAD));
  const lat = refLat + dLat * RAD_TO_DEG;
  const lng = refLng + dLng * RAD_TO_DEG;
  return { lat, lng };
}

// Gravity decreases with altitude: g(h) = g0 * (R/(R+h))^2
export function gravityAtAltitude(altitude) {
  return GRAVITY_SEA_LEVEL * Math.pow(EARTH_RADIUS / (EARTH_RADIUS + Math.max(0, altitude)), 2);
}

// Full ISA Atmospheric Thermodynamic State Resolver
export function getAtmosphericState(altitude, groundTempC = 15, groundPressureHpa = 1013.25, relHumidityPct = 50) {
  const alt = Math.max(0, altitude);
  const tGround = (Number(groundTempC) || 15) + 273.15;
  const pGround = (Number(groundPressureHpa) || 1013.25) * 100;
  const rh = Math.max(0, Math.min(100, Number(relHumidityPct) || 50));

  // Temperature with tropospheric lapse rate (up to 11km)
  let T = tGround - ISA_CONSTANTS.L * Math.min(11000, alt);
  if (alt > 11000) {
    T = tGround - ISA_CONSTANTS.L * 11000; // Tropopause isothermal layer
  }
  T = Math.max(180, T);

  // Surface reference density adjusted for temperature & pressure
  const rho0 = pGround / (ISA_CONSTANTS.R_DRY * tGround);
  const density = rho0 * Math.exp(-alt / ATMOSPHERIC_SCALE_HEIGHT);

  // Pressure variation with altitude
  const P = pGround * Math.exp(-alt / ATMOSPHERIC_SCALE_HEIGHT);

  // Speed of sound: a = sqrt(gamma * R_dry * T)
  const speedOfSound = Math.sqrt(ISA_CONSTANTS.GAMMA * ISA_CONSTANTS.R_DRY * T);

  return {
    temperatureK: T,
    temperatureC: T - 273.15,
    pressurePa: P,
    pressureHpa: P / 100,
    density,
    speedOfSound,
    relativeHumidity: rh,
  };
}

// Atmospheric density as function of altitude (ISA model)
export function airDensityAtAltitude(altitude, groundTempC = 15, groundPressureHpa = 1013.25, relHumidityPct = 50) {
  const state = getAtmosphericState(altitude, groundTempC, groundPressureHpa, relHumidityPct);
  return state.density;
}

// Mach-dependent wave drag multiplier normalized to nominal supersonic cruise (M ~ 2.4)
export function getMachDragMultiplier(mach) {
  const m = Math.max(0, mach);
  if (m < 0.8) {
    return 0.75; // Subsonic laminar flow lower drag
  }
  if (m <= 1.2) {
    // Transonic shock wave rise
    const t = (m - 0.8) / (1.2 - 0.8);
    return 0.75 + 0.40 * Math.sin(t * Math.PI);
  }
  // Supersonic regime tapering smoothly to 1.0 at cruise speeds
  return 1.0 + 0.15 * Math.exp(-1.5 * (m - 1.2));
}

// 3D Altitude Wind Vector with Atmospheric Wind Shear (Hellmann Power Law)
export function getWindVectorAtAltitude(altitude, groundElevation, surfaceWindSpeed, surfaceWindDirection) {
  const ws = Math.max(0, Number(surfaceWindSpeed) || 0);
  if (ws === 0) {
    return { wx: 0, wy: 0, wz: 0, speed: 0 };
  }

  const hRel = Math.max(2, (altitude || 0) - (groundElevation || 0));
  // Power-law exponent: 0.16 (standard mountain terrain atmospheric boundary layer)
  const shearFactor = Math.min(2.5, Math.max(0.7, Math.pow(hRel / 10, 0.16)));
  const localSpeed = ws * shearFactor;

  // Wind direction theta_w is meteorological direction from which wind blows
  // The velocity vector blows toward theta_w + 180°
  const dirRad = (Number(surfaceWindDirection) || 0) * DEG_TO_RAD;
  const wx = -localSpeed * Math.sin(dirRad); // East
  const wy = -localSpeed * Math.cos(dirRad); // North
  const wz = 0;

  return { wx, wy, wz, speed: localSpeed };
}

// Angular Momentum, Spin Drift (Yaw of Repose) & Magnus Effect
export function calculateSpinDynamics({
  velocity,
  barrelTwist = 3.0,
  time,
  rhoLocal,
  rhoSeaLevel = 1.225,
  vx,
  vy,
  vz,
  vrx,
  vry,
  vrz,
  mass,
  calibre = 0.155,
  gLocal,
}) {
  if (!barrelTwist || barrelTwist <= 0) {
    // Smoothbore ordnance (e.g. Mortar): no rifling spin drift or spin-induced Magnus
    return { axSpin: 0, aySpin: 0, azSpin: 0, omega: 0 };
  }

  // Initial axial spin rate (rad/s)
  const omega0 = (2 * Math.PI * velocity) / barrelTwist;
  // Spin decay over flight time due to aerodynamic friction
  const spinDecayRate = 0.012 * (rhoLocal / rhoSeaLevel);
  const omega = omega0 * Math.exp(-spinDecayRate * Math.max(0, time));

  const vh = Math.sqrt(vx * vx + vy * vy);
  let axDrift = 0;
  let ayDrift = 0;

  if (vh > 1) {
    // Yaw of repose rightward gyroscopic drift (NATO STANAG 4-DoF empirical formula)
    // Precession pushes nose to the right relative to horizontal velocity vector
    const kDrift = 0.0011;
    const aDriftMag = kDrift * (rhoLocal / rhoSeaLevel) * (gLocal / vh) * (omega / omega0);

    // Unit vector pointing horizontally to the right of travel: (vy/vh, -vx/vh)
    axDrift = aDriftMag * (vy / vh);
    ayDrift = -aDriftMag * (vx / vh);
  }

  // Magnus crosswind lift acceleration: F_mag = 0.5 * rho * C_mag * A * d * (omega x v_rel)
  let axMag = 0, ayMag = 0, azMag = 0;
  const vTotal = Math.sqrt(vx * vx + vy * vy + vz * vz);
  if (vTotal > 1 && mass > 0) {
    const area = Math.PI * Math.pow(calibre / 2, 2);
    // Unit vector along projectile axial centerline
    const sx = vx / vTotal;
    const sy = vy / vTotal;
    const sz = vz / vTotal;

    const omx = omega * sx;
    const omy = omega * sy;
    const omz = omega * sz;

    // Cross product: omega x v_rel
    const crossX = omy * vrz - omz * vry;
    const crossY = omz * vrx - omx * vrz;
    const crossZ = omx * vry - omy * vrx;

    const cMag = 0.0035;
    const magScale = (0.5 * rhoLocal * cMag * area * calibre) / mass;

    axMag = magScale * crossX;
    ayMag = magScale * crossY;
    azMag = magScale * crossZ;
  }

  return {
    axSpin: axDrift + axMag,
    aySpin: ayDrift + ayMag,
    azSpin: azMag,
    omega,
  };
}

// Fetch elevation using Open-Meteo high-resolution DEM API with geographical heuristic fallback
export async function fetchElevation(lat, lng) {
  let fallbackElev = 210;
  if (lat > 33 && lng > 74) fallbackElev = 3500; // High Altitude / Mountain terrain (Kargil / Ladakh / J&K)
  else if (lat > 29 && lat <= 33 && lng > 73 && lng < 77) fallbackElev = 215; // Northern plains
  else if (lat > 25 && lat <= 29 && lng > 70 && lng < 74) fallbackElev = 225; // Arid / Desert sector

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const response = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) return fallbackElev;
    const data = await response.json();
    if (data.elevation && Array.isArray(data.elevation) && data.elevation.length > 0) {
      return Math.round(data.elevation[0]);
    }
    return fallbackElev;
  } catch {
    return fallbackElev;
  }
}

// Fetch elevations for multiple coordinates in batch using Open-Meteo
export async function fetchElevations(locations) {
  if (!locations || locations.length === 0) return [];
  try {
    const lats = locations.map(([lat]) => lat).join(',');
    const lngs = locations.map(([, lng]) => lng).join(',');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) return locations.map(() => 0);
    const data = await response.json();
    if (data.elevation && Array.isArray(data.elevation)) {
      return data.elevation.map(e => (typeof e === 'number' ? Math.round(e) : 0));
    }
    return locations.map(() => 0);
  } catch {
    return locations.map(() => 0);
  }
}

// Generate N discrete coordinates along the line of flight between start and target
export function generatePathCoordinates(start, target, count = 15) {
  if (!start?.lat || !target?.lat) return [];
  const points = [];
  const totalDist = haversineDistance(start, target);
  for (let i = 0; i < count; i++) {
    const fraction = count <= 1 ? 0 : i / (count - 1);
    const lat = start.lat + fraction * (target.lat - start.lat);
    const lng = start.lng + fraction * (target.lng - start.lng);
    const distance = fraction * totalDist;
    points.push({
      lat: parseFloat(lat.toFixed(5)),
      lng: parseFloat(lng.toFixed(5)),
      distance: parseFloat(distance.toFixed(1)),
      fraction: parseFloat(fraction.toFixed(4)),
    });
  }
  return points;
}

// Sample continuous intermediate terrain elevations along the full flight path (with distance-adaptive sampling)
export async function fetchTerrainPath(start, target, count = null) {
  if (!start?.lat || !target?.lat) return [];
  const totalDist = haversineDistance(start, target);
  // Distance-adaptive resolution: sample ~every 350m to avoid crest aliasing (bounded between 15 and 60 points)
  const sampleCount = count || Math.min(60, Math.max(15, Math.round(totalDist / 350)));
  const pathPoints = generatePathCoordinates(start, target, sampleCount);
  const locations = pathPoints.map(p => [p.lat, p.lng]);

  try {
    const elevations = await fetchElevations(locations);
    const hasValidElevs = elevations && elevations.some(e => e > 0);

    if (hasValidElevs) {
      return pathPoints.map((p, idx) => ({
        distance: p.distance,
        elevation: Math.round(elevations[idx] || 0),
        lat: p.lat,
        lng: p.lng,
      }));
    }
  } catch {
    // proceed to geographic fallback
  }

  // Fallback: estimate elevations based on sector and endpoints
  const startAlt = await fetchElevation(start.lat, start.lng);
  const targetAlt = await fetchElevation(target.lat, target.lng);

  return pathPoints.map(p => ({
    distance: p.distance,
    elevation: Math.round(startAlt + p.fraction * (targetAlt - startAlt)),
    lat: p.lat,
    lng: p.lng,
  }));
}

// Automatic intermediate terrain elevation lookup along the flight path
export function getTerrainElevation(dist, totalRange, startElevation, targetElevation, terrainProfile) {
  if (terrainProfile && terrainProfile.length > 1) {
    for (let i = 0; i < terrainProfile.length - 1; i++) {
      if (dist >= terrainProfile[i].distance && dist <= terrainProfile[i + 1].distance) {
        const span = terrainProfile[i + 1].distance - terrainProfile[i].distance;
        if (span === 0) return terrainProfile[i].elevation;
        const ratio = (dist - terrainProfile[i].distance) / span;
        return terrainProfile[i].elevation + ratio * (terrainProfile[i + 1].elevation - terrainProfile[i].elevation);
      }
    }
    if (dist > terrainProfile[terrainProfile.length - 1].distance) {
      return terrainProfile[terrainProfile.length - 1].elevation;
    }
    return terrainProfile[0].elevation;
  }

  const progress = totalRange > 0 ? Math.min(1.5, Math.max(0, dist / totalRange)) : 0;
  return startElevation + Math.min(1, progress) * (targetElevation - startElevation);
}

// ─────────────────────────────────────────────────────────────────────────────
// calculateTrajectory — with 3D Vectors, ISA Thermodynamics, Wind, Coriolis & Spin
// ─────────────────────────────────────────────────────────────────────────────
export function calculateTrajectory(params) {
  const {
    startLat,
    startLng,
    velocity,
    elevationAngle,
    azimuthAngle = 0,
    windSpeed = 0,
    windDirection = 0,
    dragCoeff = 0.005,
    mass = 1,
    startElevation = 0,
    targetElevation = 0,
    dt = 0.01,
    _fastMode = false,
    targetLatLng = null,
    groundTempC = 15,
    groundPressureHpa = 1013.25,
    relHumidityPct = 50,
    barrelTwist = 3.0,
    calibre = 0.155,
  } = params;

  if (
    isNaN(velocity) || isNaN(elevationAngle) ||
    velocity <= 0 || elevationAngle < 0 || elevationAngle > 90
  ) {
    throw new Error('Invalid: velocity must be > 0 and elevation angle must be 0–90°');
  }

  const elevationRad = elevationAngle * DEG_TO_RAD;
  const azimuthRad   = azimuthAngle   * DEG_TO_RAD;

  let vx = velocity * Math.cos(elevationRad) * Math.sin(azimuthRad); // East
  let vy = velocity * Math.cos(elevationRad) * Math.cos(azimuthRad); // North
  let vz = velocity * Math.sin(elevationRad);                         // Up

  let x = 0, y = 0, z = 0, t = 0;
  const trajectory = [
    { lat: startLat, lng: startLng, x: 0, y: 0, z: 0, altitude: startElevation, terrainAltitude: startElevation },
  ];

  const estimatedTotalRange = targetLatLng 
    ? haversineDistance({ lat: startLat, lng: startLng }, targetLatLng)
    : (params.targetRange || (params.terrainProfile && params.terrainProfile.length > 0 ? params.terrainProfile[params.terrainProfile.length - 1].distance : 0) || Math.max(1000, (velocity * velocity * Math.sin(2 * (elevationRad || 0.1)) / 9.81) || 5000));

  const MAX_POINTS = 20000;
  const MIN_FLIGHT_STEPS = 20;

  let peaked = false;
  let stepCount = 0;
  let collision = null;
  let minCrestClearance = Infinity;
  let crestCheckPoints = 0;
  let maxMach = 0;

  while (t < 1200 && trajectory.length < MAX_POINTS) {
    const currentGroundDist = Math.sqrt(x * x + y * y);
    const absAlt  = Math.max(0, startElevation + z);
    const gLocal  = gravityAtAltitude(absAlt);

    // 1. ISA Atmospheric Thermodynamic State
    const atm = getAtmosphericState(absAlt, groundTempC, groundPressureHpa, relHumidityPct);
    const rhoLocal = atm.density;
    const speedOfSound = atm.speedOfSound;

    // 2. 3D Wind with Altitude Wind Shear
    const wind = getWindVectorAtAltitude(absAlt, startElevation, windSpeed, windDirection);
    const vrx = vx - wind.wx;
    const vry = vy - wind.wy;
    const vrz = vz - wind.wz;
    const vRel = Math.sqrt(vrx * vrx + vry * vry + vrz * vrz);

    // 3. Mach Number & Transonic Wave Drag Multiplier (if enabled in params or weapon spec)
    const mach = speedOfSound > 0 ? vRel / speedOfSound : 1.0;
    if (mach > maxMach) maxMach = mach;
    const machMultiplier = (params.machDrag || params.useMachDrag) ? getMachDragMultiplier(mach) : 1.0;

    let dragFactor = vRel > 0 ? (dragCoeff * machMultiplier * rhoLocal * vRel) / mass : 0;
    if (dragFactor * dt > 0.95) {
      dragFactor = 0.95 / dt;
    }

    // 4. Earth's Rotation (Planetary Dynamics: Coriolis & Eötvös)
    const latRad = (startLat + (y / EARTH_RADIUS) * RAD_TO_DEG) * DEG_TO_RAD;
    const coriolisAx =  2 * EARTH_ANGULAR_VELOCITY * (vy * Math.sin(latRad) - vz * Math.cos(latRad));
    const coriolisAy = -2 * EARTH_ANGULAR_VELOCITY *  vx * Math.sin(latRad);
    const coriolisAz =  2 * EARTH_ANGULAR_VELOCITY *  vx * Math.cos(latRad); // Direct Eötvös effect

    // 5. Angular Momentum, Spin Drift (Yaw of Repose) & Magnus Lift
    const spin = calculateSpinDynamics({
      velocity,
      barrelTwist,
      time: t,
      rhoLocal,
      rhoSeaLevel: 1.225,
      vx,
      vy,
      vz,
      vrx,
      vry,
      vrz,
      mass,
      calibre,
      gLocal,
    });

    // Sum of forces per unit mass (accelerations)
    const ax = -dragFactor * vrx + coriolisAx + spin.axSpin;
    const ay = -dragFactor * vry + coriolisAy + spin.aySpin;
    const az = -gLocal - dragFactor * vrz + coriolisAz + spin.azSpin;

    // Get terrain elevation at this exact horizontal distance
    const terrainAlt = getTerrainElevation(
      currentGroundDist,
      estimatedTotalRange,
      startElevation,
      targetElevation,
      params.terrainProfile
    );

    // Track crest clearance after clearing launch point (> 50m)
    // Terminal buffer prevents final target touchdown from falsely triggering en-route crest collision
    const terminalBuffer = Math.min(250, Math.max(100, estimatedTotalRange * 0.035));
    const isEnRoute = currentGroundDist > 50 && currentGroundDist < (estimatedTotalRange - terminalBuffer);

    if (currentGroundDist > 50) {
      const clearance = absAlt - terrainAlt;
      if (clearance < minCrestClearance) {
        minCrestClearance = clearance;
      }
      crestCheckPoints++;

      // Terrain / Mountain collision check along flight corridor
      if (isEnRoute && absAlt <= terrainAlt) {
        const { lat, lng } = xyToLatLng(x, y, startLat, startLng);
        collision = {
          occurred: true,
          distance: parseFloat(currentGroundDist.toFixed(2)),
          obstacleElevation: parseFloat(terrainAlt.toFixed(2)),
          projectileAltitude: parseFloat(absAlt.toFixed(2)),
          lat: parseFloat(lat.toFixed(4)),
          lng: parseFloat(lng.toFixed(4)),
          message: `TRAJECTORY INTERRUPTED: Projectile collided with mountain ridge at ${(currentGroundDist / 1000).toFixed(2)} km (Ground: ${terrainAlt.toFixed(0)}m ASL). Crest clearance failed!`,
        };
        if (!_fastMode) {
          trajectory.push({ lat, lng, x, y, z, altitude: terrainAlt, terrainAltitude: terrainAlt, isCollision: true });
        }
        break; // Flight abruptly terminates upon hitting mountain!
      }

      // Terminal touchdown: projectile impacts ground at the target objective
      if (currentGroundDist >= (estimatedTotalRange - terminalBuffer) && absAlt <= terrainAlt) {
        break;
      }
    }

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
      trajectory.push({ lat, lng, x, y, z, altitude: currentAbsAlt, terrainAltitude: terrainAlt });
    }

    if (stepCount >= MIN_FLIGHT_STEPS && !peaked && vz < 0) {
      peaked = true;
    }

    // Direct fire uphill impact: shell reaches target ground elevation at target range
    if (targetElevation > startElevation && currentGroundDist >= estimatedTotalRange && currentAbsAlt <= targetElevation + 10) {
      break;
    }

    // Stop once past apex and descending to target surface elevation
    if (elevationAngle > 0 && peaked && currentAbsAlt <= targetElevation) break;

    // For flat shots
    if (elevationAngle === 0 && stepCount >= MIN_FLIGHT_STEPS && currentAbsAlt < targetElevation) break;

    if (currentAbsAlt < targetElevation - 5000) break;
  }

  if (!_fastMode && trajectory.length < 2) {
    trajectory.push({ ...trajectory[0], z: -0.1, altitude: startElevation - 0.1, terrainAltitude: startElevation });
  }

  const impactPoint = _fastMode 
    ? { lat: xyToLatLng(x,y,startLat,startLng).lat, lng: xyToLatLng(x,y,startLat,startLng).lng, x, y, z, t, altitude: startElevation + z }
    : trajectory[trajectory.length - 1];

  const totalGroundDist = haversineDistance(
    { lat: startLat, lng: startLng },
    { lat: impactPoint.lat, lng: impactPoint.lng }
  );

  if (_fastMode) {
    return { 
      impactPoint, 
      collision,
      analysis: { groundDistance: totalGroundDist.toFixed(2) } 
    };
  }

  const impactIndex = trajectory.length - 1;
  const timeOfFlight = t;
  const horizontalDistance = Math.sqrt(trajectory[impactIndex].x ** 2 + trajectory[impactIndex].y ** 2);

  let maxAltitude = startElevation;
  trajectory.forEach(pt => {
    if (startElevation + pt.z > maxAltitude) maxAltitude = startElevation + pt.z;
  });

  const coriolisDeflection = calculateCoriolisDeflection(trajectory, azimuthAngle);

  // Cross-track lateral drift calculation relative to initial bore azimuth
  const alongTrack = x * Math.sin(azimuthRad) + y * Math.cos(azimuthRad);
  const crossTrack = x * Math.cos(azimuthRad) - y * Math.sin(azimuthRad); // + = Right, - = Left
  const deflectionMils = alongTrack > 0 ? (crossTrack / alongTrack) * 1018.6 : 0;

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

  // Generate continuous terrain profile along the line of flight for rendering
  const terrainProfile = [];
  const profileSteps = 100;
  for (let i = 0; i <= profileSteps; i++) {
    const dist = (i / profileSteps) * totalGroundDist;
    const elev = getTerrainElevation(
      dist,
      estimatedTotalRange,
      startElevation,
      targetElevation,
      params.terrainProfile
    );
    terrainProfile.push({ distance: dist, elevation: elev });
  }

  const analysis = {
    timeOfFlight: timeOfFlight.toFixed(2),
    groundDistance: totalGroundDist.toFixed(2),
    horizontalDistance: horizontalDistance.toFixed(2),
    maxAltitude: maxAltitude.toFixed(2),
    coriolisDeflection: Math.abs(coriolisDeflection).toFixed(2),
    netLateralDeflection: crossTrack.toFixed(2),
    deflectionMils: deflectionMils.toFixed(1),
    maxMach: maxMach.toFixed(2),
    speedOfSound: (getAtmosphericState(startElevation, groundTempC, groundPressureHpa, relHumidityPct).speedOfSound).toFixed(1),
    impactVelocity: impactVelocity.toFixed(2),
    totalDistance: totalDistance.toFixed(2),
    minCrestClearance: crestCheckPoints > 0 ? (collision ? 0 : minCrestClearance).toFixed(1) : 'N/A',
    crestStatus: collision ? 'COLLISION DETECTED' : 'CLEAR',
    impactAngle: (
      impactIndex > 0
        ? calculateImpactAngle(trajectory[impactIndex - 1], trajectory[impactIndex])
        : 0
    ).toFixed(2),
  };

  return { trajectory, impactPoint, analysis, collision, terrainProfile };
}

// Haversine great-circle distance
export function haversineDistance(pos1, pos2) {
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

// Lateral Coriolis deflection estimate
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

// Calculate geographic bearing
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
// calculateTargetingSolution — Inverse Solver with Terrain Masking Check
// ─────────────────────────────────────────────────────────────────────────────
export function calculateTargetingSolution(params, targetLatLng, solveFor = 'elevationLow') {
  const startPos = { lat: params.startLat, lng: params.startLng };
  const targetRange = haversineDistance(startPos, targetLatLng);
  const baseAzimuth = calculateBearing(startPos.lat, startPos.lng, targetLatLng.lat, targetLatLng.lng);
  
  const baseParams = { ...params, _fastMode: true, targetLatLng };

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
        if (r < targetRange) high = mid; else low = mid;
      } else {
        if (r < targetRange) low = mid; else high = mid;
      }
    }
    return { angle: bestAngle, rangeError: lastError };
  };

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

  let currentAzimuth = baseAzimuth;
  let finalPrimaryVar = -1;
  let finalError = Infinity;

  let isHighAngle = solveFor === 'elevationHigh';
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

  // Terrain Clearance Verification on Discovered Solution
  const verifyParams = {
    ...params,
    elevationAngle: solveForVel ? params.elevationAngle : finalPrimaryVar,
    azimuthAngle: currentAzimuth,
    velocity: solveForVel ? finalPrimaryVar : params.velocity,
    targetLatLng,
    _fastMode: false,
  };
  const testSim = calculateTrajectory(verifyParams);
  const collision = testSim.collision || null;

  const azimuthCorrection = currentAzimuth - baseAzimuth;
  let normalizedCorrection = azimuthCorrection;
  if (normalizedCorrection > 180) normalizedCorrection -= 360;
  if (normalizedCorrection < -180) normalizedCorrection += 360;
  const deflectionMils = (normalizedCorrection * (6400 / 360));

  return {
    ...params,
    azimuthAngle: parseFloat(currentAzimuth.toFixed(4)),
    baseAzimuth: parseFloat(baseAzimuth.toFixed(4)),
    deflectionAngle: parseFloat(normalizedCorrection.toFixed(3)),
    deflectionMils: parseFloat(deflectionMils.toFixed(1)),
    elevationAngle: solveForVel ? params.elevationAngle : parseFloat(finalPrimaryVar.toFixed(4)),
    velocity: solveForVel ? parseFloat(finalPrimaryVar.toFixed(2)) : params.velocity,
    targetRange: parseFloat(targetRange.toFixed(2)),
    rangeError: parseFloat(finalError.toFixed(2)),
    solveFor,
    collision,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// calculateAllTargetingSolutions — Finds valid, achievable ways to hit target
// ─────────────────────────────────────────────────────────────────────────────
export function calculateAllTargetingSolutions(params, targetLatLng) {
  const startPos = { lat: params.startLat, lng: params.startLng };
  const targetRange = haversineDistance(startPos, targetLatLng);
  const terrainProfile = params.terrainProfile || null;

  // 1. Solve Direct Fire (Low Angle, < 45 deg)
  let directSol = null;
  let directTraj = null;
  try {
    directSol = calculateTargetingSolution({ ...params, terrainProfile }, targetLatLng, 'elevationLow');
    directTraj = calculateTrajectory({ ...directSol, targetLatLng, terrainProfile, _fastMode: false });
    directTraj.inverseConfig = directSol;
    directTraj.params = directSol;
  } catch (err) {
    console.error('Direct fire solver error:', err);
  }

  // 2. Solve High-Arc Plunging Fire (High Angle, > 45 deg)
  let highArcSol = null;
  let highArcTraj = null;
  try {
    highArcSol = calculateTargetingSolution({ ...params, terrainProfile }, targetLatLng, 'elevationHigh');
    highArcTraj = calculateTrajectory({ ...highArcSol, targetLatLng, terrainProfile, _fastMode: false });
    highArcTraj.inverseConfig = highArcSol;
    highArcTraj.params = highArcSol;
  } catch (err) {
    console.error('High arc solver error:', err);
  }

  // Only present valid, achievable ways that successfully reach the target within ballistics tolerance
  const targetDistTolerance = Math.max(50, targetRange * 0.03);

  const directDist = directTraj ? parseFloat(directTraj.analysis?.groundDistance || 0) : 0;
  const highArcDist = highArcTraj ? parseFloat(highArcTraj.analysis?.groundDistance || 0) : 0;

  const directHitsTarget = directSol && Math.abs(directDist - targetRange) <= targetDistTolerance;
  const highArcHitsTarget = highArcSol && Math.abs(highArcDist - targetRange) <= targetDistTolerance;

  const isDirectViable = Boolean(directSol && directTraj && !directTraj.collision && directHitsTarget);
  const isHighArcViable = Boolean(highArcSol && highArcTraj && !highArcTraj.collision && highArcHitsTarget);
  const hasViableSolution = isDirectViable || isHighArcViable;

  let directReason = 'Available';
  if (!directSol || !directHitsTarget) {
    directReason = `Target beyond direct-fire range (target: ${(targetRange / 1000).toFixed(2)} km, max reach: ${(directDist / 1000).toFixed(2)} km)`;
  } else if (directTraj?.collision) {
    directReason = `Blocked by terrain crest at ${directTraj.collisionPoint?.distance?.toFixed(0)}m (${directTraj.collisionPoint?.elevation?.toFixed(0)}m ASL)`;
  }

  let highArcReason = 'Available';
  if (!highArcSol || !highArcHitsTarget) {
    highArcReason = `Target beyond high-arc plunging range (target: ${(targetRange / 1000).toFixed(2)} km, max reach: ${(highArcDist / 1000).toFixed(2)} km)`;
  } else if (highArcTraj?.collision) {
    highArcReason = `Blocked by terrain crest at ${highArcTraj.collisionPoint?.distance?.toFixed(0)}m (${highArcTraj.collisionPoint?.elevation?.toFixed(0)}m ASL)`;
  }

  return {
    targetRange: parseFloat(targetRange.toFixed(1)),
    hasViableSolution,
    directFire: isDirectViable ? { config: directSol, result: directTraj } : null,
    highArc: isHighArcViable ? { config: highArcSol, result: highArcTraj } : null,
    directReason,
    highArcReason,
    blockedTrajectory: !hasViableSolution ? (directTraj || highArcTraj) : null,
  };
}
