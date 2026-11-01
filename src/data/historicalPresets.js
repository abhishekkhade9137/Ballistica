/**
 * Historical Artillery Engagement Presets
 * Real-world tactical scenarios showcasing doctrine, terrain profiles, and ballistics physics.
 */

export const HISTORICAL_PRESETS = [
  {
    id: 'tololing-1999',
    title: 'Battle of Tololing (1999)',
    subtitle: 'High-Altitude Direct-Laying Mountain Assault',
    conflict: 'Kargil War, 1999',
    date: 'June 1999',
    theater: 'Dras Sector, Jammu & Kashmir',
    gunKey: 'heavyArtillery',
    gunLabel: 'Heavy Field Artillery (155mm)',
    batteryCoords: { lat: 34.4320, lng: 75.7650 },
    targetCoords: { lat: 34.4550, lng: 75.7950 },
    startElevation: 3280,
    targetElevation: 4590,
    weather: {
      windSpeed: 5,
      windDirection: 270,
      groundTempC: -2,
      groundPressureHpa: 680,
    },
    preferredMode: 'directFire',
    historicalBriefing:
      'Indian artillery took the unprecedented tactical decision to move 155mm field howitzers into forward, direct-firing positions along NH-1D in the Dras valley. Sighting through open bores directly at enemy sangars on the razor-sharp ridgeline of Point 4590, direct fire pulverized reinforced bunkers at point-blank range, enabling 2 Rajputana Rifles to capture the peak on June 13, 1999.',
    ballisticsLesson:
      'High-altitude direct fire required compensating for extreme uphill angular displacement (+1,310m elevation gain) and thin mountain air (680 hPa), which drastically reduces aerodynamic drag compared to sea-level ballistics.',
    tacticalTags: ['Direct Fire', 'Mountain Warfare', 'High Altitude', 'ISA Lapse Rate'],
  },
  {
    id: 'tiger-hill-1999',
    title: 'Tiger Hill Bombardment (1999)',
    subtitle: 'Reverse-Slope High-Angle Plunging Concentration',
    conflict: 'Kargil War, 1999',
    date: 'July 1999',
    theater: 'Tiger Hill, Dras Sector, J&K',
    gunKey: 'heavyArtillery',
    gunLabel: 'Heavy Field Artillery (155mm)',
    batteryCoords: { lat: 34.4150, lng: 75.7200 },
    targetCoords: { lat: 34.4714, lng: 75.7725 },
    startElevation: 3250,
    targetElevation: 5062,
    weather: {
      windSpeed: 7,
      windDirection: 290,
      groundTempC: -6,
      groundPressureHpa: 640,
    },
    preferredMode: 'highArc',
    historicalBriefing:
      'Over 120 artillery guns conducted a continuous 72-hour bombardment of Tiger Hill (5,062m ASL). Because enemy bunkers were dug into reverse slopes behind knife-edge ridges, direct-fire shells struck intermediate crests. Battery commanders switched to High-Arc Plunging Fire (QE > 65 deg), lofting shells high into the stratosphere before dropping vertically onto the sangars.',
    ballisticsLesson:
      'Intermediate mountain peaks block low-quadrant direct fire. High-Arc Plunging Fire lofts the projectile vertex over 4,800m ASL, ensuring crest clearance and delivering an almost perpendicular terminal plunge angle of fall.',
    tacticalTags: ['High-Arc Plunging', 'Crest Clearance', 'Reverse-Slope Sangar', 'Thin Air'],
  },
  {
    id: 'longewala-1971',
    title: 'Battle of Longewala (1971)',
    subtitle: 'Extreme Thermal Desert Ballistics',
    conflict: 'Indo-Pakistani War, 1971',
    date: 'December 1971',
    theater: 'Thar Desert, Jaisalmer Sector, Rajasthan',
    gunKey: 'heavyArtillery',
    gunLabel: 'Heavy Field Artillery (155mm)',
    batteryCoords: { lat: 27.5250, lng: 70.1600 },
    targetCoords: { lat: 27.5180, lng: 70.0150 },
    startElevation: 115,
    targetElevation: 130,
    weather: {
      windSpeed: 4,
      windDirection: 180,
      groundTempC: 38,
      groundPressureHpa: 1008,
    },
    preferredMode: 'directFire',
    historicalBriefing:
      'Artillery batteries positioned behind sand dunes provided defensive fire support for 23 Punjab defending the border outpost at Longewala against advancing enemy armour. Long-range artillery fire broke the momentum of enemy motorized columns, immobilizing tanks in loose sand until Indian Air Force Hunters arrived at first light.',
    ballisticsLesson:
      'Extreme desert heat (38 deg C) reduces ground air density by approx 8 percent, extending projectile range over 14 km while high time-of-flight magnifies lateral Coriolis deflection in northern latitudes.',
    tacticalTags: ['Extreme Heat', 'Desert Ballistics', 'Coriolis Effect', 'Long Range'],
  },
  {
    id: 'dien-bien-phu-1954',
    title: 'Siege of Dien Bien Phu (1954)',
    subtitle: 'Reverse-Slope Cave to Basin Negative Elevation',
    conflict: 'First Indochina War, 1954',
    date: 'March-May 1954',
    theater: 'Muong Thanh Valley, Northwestern Vietnam',
    gunKey: 'mediumHowitzer',
    gunLabel: 'Medium Field Howitzer (105mm)',
    batteryCoords: { lat: 21.4320, lng: 103.0480 },
    targetCoords: { lat: 21.3880, lng: 103.0180 },
    startElevation: 650,
    targetElevation: 440,
    weather: {
      windSpeed: 2,
      windDirection: 90,
      groundTempC: 26,
      groundPressureHpa: 965,
    },
    preferredMode: 'directFire',
    historicalBriefing:
      'Viet Minh forces hauled 105mm howitzers by hand through sheer mountain jungles, emplacing them in fortified caves dug into high slopes encircling the valley. Firing downward onto the French airfield and central strongpoints, the artillery destroyed the airstrip and choked off French aerial resupply, leading to the garrison surrender.',
    ballisticsLesson:
      'Firing downward with negative altitude differential (Delta h = -210m) produces a negative angle of site, compressed impact footprint, and increased terminal velocity upon impact.',
    tacticalTags: ['Negative Elevation', 'Jungle Valley', 'Direct Sighting', 'Terminal Velocity'],
  },
  {
    id: '73-easting-1991',
    title: 'Battle of 73 Easting (1991)',
    subtitle: 'High-Crosswind Desert Dust Engagement',
    conflict: 'Gulf War (Operation Desert Storm), 1991',
    date: 'February 1991',
    theater: 'Iraqi Desert / Kuwaiti Border',
    gunKey: 'heavyArtillery',
    gunLabel: 'Heavy Field Artillery (155mm)',
    batteryCoords: { lat: 29.8300, lng: 47.0500 },
    targetCoords: { lat: 29.8750, lng: 47.1650 },
    startElevation: 180,
    targetElevation: 165,
    weather: {
      windSpeed: 12,
      windDirection: 315,
      groundTempC: 20,
      groundPressureHpa: 1012,
    },
    preferredMode: 'directFire',
    historicalBriefing:
      'During a severe desert shamal storm with high lateral winds and zero visibility, US VII Corps artillery provided rapid massed fires ahead of the 2nd Armored Cavalry Regiment as they encountered the Iraqi Republican Guard Tawakalna Division at grid line 73 Easting.',
    ballisticsLesson:
      'A 12 m/s crosswind combined with right-hand rifling spin drift causes over 100m of lateral deviation over a 12 km trajectory. Automated laying must compute substantial azimuth deflection (in mils) to compensate and achieve direct impact.',
    tacticalTags: ['Crosswind Drift', 'Spin Drift', 'Mils Deflection', 'Modern Automated Laying'],
  },
];
