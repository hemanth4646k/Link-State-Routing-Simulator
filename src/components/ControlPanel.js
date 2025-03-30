import React from 'react';

const ControlPanel = ({
  onStartSimulation,
  onPauseSimulation,
  onResumeSimulation,
  onEndSimulation,
  onSpeedChange,
  simulationStatus,
  speed,
  disabled,
  currentStep
}) => {
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
      <h3>Control Panel</h3>
      
      {simulationStatus === 'running' && currentStep !== undefined && (
        <div className="current-step">
          <h4>Current Phase:</h4>
          <div className="step-indicator">
            {getStepDescription(currentStep)}
          </div>
        </div>
      )}
      
      <div className="control-buttons">
        {simulationStatus === 'idle' && (
          <button
            onClick={onStartSimulation}
            disabled={disabled}
          >
            Start Simulation
          </button>
        )}
        
        {simulationStatus === 'running' && (
          <button onClick={onPauseSimulation}>
            Pause Simulation
          </button>
        )}
        
        {simulationStatus === 'paused' && (
          <button onClick={onResumeSimulation}>
            Resume Simulation
          </button>
        )}
        
        {(simulationStatus === 'running' || simulationStatus === 'paused' || simulationStatus === 'completed') && (
          <button onClick={onEndSimulation}>
            End Simulation
          </button>
        )}
      </div>
      
      <div className="speed-control">
        <label htmlFor="speed-slider">Animation Speed:</label>
        <input
          id="speed-slider"
          type="range"
          min="0.1"
          max="3"
          step="0.1"
          value={speed}
          onChange={handleSpeedChange}
          disabled={simulationStatus === 'idle'}
        />
        <div className="speed-labels">
          <span>Slow</span>
          <span>Fast</span>
        </div>
        <span>{speed.toFixed(1)}x</span>
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