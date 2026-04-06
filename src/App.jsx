import React, { useState } from 'react';
import './index.css';
import './App.css';
import Map from './components/Map';
import InputBar from './components/InputBar';
import TrajectoryAnalysis from './components/TrajectoryAnalysis';
import { calculateTrajectory } from './utils/calculator';

function App() {
  const [trajectoryData, setTrajectoryData] = useState(null);
  const [startingPoint, setStartingPoint] = useState({ lat: 35.1, lng: -79.0 }); // Fort Bragg, NC - major military installation

  const handleCalculate = (params) => {
    try {
      const result = calculateTrajectory(params);
      setTrajectoryData(result);
    } catch (error) {
      console.error('Error calculating trajectory:', error);
      alert('Error calculating trajectory: ' + error.message);
    }
  };

  const handleSetStartingPoint = (lat, lng) => {
    setStartingPoint({ lat, lng });
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
          onUpdateStartingPoint={setStartingPoint}
        />
        <Map
          trajectoryData={trajectoryData}
          onSetStartingPoint={handleSetStartingPoint}
          startingPoint={startingPoint}
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
