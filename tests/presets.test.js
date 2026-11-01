import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { HISTORICAL_PRESETS } from '../src/data/historicalPresets.js';
import { haversineDistance, calculateAllTargetingSolutions } from '../src/utils/calculator.js';

describe('Ballistica C2 — Historical Tactical Presets Suite', () => {
  test('HISTORICAL_PRESETS contains all 5 iconic military artillery engagements', () => {
    assert.equal(HISTORICAL_PRESETS.length, 5, 'Should have exactly 5 historical presets');
    const ids = HISTORICAL_PRESETS.map((p) => p.id);
    assert.ok(ids.includes('tololing-1999'), 'Should include Battle of Tololing');
    assert.ok(ids.includes('tiger-hill-1999'), 'Should include Tiger Hill Bombardment');
    assert.ok(ids.includes('longewala-1971'), 'Should include Battle of Longewala');
    assert.ok(ids.includes('dien-bien-phu-1954'), 'Should include Siege of Dien Bien Phu');
    assert.ok(ids.includes('73-easting-1991'), 'Should include Battle of 73 Easting');
  });

  test('All presets have geodetically valid coordinates and realistic engagement ranges', () => {
    HISTORICAL_PRESETS.forEach((preset) => {
      const { batteryCoords, targetCoords, title } = preset;
      assert.ok(batteryCoords.lat >= -90 && batteryCoords.lat <= 90, `${title} invalid battery lat`);
      assert.ok(batteryCoords.lng >= -180 && batteryCoords.lng <= 180, `${title} invalid battery lng`);
      assert.ok(targetCoords.lat >= -90 && targetCoords.lat <= 90, `${title} invalid target lat`);
      assert.ok(targetCoords.lng >= -180 && targetCoords.lng <= 180, `${title} invalid target lng`);

      const rangeM = haversineDistance(batteryCoords, targetCoords);
      assert.ok(rangeM > 1000 && rangeM < 30000, `${title} range ${rangeM}m out of realistic artillery limits`);
    });
  });

  test('Battle of Tololing (1999) Direct Fire mountain assault is viable and clear', () => {
    const tololing = HISTORICAL_PRESETS.find((p) => p.id === 'tololing-1999');
    const params = {
      startLat: tololing.batteryCoords.lat,
      startLng: tololing.batteryCoords.lng,
      startElevation: tololing.startElevation,
      targetElevation: tololing.targetElevation,
      velocity: 827,
      mass: 43.2,
      dragCoeff: 0.0019,
      calibre: 0.155,
      barrelTwist: 3.10,
      windSpeed: tololing.weather.windSpeed,
      windDirection: tololing.weather.windDirection,
      groundTempC: tololing.weather.groundTempC,
      groundPressureHpa: tololing.weather.groundPressureHpa,
      gravity: 9.81,
      mode: 'targeting',
      solveFor: 'both',
      targetLatLng: tololing.targetCoords,
    };

    const solution = calculateAllTargetingSolutions(params, tololing.targetCoords);
    assert.ok(solution.directFire, 'Tololing must have direct fire available');
    assert.equal(solution.directFire.result.collision, null, 'Direct fire must clear without collision');
    assert.ok(solution.directFire.config.elevationAngle > 5 && solution.directFire.config.elevationAngle < 30, 'QE must be realistic direct angle');
    assert.ok(parseFloat(solution.directFire.result.analysis.timeOfFlight) < 10, 'Direct shot flight time must be under 10 seconds');
  });

  test('Tiger Hill Bombardment (1999) High-Arc Plunging Fire is viable and clear', () => {
    const tigerHill = HISTORICAL_PRESETS.find((p) => p.id === 'tiger-hill-1999');
    const params = {
      startLat: tigerHill.batteryCoords.lat,
      startLng: tigerHill.batteryCoords.lng,
      startElevation: tigerHill.startElevation,
      targetElevation: tigerHill.targetElevation,
      velocity: 827,
      mass: 43.2,
      dragCoeff: 0.0019,
      calibre: 0.155,
      barrelTwist: 3.10,
      windSpeed: tigerHill.weather.windSpeed,
      windDirection: tigerHill.weather.windDirection,
      groundTempC: tigerHill.weather.groundTempC,
      groundPressureHpa: tigerHill.weather.groundPressureHpa,
      gravity: 9.81,
      mode: 'targeting',
      solveFor: 'both',
      targetLatLng: tigerHill.targetCoords,
    };

    const solution = calculateAllTargetingSolutions(params, tigerHill.targetCoords);
    assert.ok(solution.highArc, 'Tiger Hill must have high-arc plunging solution');
    assert.equal(solution.highArc.result.collision, null, 'High-arc must clear crests without collision');
    assert.ok(solution.highArc.config.elevationAngle > 60, 'High-arc QE must exceed 60 degrees');
  });

  test('Battle of Longewala (1971) Direct Fire solves long-range desert ballistics (>14km)', () => {
    const longewala = HISTORICAL_PRESETS.find((p) => p.id === 'longewala-1971');
    const params = {
      startLat: longewala.batteryCoords.lat,
      startLng: longewala.batteryCoords.lng,
      startElevation: longewala.startElevation,
      targetElevation: longewala.targetElevation,
      velocity: 827,
      mass: 43.2,
      dragCoeff: 0.0019,
      calibre: 0.155,
      barrelTwist: 3.10,
      windSpeed: longewala.weather.windSpeed,
      windDirection: longewala.weather.windDirection,
      groundTempC: longewala.weather.groundTempC,
      groundPressureHpa: longewala.weather.groundPressureHpa,
      gravity: 9.81,
      mode: 'targeting',
      solveFor: 'both',
      targetLatLng: longewala.targetCoords,
    };

    const solution = calculateAllTargetingSolutions(params, longewala.targetCoords);
    assert.ok(solution.directFire, 'Longewala must have a direct fire solution');
    assert.equal(solution.directFire.result.collision, null, 'Longewala direct fire must have no collision');
    assert.ok(solution.targetRange > 13000, `Range must exceed 13km, got ${solution.targetRange}`);
  });

  test('Siege of Dien Bien Phu (1954) negative elevation downhill direct-fire is viable', () => {
    const dbp = HISTORICAL_PRESETS.find((p) => p.id === 'dien-bien-phu-1954');
    const params = {
      startLat: dbp.batteryCoords.lat,
      startLng: dbp.batteryCoords.lng,
      startElevation: dbp.startElevation,
      targetElevation: dbp.targetElevation,
      velocity: 472,
      mass: 14.9,
      dragCoeff: 0.00045,
      calibre: 0.105,
      barrelTwist: 2.10,
      maxRange: 11500,
      windSpeed: dbp.weather.windSpeed,
      windDirection: dbp.weather.windDirection,
      groundTempC: dbp.weather.groundTempC,
      groundPressureHpa: dbp.weather.groundPressureHpa,
      gravity: 9.81,
      mode: 'targeting',
      solveFor: 'both',
      targetLatLng: dbp.targetCoords,
    };

    const solution = calculateAllTargetingSolutions(params, dbp.targetCoords);
    assert.ok(solution.directFire, 'Dien Bien Phu must have direct fire solution');
    assert.equal(solution.directFire.result.collision, null);
    assert.ok(solution.directFire.config.elevationAngle > 0 && solution.directFire.config.elevationAngle < 15, 'Downhill shot must have realistic direct elevation angle');
  });

  test('Strict weapon operational maxRange enforcement rejects out-of-range targets', () => {
    const dbp = HISTORICAL_PRESETS.find((p) => p.id === 'dien-bien-phu-1954');
    // Equipping a short-range 40mm Medium Autocannon (maxRange: 4200m) for a 5795m target
    const outOfRangeParams = {
      startLat: dbp.batteryCoords.lat,
      startLng: dbp.batteryCoords.lng,
      startElevation: dbp.startElevation,
      targetElevation: dbp.targetElevation,
      velocity: 1000,
      mass: 0.96,
      dragCoeff: 0.00015,
      calibre: 0.040,
      barrelTwist: 1.0,
      maxRange: 4200,
      windSpeed: dbp.weather.windSpeed,
      windDirection: dbp.weather.windDirection,
      groundTempC: dbp.weather.groundTempC,
      groundPressureHpa: dbp.weather.groundPressureHpa,
      gravity: 9.81,
      mode: 'targeting',
      solveFor: 'both',
      targetLatLng: dbp.targetCoords,
    };

    const solution = calculateAllTargetingSolutions(outOfRangeParams, dbp.targetCoords);
    assert.equal(solution.hasViableSolution, false, 'Out-of-range target must not have a viable solution');
    assert.equal(solution.directFire, null, 'Direct fire must be null when out of range');
    assert.equal(solution.highArc, null, 'High arc must be null when out of range');
    assert.ok(solution.directReason.includes('beyond weapon operational max range'), 'Must state out of range reason');
  });

  test('Battle of 73 Easting (1991) crosswind forces automated mils deflection compensation', () => {
    const easting = HISTORICAL_PRESETS.find((p) => p.id === '73-easting-1991');
    const params = {
      startLat: easting.batteryCoords.lat,
      startLng: easting.batteryCoords.lng,
      startElevation: easting.startElevation,
      targetElevation: easting.targetElevation,
      velocity: 827,
      mass: 43.2,
      dragCoeff: 0.0019,
      calibre: 0.155,
      barrelTwist: 3.10,
      windSpeed: easting.weather.windSpeed,
      windDirection: easting.weather.windDirection,
      groundTempC: easting.weather.groundTempC,
      groundPressureHpa: easting.weather.groundPressureHpa,
      gravity: 9.81,
      mode: 'targeting',
      solveFor: 'both',
      targetLatLng: easting.targetCoords,
    };

    const solution = calculateAllTargetingSolutions(params, easting.targetCoords);
    assert.ok(solution.directFire, 'Must find direct fire solution for 73 Easting');
    assert.notEqual(solution.directFire.config.deflectionMils, 0, 'Crosswind + spin drift must require non-zero mils laying deflection');
  });
});
