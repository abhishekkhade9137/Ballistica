import React from 'react';
import styles from './TrajectoryAnalysis.module.css';

function TrajectoryAnalysis({
  analysis,
  trajectoryData,
  availableSolutions,
  activeSolutionType,
  onSelectSolution,
}) {
  // If NO viable firing solution exists, show dedicated tactical failure notice
  if (!trajectoryData) {
    if (availableSolutions && !availableSolutions.hasViableSolution) {
      return (
        <div className={styles.noSolutionContainer}>
          <div className={styles.noSolutionHeader}>
            <div className={styles.warningBadge}>
              
              <span>NO VIABLE FIRING SOLUTION FOUND</span>
            </div>
            <div className={styles.targetRangePill}>
              TARGET RANGE: {(availableSolutions.targetRange / 1000).toFixed(2)} km
            </div>
          </div>

          <p className={styles.noSolutionSubtext}>
            Ballistic solver evaluated both Direct Fire (Low Angle) and High-Arc Plunging (High Angle) trajectories. Neither trajectory can achieve impact on the designated target.
          </p>

          <div className={styles.reasonsGrid}>
            <div className={styles.reasonCard}>
              <div className={styles.reasonTitle}>
                <span>Option 1: Direct Fire (Low QE)</span>
                <span className={styles.blockedPill}>UNACHIEVABLE</span>
              </div>
              <p className={styles.reasonDesc}>
                {availableSolutions.directReason || 'Target beyond maximum direct-fire reach or line-of-sight obstructed by terrain.'}
              </p>
            </div>

            <div className={styles.reasonCard}>
              <div className={styles.reasonTitle}>
                <span>Option 2: High-Arc Plunging (High QE)</span>
                <span className={styles.blockedPill}>UNACHIEVABLE</span>
              </div>
              <p className={styles.reasonDesc}>
                {availableSolutions.highArcReason || 'Target beyond maximum weapon range or flight arc collides with mountain ridge.'}
              </p>
            </div>
          </div>

          <div className={styles.recommendationBox}>
            <span className={styles.recommendationBadge}>TACTICAL ADVISORY</span>
            <span>
              Reposition Gun Battery closer to the objective, or select a heavier ordnance system (e.g. <strong>Heavy Field Artillery</strong> for extended reach, or <strong>High-Angle Mortar</strong> for steep mountain slopes).
            </span>
          </div>
        </div>
      );
    }
    return null;
  }

  if (!analysis) {
    return null;
  }

  const { trajectory, inverseConfig, terrainProfile } = trajectoryData;

  const impactV = parseFloat(analysis.impactVelocity) || 0;
  const massKg = trajectoryData.params?.mass || 1.0;
  const kineticEnergyKJ = ((0.5 * massKg * impactV * impactV) / 1000).toFixed(1);

  // Downsample trajectory points for SVG 2D Altitude Profile
  const profilePoints = [];
  if (trajectory && trajectory.length > 0) {
    const totalPts = trajectory.length;
    const sampleStep = Math.max(1, Math.floor(totalPts / 120));
    for (let i = 0; i < totalPts; i += sampleStep) {
      profilePoints.push(trajectory[i]);
    }
    if (profilePoints[profilePoints.length - 1] !== trajectory[totalPts - 1]) {
      profilePoints.push(trajectory[totalPts - 1]);
    }
  }

  // Calculate Dynamic Vertical Relief Bounds
  const terrainElevations = (terrainProfile && terrainProfile.length > 0)
    ? terrainProfile.map(tp => Number(tp.elevation) || 0)
    : [profilePoints[0]?.altitude || 0, profilePoints[profilePoints.length - 1]?.altitude || 0];

  const minTerrainAlt = Math.min(...terrainElevations);
  const maxTerrainAlt = Math.max(...terrainElevations);
  const trajectoryMaxAlt = Math.max(...profilePoints.map(p => Number(p.altitude) || 0), 10);
  const overallMaxAlt = Math.max(trajectoryMaxAlt, maxTerrainAlt);

  // Dynamic vertical relief framing:
  // Instead of grounding at 0m (sea level) which crushes ground topography into a flat strip,
  // frame around the active operational altitude band with clean headroom and footroom.
  const verticalSpan = Math.max(overallMaxAlt - minTerrainAlt, 30);
  const footroom = Math.max(15, verticalSpan * 0.12);
  const headroom = Math.max(20, verticalSpan * 0.15);

  const minAlt = Math.max(0, Math.floor(minTerrainAlt - footroom));
  const maxAlt = Math.ceil(overallMaxAlt + headroom);
  const altRange = Math.max(maxAlt - minAlt, 10);

  // SVG Dimensions & Padding (generous padding for readable Y-axis altitude labels)
  const svgWidth = 880;
  const svgHeight = 240;
  const paddingLeft = 75; // Left margin for ASL altitude text labels
  const paddingRight = 45;
  const paddingTop = 32;
  const paddingBottom = 42; // Bottom margin for X-axis distance labels
  const plotWidth = svgWidth - paddingLeft - paddingRight;
  const plotHeight = svgHeight - paddingTop - paddingBottom;
  const totalGroundMeters = parseFloat(analysis.groundDistance) || 1000;

  // Compute Projectile Trajectory SVG Polyline - ALIGNED STRICTLY TO PHYSICAL GROUND DISTANCE
  const pointsString = profilePoints.map((pt) => {
    const ptDist = Math.sqrt((pt.x || 0) * (pt.x || 0) + (pt.y || 0) * (pt.y || 0));
    const frac = totalGroundMeters > 0 ? Math.min(1, Math.max(0, ptDist / totalGroundMeters)) : 0;
    const x = paddingLeft + frac * plotWidth;
    const normAlt = ((pt.altitude || 0) - minAlt) / altRange;
    const y = svgHeight - paddingBottom - normAlt * plotHeight;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  // SVG Terrain Polygon - ALIGNED TO THE EXACT SAME PHYSICAL GROUND DISTANCE
  let terrainPolygonString = '';
  let peakTerrain = null;
  if (terrainProfile && terrainProfile.length > 0) {
    const maxTerrainDist = Math.max(...terrainProfile.map(tp => tp.distance || 0), totalGroundMeters);
    const terrainPoints = terrainProfile.map((tp) => {
      const tpDist = typeof tp.distance === 'number' ? tp.distance : 0;
      const frac = maxTerrainDist > 0 ? Math.min(1, Math.max(0, tpDist / maxTerrainDist)) : 0;
      const x = paddingLeft + frac * plotWidth;
      const normAlt = ((tp.elevation || 0) - minAlt) / altRange;
      const y = svgHeight - paddingBottom - normAlt * plotHeight;
      return { x, y, elevation: tp.elevation, distance: tpDist };
    });

    peakTerrain = terrainPoints.reduce((max, p) => p.elevation > max.elevation ? p : max, terrainPoints[0]);

    const polygonPts = terrainPoints.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`);
    polygonPts.push(`${(paddingLeft + plotWidth).toFixed(1)},${(svgHeight - paddingBottom).toFixed(1)}`);
    polygonPts.push(`${paddingLeft.toFixed(1)},${(svgHeight - paddingBottom).toFixed(1)}`);
    terrainPolygonString = polygonPts.join(' ');
  }

  // Y-Axis Altitude Grid Lines (4 horizontal intervals)
  const yTicks = [0, 0.33, 0.66, 1.0].map((fraction) => {
    const altValue = Math.round(minAlt + fraction * altRange);
    const yPos = svgHeight - paddingBottom - fraction * plotHeight;
    return { altValue, yPos };
  });

  // X-Axis Distance Grid Markers (4 intervals)
  const xTicks = [0, 0.33, 0.66, 1.0].map((fraction) => {
    const distM = fraction * totalGroundMeters;
    const distLabel = distM >= 1000 ? `${(distM / 1000).toFixed(1)} km` : `${distM.toFixed(0)}m`;
    const xPos = paddingLeft + fraction * plotWidth;
    return { distLabel, xPos };
  });

  const launchY = profilePoints.length > 0 
    ? svgHeight - paddingBottom - (((profilePoints[0].altitude || 0) - minAlt) / altRange) * plotHeight
    : svgHeight - paddingBottom;

  const impactY = profilePoints.length > 0 
    ? svgHeight - paddingBottom - (((profilePoints[profilePoints.length - 1].altitude || 0) - minAlt) / altRange) * plotHeight
    : svgHeight - paddingBottom;

  const lastPt = profilePoints[profilePoints.length - 1] || {};
  const lastPtDist = Math.sqrt((lastPt.x || 0) * (lastPt.x || 0) + (lastPt.y || 0) * (lastPt.y || 0));
  const impactFrac = totalGroundMeters > 0 ? Math.min(1, Math.max(0, lastPtDist / totalGroundMeters)) : 1;
  const impactX = paddingLeft + impactFrac * plotWidth;

  return (
    <div className={styles.analysisContainer}>
      {/* Trajectory Solution Selector Dock (Results at bottom) */}
      {availableSolutions && (availableSolutions.directFire || availableSolutions.highArc) && (
        <div className={styles.trajectorySelectorBar}>
          <div className={styles.selectorHeader}>
            <span className={styles.selectorTitle}>FIRING TRAJECTORY OPTIONS</span>
            <span className={styles.selectorSub}>Select flight profile to apply:</span>
          </div>
          <div className={styles.selectorButtonGroup}>
            {availableSolutions.directFire && (
              <button
                type="button"
                onClick={() => onSelectSolution && onSelectSolution('directFire')}
                className={`${styles.selectorBtn} ${activeSolutionType === 'directFire' ? styles.activeDirectBtn : ''}`}
              >
                <div className={styles.btnRow}>
                  <span className={styles.btnTitle}>Option 1: Direct Fire</span>
                  <span className={styles.btnTag}>
                    {activeSolutionType === 'directFire' ? 'ACTIVE' : 'SELECT'}
                  </span>
                </div>
                <div className={styles.btnMetrics}>
                  QE: {availableSolutions.directFire.config.elevationAngle.toFixed(1)}° &bull; Flight: {availableSolutions.directFire.result.analysis.timeOfFlight}s &bull; Apex: {availableSolutions.directFire.result.analysis.maxAltitude}m
                </div>
              </button>
            )}

            {availableSolutions.highArc && (
              <button
                type="button"
                onClick={() => onSelectSolution && onSelectSolution('highArc')}
                className={`${styles.selectorBtn} ${activeSolutionType === 'highArc' ? styles.activeHighArcBtn : ''}`}
              >
                <div className={styles.btnRow}>
                  <span className={styles.btnTitle}>Option 2: High-Arc Plunging</span>
                  <span className={styles.btnTag}>
                    {activeSolutionType === 'highArc' ? 'ACTIVE' : 'SELECT'}
                  </span>
                </div>
                <div className={styles.btnMetrics}>
                  QE: {availableSolutions.highArc.config.elevationAngle.toFixed(1)}° &bull; Flight: {availableSolutions.highArc.result.analysis.timeOfFlight}s &bull; Apex: {availableSolutions.highArc.result.analysis.maxAltitude}m
                </div>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Target Firing Solution Cards */}
      {inverseConfig && (
        <div className={styles.inverseBanner}>
          <div className={styles.solutionCardsGrid}>
            <div className={`${styles.solutionCard} ${styles.primary}`}>
              <span className={styles.solutionLabel}>Firing Bearing</span>
              <div className={styles.solutionValue}>
                {inverseConfig.azimuthAngle}°
                {inverseConfig.deflectionMils !== undefined && (
                  <span style={{ fontSize: '12px', display: 'block', color: 'var(--accent-cyan)', fontWeight: 500 }}>
                    Defl: {inverseConfig.deflectionMils > 0 ? '+' : ''}{inverseConfig.deflectionMils} mils
                  </span>
                )}
              </div>
            </div>

            {inverseConfig.solveFor !== 'velocity' && (
              <div className={`${styles.solutionCard} ${styles.primary}`}>
                <span className={styles.solutionLabel}>Elevation (QE)</span>
                <div className={styles.solutionValue}>{inverseConfig.elevationAngle}°</div>
              </div>
            )}

            {inverseConfig.solveFor === 'velocity' && (
              <div className={`${styles.solutionCard} ${styles.primary}`}>
                <span className={styles.solutionLabel}>Muzzle Velocity</span>
                <div className={styles.solutionValue}>{inverseConfig.velocity} m/s</div>
              </div>
            )}

            <div className={`${styles.solutionCard} ${styles.secondary}`}>
              <span className={styles.solutionLabel}>Time of Flight</span>
              <div className={styles.solutionValue}>{analysis.timeOfFlight}s</div>
            </div>

            <div className={`${styles.solutionCard} ${styles.secondary}`}>
              <span className={styles.solutionLabel}>Target Range</span>
              <div className={styles.solutionValue}>
                {inverseConfig.targetRange >= 1000 ? (inverseConfig.targetRange / 1000).toFixed(2) + ' km' : inverseConfig.targetRange + ' m'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Telemetry Metrics Header */}
      <div className={styles.sectionTitle}>
        <span>Flight Telemetry & Kinematics</span>
        <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
          Target Range: {(parseFloat(analysis.groundDistance) / 1000).toFixed(2)} km
        </span>
      </div>

      {/* Grid of Key Ballistic Parameters */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <h3>Flight Time</h3>
          <p className={styles.value}>{analysis.timeOfFlight}s</p>
        </div>

        <div className={styles.metricCard}>
          <h3>Ground Range</h3>
          <p className={styles.value}>
            {parseFloat(analysis.groundDistance) >= 1000
              ? `${(parseFloat(analysis.groundDistance) / 1000).toFixed(2)} km`
              : `${analysis.groundDistance}m`}
          </p>
        </div>

        <div className={styles.metricCard}>
          <h3>Kinematic Apex</h3>
          <p className={styles.value}>{analysis.maxAltitude}m ASL</p>
        </div>

        <div className={styles.metricCard}>
          <h3>Impact Velocity</h3>
          <p className={styles.value}>{analysis.impactVelocity} m/s</p>
        </div>

        <div className={styles.metricCard}>
          <h3>Angle of Fall</h3>
          <p className={styles.value}>{analysis.impactAngle}°</p>
        </div>

        <div className={styles.metricCard}>
          <h3>Coriolis Drift</h3>
          <p className={styles.value}>{analysis.coriolisDeflection}m</p>
        </div>

        <div className={styles.metricCard}>
          <h3>Lateral Deflection</h3>
          <p className={styles.value}>
            {analysis.netLateralDeflection || '0.0'}m
          </p>
        </div>

        <div className={styles.metricCard}>
          <h3>Deflection Laying</h3>
          <p className={styles.value}>
            {analysis.deflectionMils || '0.0'} mils
          </p>
        </div>

        <div className={styles.metricCard}>
          <h3>Peak Airspeed</h3>
          <p className={styles.value}>
            Mach {analysis.maxMach || '1.0'}
          </p>
        </div>

        <div className={styles.metricCard}>
          <h3>Impact Kinetic Energy</h3>
          <p className={styles.value}>{kineticEnergyKJ} kJ</p>
        </div>

        <div className={styles.metricCard}>
          <h3>Parabolic Arc Length</h3>
          <p className={styles.value}>
            {parseFloat(analysis.totalDistance) >= 1000
              ? `${(parseFloat(analysis.totalDistance) / 1000).toFixed(2)} km`
              : `${analysis.totalDistance}m`}
          </p>
        </div>
      </div>

      {/* 2D Trajectory & Altitude Profile Visualization */}
      <div className={styles.chartContainer}>
        <div className={styles.chartHeader}>
          <div>
            <h4 className={styles.chartTitle}>2D Trajectory &amp; Elevation Profile</h4>
            <span style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'var(--font-hud)' }}>
              Dynamic Vertical Relief &bull; Topographical Line-of-Sight
            </span>
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
              Apex: <strong style={{ color: '#00e5ff' }}>{analysis.maxAltitude}m ASL</strong>
            </span>
            <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
              Range: <strong style={{ color: '#10b981' }}>{(parseFloat(analysis.groundDistance) / 1000).toFixed(2)} km</strong>
            </span>
          </div>
        </div>

        <svg className={styles.svgProfile} viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="terrainGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.35" />
              <stop offset="60%" stopColor="#d97706" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#78350f" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="trajectoryGlow" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#00e5ff" />
              <stop offset="50%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#818cf8" />
            </linearGradient>
          </defs>

          {/* Y-Axis Horizontal Grid Lines & Elevation Labels */}
          {yTicks.map((tick, i) => (
            <g key={`ytick-${i}`}>
              <line
                x1={paddingLeft}
                y1={tick.yPos}
                x2={paddingLeft + plotWidth}
                y2={tick.yPos}
                stroke={i === 0 ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.08)'}
                strokeDasharray={i === 0 ? 'none' : '4 4'}
              />
              <text
                x={paddingLeft - 10}
                y={tick.yPos + 4}
                textAnchor="end"
                fill="#94a3b8"
                fontSize="11"
                fontFamily="var(--font-mono)"
                fontWeight="600"
              >
                {tick.altValue}m
              </text>
            </g>
          ))}

          {/* X-Axis Vertical Tick Lines & Distance Labels */}
          {xTicks.map((tick, i) => (
            <g key={`xtick-${i}`}>
              <line
                x1={tick.xPos}
                y1={paddingTop}
                x2={tick.xPos}
                y2={svgHeight - paddingBottom}
                stroke="rgba(255, 255, 255, 0.04)"
              />
              <line
                x1={tick.xPos}
                y1={svgHeight - paddingBottom}
                x2={tick.xPos}
                y2={svgHeight - paddingBottom + 5}
                stroke="rgba(255, 255, 255, 0.3)"
              />
              <text
                x={tick.xPos}
                y={svgHeight - paddingBottom + 18}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="11"
                fontFamily="var(--font-mono)"
              >
                {tick.distLabel}
              </text>
            </g>
          ))}

          {/* Terrain Silhouette Area */}
          {terrainPolygonString && (
            <polygon
              points={terrainPolygonString}
              fill="url(#terrainGrad)"
              stroke="#f59e0b"
              strokeWidth="2"
            />
          )}

          {/* Mountain Ridge / Peak Crest Marker */}
          {peakTerrain && peakTerrain.elevation > minTerrainAlt + 15 && (
            <g>
              <line
                x1={peakTerrain.x}
                y1={peakTerrain.y}
                x2={peakTerrain.x}
                y2={Math.max(paddingTop, peakTerrain.y - 20)}
                stroke="#f59e0b"
                strokeDasharray="2 2"
                strokeWidth="1"
              />
              <circle cx={peakTerrain.x} cy={peakTerrain.y} r="3.5" fill="#f59e0b" />
              <rect
                x={peakTerrain.x - 42}
                y={Math.max(paddingTop - 14, peakTerrain.y - 36)}
                width="84"
                height="18"
                rx="3"
                fill="rgba(15, 23, 42, 0.9)"
                stroke="#f59e0b"
                strokeWidth="1"
              />
              <text
                x={peakTerrain.x}
                y={Math.max(paddingTop - 1, peakTerrain.y - 23)}
                textAnchor="middle"
                fill="#fbbf24"
                fontSize="10"
                fontFamily="var(--font-mono)"
                fontWeight="700"
              >
                Crest {Math.round(peakTerrain.elevation)}m
              </text>
            </g>
          )}

          {/* Projectile Trajectory Flight Line */}
          <polyline
            fill="none"
            stroke="url(#trajectoryGlow)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={pointsString}
          />

          {/* Gun Launch Point Marker & Altitude Badge */}
          {profilePoints.length > 0 && (
            <g>
              <circle
                cx={paddingLeft}
                cy={launchY}
                r="6"
                fill="#00e5ff"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
              <rect
                x={paddingLeft - 8}
                y={launchY - 26}
                width="74"
                height="18"
                rx="4"
                fill="rgba(15, 23, 42, 0.9)"
                stroke="#00e5ff"
                strokeWidth="1"
              />
              <text
                x={paddingLeft + 29}
                y={launchY - 13}
                textAnchor="middle"
                fill="#00e5ff"
                fontSize="10"
                fontFamily="var(--font-mono)"
                fontWeight="700"
              >
                Gun {Math.round(profilePoints[0]?.altitude || minTerrainAlt)}m
              </text>
            </g>
          )}

          {/* Target Impact Point Marker & Altitude Badge */}
          {profilePoints.length > 0 && (
            <g>
              <circle
                cx={impactX}
                cy={impactY}
                r="6"
                fill="#ef4444"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
              <rect
                x={impactX - (trajectoryData.collision ? 60 : 42)}
                y={impactY - 26}
                width={trajectoryData.collision ? 120 : 84}
                height="18"
                rx="4"
                fill="rgba(15, 23, 42, 0.9)"
                stroke="#ef4444"
                strokeWidth="1"
              />
              <text
                x={impactX}
                y={impactY - 13}
                textAnchor="middle"
                fill="#ef4444"
                fontSize="10"
                fontFamily="var(--font-mono)"
                fontWeight="700"
              >
                {trajectoryData.collision
                  ? `COLLISION ${Math.round(profilePoints[profilePoints.length - 1]?.altitude || minTerrainAlt)}m`
                  : `Target ${Math.round(profilePoints[profilePoints.length - 1]?.altitude || minTerrainAlt)}m`}
              </text>
            </g>
          )}
        </svg>

        <div className={styles.chartLegend}>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: '#00e5ff' }}></span>
            <span>Ballistic Trajectory Arc</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: '#f59e0b' }}></span>
            <span>Continuous Path Ground Relief (ASL)</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: '#ef4444' }}></span>
            <span>Target Objective</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TrajectoryAnalysis;
