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
  
  // Map step number to a meaningful description
  const getStepDescription = (step) => {
    switch(step) {
      case 0:
        return "Sending Hello Packets";
      case 1:
        return "Step 1: Initial LSP Distribution";
      default:
        return `Step ${step}: LSP Flooding`;
    }
  };
  
  return (
    <div className="control-panel-container">
      <div className="control-panel-section">
        <h3>Simulation Controls</h3>
        
        <div className="button-container">
          <button
            onClick={onStartSimulation}
            disabled={disabled || isRunning || isPaused}
          >
            Start Simulation
          </button>
          
          {isRunning && (
            <button onClick={onPauseSimulation}>
              Pause
            </button>
          )}
          
          {isPaused && (
            <button onClick={onResumeSimulation}>
              Resume
            </button>
          )}
          
          {(isRunning || isPaused) && (
            <button onClick={onEndSimulation}>
              End Simulation
            </button>
          )}
          
          {(isCompleted) && (
            <button onClick={onResetSimulation} className="reset-button">
              Reset Simulation
            </button>
          )}
        </div>
      </div>
      
      <div className="speed-control">
        <label htmlFor="speedSlider">Animation Speed:</label>
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
        <span>{speed.toFixed(1)}x</span>
      </div>
      
      {(isRunning || isPaused || isCompleted) && (
        <div className="current-step">
          <h4>Current Simulation Progress:</h4>
          <div className="step-indicator">
            {isCompleted ? 'Complete' : `Step ${currentStep}`}
          </div>
        </div>
      )}
      
      <div className="instructions">
        <h4>Instructions:</h4>
        <ul className="instructions-list">
          <li>Drag routers to position them</li>
          <li>Click "Connect Routers" to add links</li>
          <li>Use "Selection Mode" to delete elements</li>
          <li>Start simulation to see routing in action</li>
        </ul>
      </div>
      
      <div className="simulation-status">
        <p>Status: <strong>{simulationStatus.charAt(0).toUpperCase() + simulationStatus.slice(1)}</strong></p>
        {simulationStatus === 'idle' && disabled && (
          <p className="status-message">
            Add at least 2 routers and 1 link to start the simulation.
          </p>
        )}
        {simulationStatus === 'completed' && (
          <p className="status-message">
            Simulation completed. You can view routing tables for each router.
          </p>
        )}
      </div>
    </div>
  );
};

export default ControlPanel; 