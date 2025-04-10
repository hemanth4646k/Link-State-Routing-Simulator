import React, { useState } from 'react';

const ControlPanel = ({
  onStartSimulation,
  onPauseSimulation,
  onResumeSimulation,
  onEndSimulation,
  onResetSimulation,
  onSpeedChange,
  onSendCustomPacket,
  onNextStep,
  onEditTopology,
  simulationStatus,
  speed,
  disabled,
  currentStep,
  isPaused,
  animationInProgress
}) => {
  const isRunning = simulationStatus === 'running';
  const isPausedState = simulationStatus === 'paused';
  const isCompleted = simulationStatus === 'completed';
  
  // State for collapsible sections
  const [isInstructionsCollapsed, setIsInstructionsCollapsed] = useState(false);
  
  const handleSpeedChange = (e) => {
    const newSpeed = parseFloat(e.target.value);
    onSpeedChange(newSpeed);
  };
  
  const toggleInstructions = () => {
    setIsInstructionsCollapsed(!isInstructionsCollapsed);
  };
  
  return (
    <div className="control-panel-container">
      <div className="panel-section simulation-controls">
        <h3>Simulation Controls</h3>
        
        <div className="button-container">
          <button
            onClick={onStartSimulation}
            disabled={disabled || isRunning || isPausedState || isPaused}
            className="primary-button"
          >
            Start Simulation
          </button>
          
          {isRunning && (
            <button 
              onClick={onPauseSimulation} 
              className="control-button"
              disabled={isPaused}
            >
              Pause
            </button>
          )}
          
          {isPausedState && (
            <button onClick={onResumeSimulation} className="control-button">
              Resume
            </button>
          )}
          
          {/* Next step button - only shown during simulation */}
          <button 
            className={`control-button next-step-button ${simulationStatus !== 'running' ? 'hidden' : ''}`}
            onClick={onNextStep}
            disabled={simulationStatus !== 'running' || isPaused || animationInProgress}
            title={animationInProgress ? "Wait for current animation to complete" : "Run the next step of the simulation"}
          >
            <span className="icon-step-forward">▶</span> Next Step
          </button>
          
          {(isRunning || isPausedState) && (
            <button 
              onClick={onEditTopology} 
              className="control-button"
              disabled={isPaused}
            >
              Edit Topology
            </button>
          )}
          
          {(isRunning || isPausedState) && (
            <button 
              onClick={onEndSimulation} 
              className="control-button"
              disabled={isPaused}
            >
              End Simulation
            </button>
          )}
          
          {isCompleted && (
            <button 
              onClick={onResetSimulation} 
              className="reset-button"
              disabled={isPaused}
            >
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
            disabled={(!isRunning && !isPausedState) || isPaused}
          />
          <div className="speed-value">{speed.toFixed(1)}x</div>
        </div>
      </div>
      
      <div className="panel-section instructions">
        <div 
          className={`collapsible-header ${isInstructionsCollapsed ? 'collapsed' : ''}`}
          onClick={toggleInstructions}
        >
          <h4>Instructions</h4>
          <span className="collapsible-icon">
            {isInstructionsCollapsed ? '►' : '▼'}
          </span>
        </div>
        
        <div className={`collapsible-content ${isInstructionsCollapsed ? 'collapsed' : ''}`}>
          <ul className="instructions-list">
            <li>Drag routers to position them in 3D space</li>
            <li>Use camera controls to rotate and zoom the view</li>
            <li>Click "Connect Routers" to add links</li>
            <li>Use "Selection Mode" to delete elements</li>
            <li>Start simulation to see routing in action</li>
            <li>Use "Next Step" to advance the simulation one step</li>
            <li>Use "Edit Topology" to modify the network during simulation</li>
          </ul>
        </div>
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