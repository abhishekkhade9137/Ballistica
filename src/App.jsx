import React, { useState } from 'react';
import './index.css';
import './App.css';
import Map from './components/Map';
import InputBar from './components/InputBar';
import TrajectoryAnalysis from './components/TrajectoryAnalysis';
import { calculateTrajectory, calculateTargetingSolution } from './utils/calculator';

function App() {
  const [trajectoryData, setTrajectoryData] = useState(null);
  const [startingPoint, setStartingPoint] = useState({ lat: 35.1, lng: -79.0 }); // Fort Bragg, NC
  const [targetPoint, setTargetPoint] = useState(null);

  const handleCalculate = (params) => {
    try {
      if (params.mode === 'targeting' && params.targetLatLng) {
        // Run the inverse solver first to find the missing variables
        const solvedParams = calculateTargetingSolution(params, params.targetLatLng, params.solveFor);
        // Then run the forward solver with the discovered variables to get the renderable arc
        const result = calculateTrajectory(solvedParams);
        result.inverseConfig = solvedParams; // attach metadata for UI
        setTrajectoryData(result);
      } else {
        const result = calculateTrajectory(params);
        setTrajectoryData(result);
      }
    } catch (error) {
      console.error('Error calculating trajectory:', error);
      alert('Error calculating trajectory: ' + error.message);
    }
  };

  const handleSetStartingPoint = (lat, lng) => {
    setStartingPoint({ lat, lng });
  };

  const handleSetTargetPoint = (lat, lng) => {
    setTargetPoint({ lat, lng });
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Advanced Ballistics Calculator</h1>
        <p style={{ fontSize: '14px', margin: '5px 0 0 0', opacity: 0.8 }}>
          Professional 3D trajectory simulation with Earth's curvature, Coriolis, and atmospheric effects
        </p>
      </header>
      <main className="main-content">
        <InputBar
          onCalculate={handleCalculate}
          startingPoint={startingPoint}
          targetPoint={targetPoint}
          onUpdateStartingPoint={setStartingPoint}
          onUpdateTargetPoint={setTargetPoint}
        />
        <Map
          trajectoryData={trajectoryData}
          onSetStartingPoint={handleSetStartingPoint}
          onSetTargetPoint={handleSetTargetPoint}
          startingPoint={startingPoint}
          targetPoint={targetPoint}
        />
      </main>
      {trajectoryData && (
        <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
          <TrajectoryAnalysis analysis={trajectoryData.analysis} trajectoryData={trajectoryData} />
        </div>
      )}
    </div>
  );
}

export default App;
