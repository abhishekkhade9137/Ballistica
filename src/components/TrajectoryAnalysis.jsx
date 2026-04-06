import React from 'react';
import styles from './TrajectoryAnalysis.module.css';

function TrajectoryAnalysis({ analysis, trajectoryData }) {
  if (!analysis || !trajectoryData) {
    return null;
  }

  return (
    <div className={styles.analysisContainer}>
      {trajectoryData.inverseConfig && (
        <div style={{ background: '#ebf4ff', border: '1px solid #c3dafe', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
          <h2 style={{ color: '#4c51bf', marginTop: 0, marginBottom: '12px' }}>🎯 Inverse Targeting Solution</h2>
          <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#4a5568' }}>
            To hit the selected target exactly <strong>{trajectoryData.inverseConfig.targetRange}m</strong> away (Accuracy: {Math.abs(trajectoryData.inverseConfig.rangeError)}m margin of error), use these settings:
          </p>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '12px' }}>
            <div style={{ background: '#fff', padding: '10px 16px', borderRadius: '6px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', borderLeft: '4px solid #4f46e5' }}>
              <span style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 'bold' }}>Required Azimuth</span>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#2d3748' }}>{trajectoryData.inverseConfig.azimuthAngle}°</div>
              <span style={{ fontSize: '11px', color: '#a0aec0' }}>(Wind & Coriolis compensated)</span>
            </div>
            
            {trajectoryData.inverseConfig.solveFor !== 'velocity' && (
              <div style={{ background: '#fff', padding: '10px 16px', borderRadius: '6px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', borderLeft: '4px solid #ed8936' }}>
                <span style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 'bold' }}>Required Elevation</span>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#2d3748' }}>{trajectoryData.inverseConfig.elevationAngle}°</div>
              </div>
            )}

            {trajectoryData.inverseConfig.solveFor === 'velocity' && (
              <div style={{ background: '#fff', padding: '10px 16px', borderRadius: '6px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', borderLeft: '4px solid #38b2ac' }}>
                <span style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 'bold' }}>Required Velocity</span>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#2d3748' }}>{trajectoryData.inverseConfig.velocity} m/s</div>
              </div>
            )}
          </div>
        </div>
      )}

      <h2>Trajectory Analysis</h2>
      
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <h3>Time of Flight</h3>
          <p className={styles.value}>{analysis.timeOfFlight}s</p>
          <p className={styles.label}>Total flight time</p>
        </div>

        <div className={styles.metricCard}>
          <h3>Ground Distance</h3>
          <p className={styles.value}>{analysis.groundDistance}m</p>
          <p className={styles.label}>Straight-line distance</p>
        </div>

        <div className={styles.metricCard}>
          <h3>Horizontal Distance</h3>
          <p className={styles.value}>{analysis.horizontalDistance}m</p>
          <p className={styles.label}>Direct displacement</p>
        </div>

        <div className={styles.metricCard}>
          <h3>Max Altitude</h3>
          <p className={styles.value}>{analysis.maxAltitude}m</p>
          <p className={styles.label}>Peak height reached</p>
        </div>

        <div className={styles.metricCard}>
          <h3>Total Distance</h3>
          <p className={styles.value}>{analysis.totalDistance}m</p>
          <p className={styles.label}>Arc length traveled</p>
        </div>

        <div className={styles.metricCard}>
          <h3>Impact Velocity</h3>
          <p className={styles.value}>{analysis.impactVelocity}m/s</p>
          <p className={styles.label}>Speed at impact</p>
        </div>

        <div className={styles.metricCard}>
          <h3>Impact Angle</h3>
          <p className={styles.value}>{analysis.impactAngle}°</p>
          <p className={styles.label}>Angle at impact</p>
        </div>

        <div className={styles.metricCard}>
          <h3>Coriolis Deflection</h3>
          <p className={styles.value}>{analysis.coriolisDeflection}m</p>
          <p className={styles.label}>Earth rotation effect</p>
        </div>
      </div>

      <div className={styles.summary}>
        <h3>Summary</h3>
        <ul>
          <li>The projectile traveled <strong>{analysis.totalDistance}m</strong> along its curved path</li>
          <li>Impact occurred <strong>{analysis.timeOfFlight}s</strong> after launch</li>
          <li>Maximum altitude reached was <strong>{analysis.maxAltitude}m</strong></li>
          <li>Ground distance covered: <strong>{analysis.groundDistance}m</strong></li>
          <li>Coriolis deflection: <strong>{analysis.coriolisDeflection}m</strong></li>
          <li>Impact velocity: <strong>{analysis.impactVelocity}m/s</strong> at <strong>{analysis.impactAngle}°</strong> angle</li>
        </ul>
      </div>
    </div>
  );
}

export default TrajectoryAnalysis;
