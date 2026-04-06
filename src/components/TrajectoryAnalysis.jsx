import React from 'react';
import styles from './TrajectoryAnalysis.module.css';

function TrajectoryAnalysis({ analysis, trajectoryData }) {
  if (!analysis || !trajectoryData) {
    return null;
  }

  return (
    <div className={styles.analysisContainer}>
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
