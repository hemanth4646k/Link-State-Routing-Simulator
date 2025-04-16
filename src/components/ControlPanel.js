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
  const [isLegendCollapsed, setIsLegendCollapsed] = useState(false);
  
  const handleSpeedChange = (e) => {
    const newSpeed = parseFloat(e.target.value);
    onSpeedChange(newSpeed);
  };
  
  const toggleLegend = () => {
    setIsLegendCollapsed(!isLegendCollapsed);
  };
  
  return (
    <div className="control-panel-container">
      {/* Current Mode Indicator */}
      <div className="current-mode-indicator">
        <div className="current-mode">
          <h4>Current Mode: {simulationStatus === 'idle' ? 'Setup' : simulationStatus.charAt(0).toUpperCase() + simulationStatus.slice(1)}</h4>
          {isRunning && (
            <div className="step-indicator">
              <span>Current Step: {currentStep}</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Quick Help */}
      {simulationStatus === 'idle' && (
        <div className="quick-help">
          <p><strong>💡 Quick Start:</strong> Drag routers to the stage, connect them, then start simulation.</p>
        </div>
      )}
      
      {isRunning && (
        <div className="quick-help">
          <p><strong>💡 Next Step:</strong> Click the "Next Step" button to advance the simulation.</p>
        </div>
      )}
      
      {isPausedState && (
        <div className="quick-help">
          <p><strong>💡 Topology Edit:</strong> You can add/remove links or routers in this mode.</p>
        </div>
      )}
      
      <div className="panel-section simulation-controls">
        <h3>Simulation Controls</h3>
        
        {simulationStatus === 'idle' && (
          <div className="button-container">
            <button
              onClick={onStartSimulation}
              disabled={disabled}
              className="primary-button"
            >
              Start Simulation
            </button>
            {disabled && (
              <div className="panel-message">
                Add at least 2 routers and 1 link to start.
              </div>
            )}
          </div>
        )}
        
        {isRunning && (
          <div className="button-container">
            <div className="primary-action">
              <button 
                className="primary-button next-step-button"
                onClick={onNextStep}
                disabled={isPaused || animationInProgress}
                title={animationInProgress ? "Wait for current animation to complete" : "Run the next step of the simulation"}
              >
                <span className="icon-step-forward">▶</span> Next Step
              </button>
              {animationInProgress && (
                <div className="animation-status">Animation in progress...</div>
              )}
            </div>
            
            <div className="control-actions">
              <button 
                onClick={onPauseSimulation} 
                className="control-button"
                disabled={isPaused}
              >
                Pause
              </button>
              
              <button 
                onClick={onEndSimulation} 
                className="control-button"
                disabled={isPaused}
              >
                End Simulation
              </button>
            </div>
          </div>
        )}
        
        {isPausedState && (
          <div className="button-container">
            <button onClick={onResumeSimulation} className="primary-button">
              Resume Simulation
            </button>
            
            <button 
              onClick={onEndSimulation} 
              className="control-button"
            >
              End Simulation
            </button>
          </div>
        )}
        
        {isCompleted && (
          <div className="button-container">
            <button 
              onClick={onResetSimulation} 
              className="reset-button"
            >
              Reset Simulation
            </button>
            <div className="panel-message success">
              Simulation completed! View routing tables for each router.
            </div>
          </div>
        )}
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
            disabled={isPaused}
          />
          <div className="speed-value">{speed.toFixed(1)}x</div>
        </div>
      </div>
      
      <div className="panel-section legend">
        <div 
          className={`collapsible-header ${isLegendCollapsed ? 'collapsed' : ''}`}
          onClick={toggleLegend}
        >
          <h4>Legend</h4>
          <span className="collapsible-icon">
            {isLegendCollapsed ? '►' : '▼'}
          </span>
        </div>
        
        <div className={`collapsible-content ${isLegendCollapsed ? 'collapsed' : ''}`}>
          <ul className="legend-list">
            <li>
              <span className="legend-item pause-edit">
                <div className="pause-icon"></div>
              </span>
              <div className="legend-text">
                <div className="legend-title">Pause and Edit Network:</div>
                <div className="legend-description">Click Pause to modify the network during simulation</div>
              </div>
            </li>
            <li>
              <span className="legend-item green-flash">🟢</span>
              <div className="legend-text">
                <div className="legend-title">Green Flash:</div>
                <div className="legend-description">Appears when an LSP or Ping packet is accepted</div>
              </div>
            </li>
            <li>
              <span className="legend-item red-flash">🔴</span>
              <div className="legend-text">
                <div className="legend-title">Red Light:</div>
                <div className="legend-description">Appears when an LSP packet is rejected</div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel; 