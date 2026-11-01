import React, { useState } from 'react';
import styles from './HistoricalScenariosModal.module.css';
import { HISTORICAL_PRESETS } from '../data/historicalPresets';
import { haversineDistance } from '../utils/calculator';

function HistoricalScenariosModal({ isOpen, onClose, onSelectScenario }) {
  const [selectedId, setSelectedId] = useState(HISTORICAL_PRESETS[0].id);

  if (!isOpen) return null;

  const currentPreset = HISTORICAL_PRESETS.find((p) => p.id === selectedId) || HISTORICAL_PRESETS[0];
  const distanceKm = (haversineDistance(currentPreset.batteryCoords, currentPreset.targetCoords) / 1000).toFixed(2);
  const altDiffM = currentPreset.targetElevation - currentPreset.startElevation;

  const handleRecreate = (preset) => {
    if (onSelectScenario) {
      onSelectScenario(preset);
    }
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <div>
              <h3>BALLISTICA C2 — HISTORICAL ARTILLERY PRESETS</h3>
              <p>Recreate Iconic Battlefield Artillery Engagements &amp; Analyze Trajectory Physics</p>
            </div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} title="Close Modal">&times;</button>
        </div>

        {/* Dual-Pane Body */}
        <div className={styles.body}>
          {/* Left: Scenarios Selector List */}
          <div className={styles.sidebar}>
            <div className={styles.sidebarHeader}>Select Engagement ({HISTORICAL_PRESETS.length})</div>
            <div className={styles.scenarioList}>
              {HISTORICAL_PRESETS.map((preset) => {
                const isSelected = preset.id === selectedId;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={`${styles.scenarioItem} ${isSelected ? styles.selectedItem : ''}`}
                    onClick={() => setSelectedId(preset.id)}
                  >
                    <div className={styles.scenarioConflict}>{preset.conflict} &bull; {preset.date}</div>
                    <div className={styles.scenarioName}>{preset.title}</div>
                    <div className={styles.scenarioSubtitle}>{preset.subtitle}</div>
                    <div className={styles.tagRow}>
                      {preset.tacticalTags.slice(0, 2).map((tag, idx) => (
                        <span key={idx} className={styles.miniTag}>{tag}</span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Detailed Tactical Briefing & Ballistic Specs */}
          <div className={styles.detailPane}>
            <div className={styles.detailHeader}>
              <div>
                <span className={styles.conflictBadge}>{currentPreset.conflict} &bull; {currentPreset.date}</span>
                <h2 className={styles.detailTitle}>{currentPreset.title}</h2>
                <div className={styles.detailSubtitle}>{currentPreset.subtitle}</div>
              </div>

              <button
                type="button"
                className={styles.recreateActionBtn}
                onClick={() => handleRecreate(currentPreset)}
              >
                Recreate Tactical Engagement
              </button>
            </div>

            {/* Tactical Telemetry Strip */}
            <div className={styles.telemetryGrid}>
              <div className={styles.telemetryCard}>
                <span className={styles.cardLabel}>Theater of Ops</span>
                <span className={styles.cardVal}>{currentPreset.theater}</span>
              </div>
              <div className={styles.telemetryCard}>
                <span className={styles.cardLabel}>Weapon System</span>
                <span className={styles.cardVal} style={{ color: '#00e5ff' }}>{currentPreset.gunLabel}</span>
              </div>
              <div className={styles.telemetryCard}>
                <span className={styles.cardLabel}>Engagement Range</span>
                <span className={styles.cardVal}>{distanceKm} km</span>
              </div>
              <div className={styles.telemetryCard}>
                <span className={styles.cardLabel}>Terrain Altitude Delta</span>
                <span className={styles.cardVal} style={{ color: altDiffM >= 0 ? '#10b981' : '#f59e0b' }}>
                  {altDiffM > 0 ? `+${altDiffM}m` : `${altDiffM}m`} ({currentPreset.startElevation}m to {currentPreset.targetElevation}m)
                </span>
              </div>
              <div className={styles.telemetryCard}>
                <span className={styles.cardLabel}>Atmosphere &amp; Wind</span>
                <span className={styles.cardVal}>
                  {currentPreset.weather.groundTempC}°C, {currentPreset.weather.groundPressureHpa} hPa | Wind: {currentPreset.weather.windSpeed} m/s @ {currentPreset.weather.windDirection}°
                </span>
              </div>
              <div className={styles.telemetryCard}>
                <span className={styles.cardLabel}>Tactical Solution Type</span>
                <span className={styles.cardVal} style={{ color: currentPreset.preferredMode === 'highArc' ? '#10b981' : '#00e5ff' }}>
                  {currentPreset.preferredMode === 'highArc' ? 'High-Arc Plunging Fire (QE > 60°)' : 'Direct Fire / Low Quadrant Elevation'}
                </span>
              </div>
            </div>

            {/* Historical Tactical Briefing */}
            <div className={styles.briefingSection}>
              <h4>Historical Tactical Briefing</h4>
              <p>{currentPreset.historicalBriefing}</p>
            </div>

            {/* Ballistic Engineering Insight */}
            <div className={styles.physicsSection}>
              <h4>Ballistics &amp; Trajectory Engineering Analysis</h4>
              <p>{currentPreset.ballisticsLesson}</p>
            </div>

            {/* Tactical Doctrine Tags */}
            <div className={styles.tagsFooter}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Tactical Pillars:</span>
              <div className={styles.tagsContainer}>
                {currentPreset.tacticalTags.map((tag, idx) => (
                  <span key={idx} className={styles.pillarTag}>{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HistoricalScenariosModal;
