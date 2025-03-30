import React, { useState, useEffect } from 'react';

const LSDBPanel = ({ lsdbData, routingTables, currentHighlight, simulationStatus, links }) => {
  const [selectedRouter, setSelectedRouter] = useState('');
  const [viewMode, setViewMode] = useState('lsdb'); // 'lsdb' or 'routingTable'
  const [flashingRow, setFlashingRow] = useState(null);
  
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
      
      // Clear the flashing after 800ms
      const timer = setTimeout(() => {
        setFlashingRow(null);
      }, 800);
      
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
  
  const renderRouterSelector = () => {
    const routerIds = Object.keys(viewMode === 'lsdb' ? lsdbData : routingTables).sort();
    
    if (routerIds.length === 0) {
      return <p>No router data available yet.</p>;
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
    if (!selectedRouter || !routingTables[selectedRouter]) {
      return <p>Select a router to view its Routing Table.</p>;
    }
    
    const routingTable = routingTables[selectedRouter];
    const entries = Object.values(routingTable);
    
    if (entries.length === 0) {
      return <p>No routing table entries for Router {selectedRouter}.</p>;
    }
    
    // Sort entries by destination
    const sortedEntries = [...entries].sort((a, b) => a.destination.localeCompare(b.destination));
    
    return (
      <>
        <h4>Routing Table for Router {selectedRouter}</h4>
        <table className="routing-table">
          <thead>
            <tr>
              <th>Destination</th>
              <th>Next Hop</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            {sortedEntries.map(entry => (
              <tr key={entry.destination}>
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
          disabled={simulationStatus !== 'completed'}
        >
          Routing Table
        </button>
      </div>
      
      {renderRouterSelector()}
      
      <div className="panel-content">
        {viewMode === 'lsdb' ? renderLSDB() : renderRoutingTable()}
      </div>
      
      {simulationStatus === 'running' && (
        <div className="simulation-status-message">
          <p>Watch as routers exchange topology information...</p>
        </div>
      )}
    </div>
  );
};

export default LSDBPanel; 