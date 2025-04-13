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
  const [isStepsGuideCollapsed, setIsStepsGuideCollapsed] = useState(false);
  
  const handleSpeedChange = (e) => {
    const newSpeed = parseFloat(e.target.value);
    onSpeedChange(newSpeed);
  };
  
  const toggleInstructions = () => {
    setIsInstructionsCollapsed(!isInstructionsCollapsed);
  };
  
  const toggleStepsGuide = () => {
    setIsStepsGuideCollapsed(!isStepsGuideCollapsed);
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
      
      {isRunning && (
        <div className="panel-section steps-guide">
          <div 
            className={`collapsible-header ${isStepsGuideCollapsed ? 'collapsed' : ''}`}
            onClick={toggleStepsGuide}
          >
            <h4>Simulation Steps Guide</h4>
            <span className="collapsible-icon">
              {isStepsGuideCollapsed ? '►' : '▼'}
            </span>
          </div>
          
          <div className={`collapsible-content ${isStepsGuideCollapsed ? 'collapsed' : ''}`}>
            <ul className="steps-guide-list">
              <li><strong>Step 1:</strong> Routers discover neighbors via Hello packets</li>
              <li><strong>Step 2-3:</strong> Routers create and flood LSPs with neighbor information</li>
              <li><strong>Step 4+:</strong> LSPs are forwarded to all routers to build complete topology</li>
              <li><strong>Final Steps:</strong> Routing tables are calculated using Dijkstra's algorithm</li>
            </ul>
            <div className="step-tip">
              <p>💡 After link deletions, routers will flood new LSPs with incremented sequence numbers.</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="panel-section instructions">
        <div 
          className={`collapsible-header ${isInstructionsCollapsed ? 'collapsed' : ''}`}
          onClick={toggleInstructions}
        >
          <h4>How to Use</h4>
          <span className="collapsible-icon">
            {isInstructionsCollapsed ? '►' : '▼'}
          </span>
        </div>
        
        <div className={`collapsible-content ${isInstructionsCollapsed ? 'collapsed' : ''}`}>
          <ul className="instructions-list">
            <li><strong>Setup:</strong> Drag routers to position them on the stage</li>
            <li><strong>Connect:</strong> Click "Connect Routers" button, then click two routers</li>
            <li><strong>Start:</strong> Click "Start Simulation" to begin the routing protocol</li>
            <li><strong>Next Steps:</strong> Click "Next Step" repeatedly to progress through the simulation</li>
            <li><strong>Editing:</strong> Pause simulation, then use "Select" mode to delete elements</li>
            <li><strong>View Data:</strong> Use the right panel to view LSDB and routing tables</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel; 