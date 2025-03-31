import React, { useState, useEffect, useRef } from 'react';

const LSDBPanel = ({ lsdbData, routingTables, currentHighlight, simulationStatus, links, simulationLogs = [] }) => {
  const [selectedRouter, setSelectedRouter] = useState('');
  const [viewMode, setViewMode] = useState('lsdb'); // Always default to LSDB view
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
  
  // No longer automatically switch to routing table view when simulation completes
  useEffect(() => {
    if (simulationStatus === 'completed') {
      console.log("Simulation completed, routing tables:", Object.keys(routingTables).length);
      
      // Only ensure a router is selected if needed, but don't change viewMode
      if (selectedRouter === '' || (!lsdbData[selectedRouter] && !routingTables[selectedRouter])) {
        const availableRouters = Object.keys(viewMode === 'lsdb' ? lsdbData : routingTables).sort();
        if (availableRouters.length > 0) {
          setSelectedRouter(availableRouters[0]);
        }
      }
    }
  }, [simulationStatus, routingTables, lsdbData, selectedRouter, viewMode]);
  
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
        <label htmlFor="router-select">Router: </label>
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
  
  const renderViewModeSelector = () => {
    return (
      <div className="view-mode-selector">
        <button 
          className={viewMode === 'lsdb' ? 'active' : ''}
          onClick={() => setViewMode('lsdb')}
        >
          Link State Database
        </button>
        <button 
          className={viewMode === 'routingTable' ? 'active' : ''}
          onClick={() => setViewMode('routingTable')}
          disabled={Object.keys(routingTables).length === 0}
        >
          Routing Table
        </button>
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
      <div className="lsdb-table-container">
        <h4>Link State Database for Router {selectedRouter}</h4>
        <table className="lsdb-table">
          <thead>
            <tr>
              <th>Router</th>
              <th>Adjacent Nodes</th>
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
                        <span key={adj} className="adjacency-entry">
                          {adj}{cost !== null && `:${cost}`}
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
      </div>
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
      <div className="routing-table-container">
        <h4>Routing Table for Router {selectedRouter}</h4>
        <table className="routing-table">
          <thead>
            <tr>
              <th>Dest.</th>
              <th>Next</th>
              <th>Cost</th>
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
      </div>
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
    if (simulationLogs.length === 0) {
      return <p className="no-logs">No logs available yet.</p>;
    }
    
    // Get the last 3 logs or less
    const latestLogs = simulationLogs.slice(-3);
    
    return (
      <div className="simulation-logs-compact">
        <h4>Latest Logs</h4>
        <ul className="logs-list-compact">
          {latestLogs.map((log, index) => {
            const isStepHeader = log.startsWith('---');
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
        {simulationLogs.length > 3 && (
          <div className="more-logs">
            <button onClick={() => setShowLogs(true)}>View All Logs...</button>
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="lsdb-panel">
      <div className="database-section">
        {renderViewModeSelector()}
        {renderRouterSelector()}
        {renderContent()}
      </div>
      
      <div className="logs-container">
        {/* Show only 3 latest logs by default */}
        {!showLogs && renderSimulationLogs()}
        
        {/* Show the full logs view when expanded */}
        {showLogs && (
          <div className="full-logs">
            <div className="logs-header">
              <h4>Simulation Logs</h4>
              <button onClick={() => setShowLogs(false)} className="close-logs">
                Close
              </button>
            </div>
            <div className="logs-content" ref={logsContentRef}>
              <ul className="logs-list">
                {simulationLogs.map((log, index) => {
                  const isStepHeader = log.startsWith('---');
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LSDBPanel; 