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

  test('Battle of Tololing (1999) mountain assault has viable targeting solution', () => {
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
    assert.ok(solution.hasViableSolution, 'Tololing must have a viable targeting solution');
    const active = solution.directFire || solution.highArc;
    assert.ok(active.config.elevationAngle > 0, 'QE must be positive');
  });

  test('Battle of Longewala (1971) solves long-range desert ballistics (>14km)', () => {
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
    assert.ok(solution.directFire || solution.highArc, 'Longewala must have at least one viable solution');
    assert.ok(solution.targetRange > 13000, `Range must exceed 13km, got ${solution.targetRange}`);
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
    const active = solution.directFire || solution.highArc;
    assert.ok(active, 'Must find a viable firing solution for 73 Easting');
    assert.notEqual(active.config.layingDeflectionMils, 0, 'Crosswind + spin drift must require non-zero mils laying deflection');
  });
});
