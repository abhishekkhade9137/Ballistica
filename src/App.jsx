import React, { useState, useCallback } from 'react';
import './index.css';
import './App.css';
import Map from './components/Map';
import InputBar from './components/InputBar';
import TrajectoryAnalysis from './components/TrajectoryAnalysis';
import DiagnosticsModal from './components/DiagnosticsModal';
import HistoricalScenariosModal from './components/HistoricalScenariosModal';
import { calculateTrajectory, calculateAllTargetingSolutions } from './utils/calculator';
import { logger } from './utils/logger';

function App() {
  const [trajectoryData, setTrajectoryData] = useState(null);
  const [availableSolutions, setAvailableSolutions] = useState(null);
  const [activeSolutionType, setActiveSolutionType] = useState('directFire'); // 'directFire' | 'highArc'
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [scenariosOpen, setScenariosOpen] = useState(false);
  const [activeScenario, setActiveScenario] = useState(null);

  // Default Initial Tactical Coordinates (Mountain Topography Sector)
  const [startingPoint, setStartingPoint] = useState({ lat: 34.4280, lng: 75.7600 }); 
  const [targetPoint, setTargetPoint] = useState({ lat: 34.4550, lng: 75.7950 });
  const [placementMode, setPlacementMode] = useState('battery'); // 'battery' | 'target'

  const handleSetStartingPoint = useCallback((point, maybeLng) => {
    const lat = typeof point === 'object' ? point.lat : point;
    const lng = typeof point === 'object' ? point.lng : maybeLng;
    if (lat !== undefined && lng !== undefined) {
      setStartingPoint({ lat, lng });
      logger.tactical('POSITION', `Gun Battery positioned at ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`);
    }
  }, []);

  const handleSetTargetPoint = useCallback((point, maybeLng) => {
    const lat = typeof point === 'object' ? point.lat : point;
    const lng = typeof point === 'object' ? point.lng : maybeLng;
    if (lat !== undefined && lng !== undefined) {
      setTargetPoint({ lat, lng });
      logger.tactical('TARGET', `Target objective designated at ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`);
    }
  }, []);

  const handleClearMarkings = useCallback(() => {
    setActiveScenario(null);
    setStartingPoint(null);
    setTargetPoint(null);
    setTrajectoryData(null);
    setAvailableSolutions(null);
    setPlacementMode('battery');
    logger.tactical('GIS', 'Cleared Gun Battery and Target Objective markings from map');
  }, []);

  const handleSelectScenario = useCallback((scenario) => {
    if (!scenario) return;
    setActiveScenario(scenario);
    setStartingPoint(scenario.batteryCoords);
    setTargetPoint(scenario.targetCoords);
    if (scenario.preferredMode) {
      setActiveSolutionType(scenario.preferredMode);
    }
    logger.tactical(
      'SCENARIO',
      `Loaded historical scenario: ${scenario.title} (${scenario.conflict}) — ${scenario.theater}`
    );
  }, []);

  // Solve all ways to hit target
  const handleFindSolutions = useCallback((params) => {
    try {
      const allSolutions = calculateAllTargetingSolutions(params, params.targetLatLng);
      setAvailableSolutions(allSolutions);

      const direct = allSolutions.directFire;
      const high = allSolutions.highArc;
      logger.tactical(
        'SOLVER',
        `Computed dual firing solutions for ${(allSolutions.targetRange / 1000).toFixed(2)} km: ` +
        `Direct Fire = ${direct ? direct.config.elevationAngle.toFixed(1) + '° QE (' + direct.result.analysis.timeOfFlight + 's)' : 'BLOCKED'}, ` +
        `High-Arc = ${high ? high.config.elevationAngle.toFixed(1) + '° QE (' + high.result.analysis.timeOfFlight + 's)' : 'BLOCKED'}`
      );

      // Preserve user active solution choice if viable; otherwise fallback safely
      setActiveSolutionType((prevType) => {
        if (prevType === 'highArc' && allSolutions.highArc) {
          setTrajectoryData(allSolutions.highArc.result);
          return 'highArc';
        }
        if (prevType === 'directFire' && allSolutions.directFire) {
          setTrajectoryData(allSolutions.directFire.result);
          return 'directFire';
        }

        // Default to directFire if clear; switch to highArc if directFire collides with terrain
        if (allSolutions.directFire && (!allSolutions.directFire.result.collision || !allSolutions.highArc)) {
          setTrajectoryData(allSolutions.directFire.result);
          return 'directFire';
        }
        if (allSolutions.highArc) {
          setTrajectoryData(allSolutions.highArc.result);
          return 'highArc';
        }
        if (allSolutions.directFire) {
          setTrajectoryData(allSolutions.directFire.result);
          return 'directFire';
        }

        setTrajectoryData(null);
        logger.warn(
          'SOLVER',
          `No viable firing solution found: Direct = ${allSolutions.directReason} | High-Arc = ${allSolutions.highArcReason}`
        );
        return null;
      });
    } catch (error) {
      logger.error('SOLVER', `Error calculating firing solutions: ${error.message}`);
      console.error('Error finding solutions:', error);
      alert('Error calculating firing solutions: ' + error.message);
    }
  }, []);

  const handleSelectSolution = useCallback((type) => {
    setActiveSolutionType(type);
    setAvailableSolutions((prevSolutions) => {
      if (prevSolutions && prevSolutions[type]) {
        setTrajectoryData(prevSolutions[type].result);
        logger.tactical(
          'ENGAGEMENT',
          `Switched trajectory to ${type === 'directFire' ? 'Option 1: Direct Fire' : 'Option 2: High-Arc Plunging Fire'} ` +
          `(QE: ${prevSolutions[type].config.elevationAngle.toFixed(1)}°)`
        );
      }
      return prevSolutions;
    });
  }, []);

  // Standard forward calculation fallback
  const handleCalculate = (params) => {
    try {
      if (params.mode === 'targeting' && params.targetLatLng) {
        handleFindSolutions(params);
      } else {
        const result = calculateTrajectory(params);
        result.params = params;
        setTrajectoryData(result);
        setAvailableSolutions(null);
      }
    } catch (error) {
      console.error('Error calculating trajectory:', error);
      alert('Ballistic calculation error: ' + error.message);
    }
  };

  return (
    <div className="app-container">
      {/* Tactical C2 Header Bar */}
      <header className="header">
        <div className="brand-section">
          <div className="brand-title">
            <h1>BALLISTICS SIMULATION</h1>
          </div>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="demo-trigger-btn"
            style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(217, 119, 6, 0.3) 100%)',
              border: '1px solid #f59e0b',
              color: '#f59e0b',
              boxShadow: '0 0 12px rgba(245, 158, 11, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onClick={() => setScenariosOpen(true)}
          >
            <span>Historical Presets</span>
            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              background: 'rgba(245, 158, 11, 0.3)',
              color: '#ffffff',
              padding: '2px 6px',
              borderRadius: '4px',
            }}>
              5 BATTLES
            </span>
          </button>

          <button
            type="button"
            className="demo-trigger-btn"
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.3) 100%)',
              border: '1px solid #10b981',
              color: '#10b981',
              boxShadow: '0 0 12px rgba(16, 185, 129, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onClick={() => setDiagnosticsOpen(true)}
          >
            <span>System Diagnostics & Tests</span>
            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              background: 'rgba(16, 185, 129, 0.3)',
              color: '#ffffff',
              padding: '2px 6px',
              borderRadius: '4px',
            }}>
              LIVE
            </span>
          </button>
        </div>
      </header>

      {/* Main Dual-Pane Dashboard: Controls & Interactive GIS Map */}
      <main className="main-content">
        <InputBar
          onCalculate={handleCalculate}
          onFindSolutions={handleFindSolutions}
          onClearMarkings={handleClearMarkings}
          activeScenario={activeScenario}
          onSelectScenario={handleSelectScenario}
          onOpenScenariosModal={() => setScenariosOpen(true)}
          startingPoint={startingPoint}
          targetPoint={targetPoint}
          placementMode={placementMode}
          setPlacementMode={setPlacementMode}
          availableSolutions={availableSolutions}
          activeSolutionType={activeSolutionType}
          onSelectSolution={handleSelectSolution}
        />
        <Map
          trajectoryData={trajectoryData}
          availableSolutions={availableSolutions}
          activeSolutionType={activeSolutionType}
          onSelectSolution={handleSelectSolution}
          onSetStartingPoint={handleSetStartingPoint}
          onSetTargetPoint={handleSetTargetPoint}
          onClearMarkings={handleClearMarkings}
          startingPoint={startingPoint}
          targetPoint={targetPoint}
          placementMode={placementMode}
          setPlacementMode={setPlacementMode}
        />
      </main>

      {/* Telemetry & Analysis Section (Dedicated at bottom) */}
      {(trajectoryData || availableSolutions) && (
        <div className="analysis-wrapper">
          <TrajectoryAnalysis
            analysis={trajectoryData?.analysis}
            trajectoryData={trajectoryData}
            availableSolutions={availableSolutions}
            activeSolutionType={activeSolutionType}
            onSelectSolution={handleSelectSolution}
          />
        </div>
      )}

      {/* Diagnostics & Self-Test Modal */}
      <DiagnosticsModal
        isOpen={diagnosticsOpen}
        onClose={() => setDiagnosticsOpen(false)}
      />

      {/* Historical Artillery Engagements Modal */}
      <HistoricalScenariosModal
        isOpen={scenariosOpen}
        onClose={() => setScenariosOpen(false)}
        onSelectScenario={handleSelectScenario}
      />
    </div>
  );
}

export default App;
