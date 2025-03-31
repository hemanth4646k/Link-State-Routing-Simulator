import React from 'react';

const ControlPanel = ({
  onStartSimulation,
  onPauseSimulation,
  onResumeSimulation,
  onEndSimulation,
  onResetSimulation,
  onSpeedChange,
  simulationStatus,
  speed,
  disabled,
  currentStep
}) => {
  const isRunning = simulationStatus === 'running';
  const isPaused = simulationStatus === 'paused';
  const isCompleted = simulationStatus === 'completed';
  
  const handleSpeedChange = (e) => {
    const newSpeed = parseFloat(e.target.value);
    onSpeedChange(newSpeed);
  };
  
  return (
    <div className="control-panel-container">
      <div className="panel-section simulation-controls">
        <h3>Simulation Controls</h3>
        
        <div className="button-container">
          <button
            onClick={onStartSimulation}
            disabled={disabled || isRunning || isPaused}
            className="primary-button"
          >
            Start Simulation
          </button>
          
          {isRunning && (
            <button onClick={onPauseSimulation} className="control-button">
              Pause
            </button>
          )}
          
          {isPaused && (
            <button onClick={onResumeSimulation} className="control-button">
              Resume
            </button>
          )}
          
          {(isRunning || isPaused) && (
            <button onClick={onEndSimulation} className="control-button">
              End Simulation
            </button>
          )}
          
          {isCompleted && (
            <button onClick={onResetSimulation} className="reset-button">
              Reset Simulation
            </button>
          )}
        </div>
      </div>
      
      <div className="panel-section speed-controls">
        <label htmlFor="speedSlider">Animation Speed</label>
        <div className="speed-slider-container">
          <div className="speed-labels">
            <span>Slow</span>
            <span>Fast</span>
          </div>
          <input
            id="speedSlider"
            type="range"
            min="0.1"
            max="3"
            step="0.1"
            value={speed}
            onChange={handleSpeedChange}
            disabled={!isRunning && !isPaused}
          />
          <div className="speed-value">{speed.toFixed(1)}x</div>
        </div>
      </div>
      
      <div className="panel-section instructions">
        <h4>Instructions</h4>
        <ul className="instructions-list">
          <li>Drag routers to position them in 3D space</li>
          <li>Use camera controls to rotate and zoom the view</li>
          <li>Click "Connect Routers" to add links</li>
          <li>Use "Selection Mode" to delete elements</li>
          <li>Start simulation to see routing in action</li>
        </ul>
      </div>
      
      {simulationStatus === 'idle' && disabled && (
        <div className="panel-message">
          Add at least 2 routers and 1 link to start the simulation.
        </div>
      )}
      
      {simulationStatus === 'completed' && (
        <div className="panel-message success">
          Simulation completed! View routing tables for each router.
        </div>
      )}
    </div>
  );
};

export default ControlPanel; 