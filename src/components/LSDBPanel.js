import React, { useState, useEffect, useRef } from 'react';

const LSDBPanel = ({ lsdbData, routingTables, currentHighlight, simulationStatus, links, simulationLogs = [] }) => {
  const [selectedRouter, setSelectedRouter] = useState('');
  const [viewMode, setViewMode] = useState('lsdb'); // 'lsdb' or 'routingTable'
  const [flashingRow, setFlashingRow] = useState(null);
  const [showLogs, setShowLogs] = useState(false);
  const logsContentRef = useRef(null);
  
  // Helper to check if this entry should be highlighted
  const shouldHighlight = (routerId, nodeId) => {
    if (!flashingRow) return false;
    
    const isMatch = (
      flashingRow.routerId === routerId &&
      flashingRow.nodeId === nodeId
    );
    
    return isMatch;
  };
  
  // When current highlight changes, update the flashing row
  useEffect(() => {
    if (currentHighlight && currentHighlight.data && currentHighlight.data[0]) {
      // Only set flashing row, don't auto-select router
      setFlashingRow({
        routerId: currentHighlight.routerId,
        nodeId: currentHighlight.data[0],
        timestamp: currentHighlight.timestamp || Date.now()
      });
      
      // Clear the flashing after 500ms to match the updated timeouts elsewhere
      const timer = setTimeout(() => {
        setFlashingRow(null);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [currentHighlight]);
  
  // Effect to auto-select a router when data becomes available
  useEffect(() => {
    if (selectedRouter === '' && Object.keys(lsdbData).length > 0) {
      const firstRouter = Object.keys(lsdbData).sort()[0];
      setSelectedRouter(firstRouter);
    }
  }, [lsdbData, selectedRouter]);
  
  // Effect to switch to routing table view when simulation completes
  useEffect(() => {
    if (simulationStatus === 'completed') {
      console.log("Simulation completed, routing tables:", Object.keys(routingTables).length);
      
      // Check if we have routing tables and switch to that view
      if (Object.keys(routingTables).length > 0) {
        console.log("Switching to routing table view");
        setViewMode('routingTable');
        
        // Ensure a router is selected for the routing table view
        if (selectedRouter === '' || !routingTables[selectedRouter]) {
          const firstRouter = Object.keys(routingTables).sort()[0];
          if (firstRouter) {
            setSelectedRouter(firstRouter);
          }
        }
      }
    }
  }, [simulationStatus, routingTables, selectedRouter]);
  
  // Effect to automatically expand logs when simulation is running
  useEffect(() => {
    if (simulationStatus === 'running') {
      setShowLogs(true);
    }
  }, [simulationStatus]);
  
  // Effect to auto-scroll logs to the bottom when new logs are added
  useEffect(() => {
    if (showLogs && logsContentRef.current && simulationLogs.length > 0) {
      // Scroll to the bottom of the logs to see the newest entries
      logsContentRef.current.scrollTop = logsContentRef.current.scrollHeight;
    }
  }, [simulationLogs, showLogs]);
  
  const renderRouterSelector = () => {
    // Use lsdbData for dropdown when in LSDB view, otherwise use routingTables
    const dataSource = viewMode === 'lsdb' ? lsdbData : routingTables;
    const routerIds = Object.keys(dataSource).sort();
    
    if (routerIds.length === 0) {
      return <p>No router data available yet.</p>;
    }
    
    // If current selected router doesn't exist in this view, reset selection
    if (selectedRouter && !routerIds.includes(selectedRouter)) {
      setSelectedRouter(routerIds[0]);
    }
    
    return (
      <div className="router-selector">
        <label htmlFor="router-select">Select Router: </label>
        <select
          id="router-select"
          value={selectedRouter}
          onChange={(e) => setSelectedRouter(e.target.value)}
        >
          <option value="">-- Select Router --</option>
          {routerIds.map(id => (
            <option key={id} value={id}>Router {id}</option>
          ))}
        </select>
      </div>
    );
  };
  
  const renderLSDB = () => {
    if (!selectedRouter || !lsdbData[selectedRouter]) {
      return <p>Select a router to view its Link State Database.</p>;
    }
    
    const lsdb = lsdbData[selectedRouter];
    const entries = Object.entries(lsdb);
    
    if (entries.length === 0) {
      return <p>No LSDB entries for Router {selectedRouter}.</p>;
    }
    
    // Sort entries alphabetically by router ID
    const sortedEntries = [...entries].sort((a, b) => a[0].localeCompare(b[0]));
    
    // Helper function to get edge cost
    const getEdgeCost = (source, target) => {
      if (!links) return null;
      
      const link = links.find(l => 
        (l.source === source && l.target === target) || 
        (l.source === target && l.target === source)
      );
      
      return link ? link.cost : null;
    };
    
    return (
      <>
        <h4>Link State Database for Router {selectedRouter}</h4>
        <table className="lsdb-table">
          <thead>
            <tr>
              <th>Router ID</th>
              <th>Adjacent Nodes (with costs)</th>
            </tr>
          </thead>
          <tbody>
            {sortedEntries.map(([nodeId, adjacencies]) => (
              <tr 
                key={nodeId}
                className={shouldHighlight(selectedRouter, nodeId) ? 'highlight-change' : ''}
              >
                <td>{nodeId}</td>
                <td>
                  {Array.isArray(adjacencies) ? 
                    adjacencies.map(adj => {
                      const cost = getEdgeCost(nodeId, adj);
                      return (
                        <span key={adj}>
                          {adj}
                          {cost !== null && (
                            <span className="cost-badge">cost: {cost}</span>
                          )}
                          {' '}
                        </span>
                      );
                    })
                    : 
                    JSON.stringify(adjacencies)
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  };
  
  const renderRoutingTable = () => {
    if (!selectedRouter) {
      return <p>Select a router to view its Routing Table.</p>;
    }
    
    if (!routingTables[selectedRouter]) {
      return <p>No routing table available for Router {selectedRouter}.</p>;
    }
    
    const routingTable = routingTables[selectedRouter];
    const entries = Object.values(routingTable);
    
    if (entries.length === 0) {
      return <p>No routing table entries for Router {selectedRouter}.</p>;
    }
    
    // Sort entries: self first, then alphabetically by destination
    const sortedEntries = [...entries].sort((a, b) => {
      // Always put the entry for self at the top
      if (a.destination === selectedRouter) return -1;
      if (b.destination === selectedRouter) return 1;
      
      // Otherwise sort alphabetically by destination
      return a.destination.localeCompare(b.destination);
    });
    
    return (
      <>
        <h4>Routing Table for Router {selectedRouter}</h4>
        <div className="routing-table-description">
          <p>Shows the shortest path to each destination network.</p>
        </div>
        <table className="routing-table">
          <thead>
            <tr>
              <th>Destination</th>
              <th>Next Hop</th>
              <th>Total Cost</th>
            </tr>
          </thead>
          <tbody>
            {sortedEntries.map(entry => (
              <tr key={entry.destination} className={entry.destination === selectedRouter ? 'self-entry' : ''}>
                <td>{entry.destination}</td>
                <td>{entry.nextHop}</td>
                <td>{entry.cost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  };
  
  const renderContent = () => {
    if (viewMode === 'lsdb') {
      return renderLSDB();
    } else if (viewMode === 'routingTable') {
      return renderRoutingTable();
    }
  };
  
  const renderSimulationLogs = () => {
    const getCurrentStep = () => {
      if (simulationLogs.length === 0) return null;
      
      // Find the last step indicator
      for (let i = simulationLogs.length - 1; i >= 0; i--) {
        const log = simulationLogs[i];
        if (log.includes('=== STEP ')) {
          const match = log.match(/=== STEP (\d+) ===/);
          if (match) return parseInt(match[1]);
        } else if (log.includes('=== BEGIN HELLO PACKETS ===')) {
          return 'Hello';
        }
      }
      return null;
    };
    
    const currentStep = getCurrentStep();
    
    return (
      <div className="simulation-logs">
        <div className="logs-header" onClick={() => setShowLogs(!showLogs)}>
          <h4>
            <span className="toggle-icon">{showLogs ? '▼' : '▶'}</span> 
            Simulation Logs 
            {currentStep && <span className="current-step-indicator">(Current: {currentStep === 'Hello' ? 'Hello Packets' : `Step ${currentStep}`})</span>}
          </h4>
        </div>
        
        {showLogs && (
          <div className="logs-content" ref={logsContentRef}>
            {simulationLogs.length === 0 ? (
              <p className="no-logs">No logs available yet.</p>
            ) : (
              <ul className="logs-list">
                {simulationLogs.map((log, index) => {
                  const isStepHeader = log.startsWith('===');
                  
                  return (
                    <li 
                      key={index} 
                      className={`log-item ${isStepHeader ? 'step-header' : ''}`}
                    >
                      {log}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="lsdb-panel">
      <h3>{
        simulationStatus === 'running' ? 'Network Simulation in Progress' :
        simulationStatus === 'completed' ? 'Simulation Complete' :
        simulationStatus === 'paused' ? 'Simulation Paused' :
        'Router Information'
      }</h3>
      
      <div className="view-mode-selector">
        <button
          className={viewMode === 'lsdb' ? 'active' : ''}
          onClick={() => setViewMode('lsdb')}
          disabled={simulationStatus !== 'completed' && viewMode !== 'lsdb'}
        >
          Link State Database
        </button>
        <button
          className={viewMode === 'routingTable' ? 'active' : ''}
          onClick={() => setViewMode('routingTable')}
          disabled={simulationStatus !== 'completed' || Object.keys(routingTables).length === 0}
        >
          Routing Table
        </button>
      </div>
      
      {renderRouterSelector()}
      
      <div className="panel-content">
        {renderContent()}
      </div>
      
      {simulationStatus !== 'idle' && renderSimulationLogs()}
    </div>
  );
};

export default LSDBPanel; 