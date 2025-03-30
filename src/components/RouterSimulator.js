import React, { useState, useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import RouterNode from './RouterNode';
import RouterLink from './RouterLink';
import LSPPacket from './LSPPacket';
import ControlPanel from './ControlPanel';
import LSDBPanel from './LSDBPanel';
import LinkCostModal from './LinkCostModal';
import { runSimulation } from '../utils/simulationUtils';

// Register the MotionPath plugin
gsap.registerPlugin(MotionPathPlugin);

const RouterSimulator = () => {
  const [routers, setRouters] = useState([]);
  const [links, setLinks] = useState([]);
  const [selectedRouters, setSelectedRouters] = useState([]);
  const [connectMode, setConnectMode] = useState(false);
  const [showLinkCostModal, setShowLinkCostModal] = useState(false);
  const [lsdbData, setLsdbData] = useState({});
  const [routingTables, setRoutingTables] = useState({});
  const [simulationStatus, setSimulationStatus] = useState('idle'); // idle, running, paused, completed
  const [animationSpeed, setAnimationSpeed] = useState(0.5);
  const [packets, setPackets] = useState([]);
  const [currentHighlight, setCurrentHighlight] = useState(null);
  const [currentStep, setCurrentStep] = useState(0); // Track current simulation step
  const [processedLSPs, setProcessedLSPs] = useState({}); // Track which LSPs each router has processed
  
  const stageRef = useRef(null);
  const nextRouterId = useRef(65); // ASCII for 'A'
  
  // Handle router dragging from the toolbox
  const handleRouterDrop = (e) => {
    if (simulationStatus === 'running') return;
    
    const stageRect = stageRef.current.getBoundingClientRect();
    const x = e.clientX - stageRect.left;
    const y = e.clientY - stageRect.top;
    
    // Create new router with unique ID
    const newRouter = {
      id: String.fromCharCode(nextRouterId.current),
      x,
      y,
      lsdb: {},
      routingTable: {}
    };
    
    setRouters([...routers, newRouter]);
    nextRouterId.current += 1;
  };
  
  // Handle router dragging on the stage
  const handleRouterDrag = (id, x, y) => {
    if (simulationStatus === 'running') return;
    
    const updatedRouters = routers.map(router => 
      router.id === id ? { ...router, x, y } : router
    );
    setRouters(updatedRouters);
  };
  
  // Handle router click - used for creating links
  const handleRouterClick = (id) => {
    if (!connectMode || simulationStatus === 'running') return;
    
    if (selectedRouters.length === 0) {
      // First router selected
      setSelectedRouters([id]);
    } else if (selectedRouters[0] !== id) {
      // Second router selected, show link cost modal
      setSelectedRouters([...selectedRouters, id]);
      setShowLinkCostModal(true);
    }
  };
  
  // Add a link between routers with a cost
  const handleAddLink = (cost) => {
    const [sourceId, targetId] = selectedRouters;
    const source = routers.find(r => r.id === sourceId);
    const target = routers.find(r => r.id === targetId);
    
    const newLink = {
      id: `${sourceId}-${targetId}`,
      source: sourceId,
      target: targetId,
      cost: parseInt(cost)
    };
    
    setLinks([...links, newLink]);
    setSelectedRouters([]);
    setShowLinkCostModal(false);
    setConnectMode(false);
  };
  
  // Handle simulation start
  const handleStartSimulation = () => {
    if (routers.length < 2 || links.length === 0) return;
    
    // Clear any existing GSAP animations first
    gsap.globalTimeline.clear();
    
    setSimulationStatus('running');
    
    // Convert our links to the format expected by the flooding algorithm
    const edgesForSimulation = links.map(link => [link.source, link.target, link.cost]);
    
    // Reset any previous simulation data
    setLsdbData({});
    setRoutingTables({});
    setPackets([]);
    setProcessedLSPs({});
    
    // Start with empty LSDBs - they will be populated when Hello packets are received
    const initialLSDB = {};
    const initialProcessedLSPs = {};
    
    routers.forEach(router => {
      // Initialize empty LSDB for each router
      initialLSDB[router.id] = {};
      
      // Initialize empty processed LSPs set for each router
      initialProcessedLSPs[router.id] = new Set();
    });
    
    setLsdbData(initialLSDB);
    setProcessedLSPs(initialProcessedLSPs);
    
    // Save current animation speed for consistent use
    const currentSpeed = animationSpeed;
    
    // Run the simulation
    runSimulation(edgesForSimulation, routers[0].id, currentSpeed, 
      (animationData) => handleAnimationStep(animationData)
    );
    
    // Set the GSAP timeline speed to match the selected animation speed
    gsap.globalTimeline.timeScale(currentSpeed);
  };
  
  // Handle a step in the animation
  const handleAnimationStep = (data) => {
    // Update current step if provided
    if (data.step !== undefined) {
      setCurrentStep(data.step);
    }
    
    if (data.type === 'packet') {
      // Animate packet moving from source to target
      // In the flooding algorithm, LSDB updates happen when packets are received
      // We'll handle the LSDB updates in the onComplete callback of the animation
      animatePacket(
        data.from, 
        data.to, 
        data.packet, 
        data.packetType, 
        data.animationDuration,
        data.onComplete // Pass the onComplete callback to track step completion
      );
    } else if (data.type === 'update') {
      // This is for explicit LSDB updates not triggered by packets
      // In the flooding algorithm, these only happen when a node processes
      // an LSP it hasn't seen before, which is handled in the animation callback
      // So these are rare and only used for special cases
      updateLSDB(data.router, data.data);
      highlightChange(data.router, data.data);
    } else if (data.type === 'completed') {
      // Simulation completed - now calculate routing tables using Dijkstra's
      setSimulationStatus('completed');
      calculateRoutingTables();
    }
  };
  
  // Animate a packet moving from source to target
  const animatePacket = (fromId, toId, packetData, packetType = 'lsp', animationDuration = 1000, externalCallback = null) => {
    const fromRouter = routers.find(r => r.id === fromId);
    const toRouter = routers.find(r => r.id === toId);
    
    if (!fromRouter || !toRouter) {
      // If routers not found, still call the callback to maintain step progression
      if (externalCallback) externalCallback();
      return;
    }
    
    // Calculate center points of routers
    const fromX = fromRouter.x + 40; // Router center (80px width)
    const fromY = fromRouter.y + 40; // Router center (80px height)
    const toX = toRouter.x + 40;
    const toY = toRouter.y + 40;
    
    // Use fixed packet size for consistency
    const packetSize = 45;
    const halfPacketSize = packetSize / 2;
    
    // Create packet with unique ID based on source, target and timestamp
    const timestamp = Date.now();
    const packetId = `packet-${fromId}-${toId}-${timestamp}-${Math.floor(Math.random() * 1000)}`;
    
    // Extract data from packet according to the format in flooding.js
    let nodeId = null;
    let adjList = [];
    
    if (packetType === 'lsp' && typeof packetData === 'string') {
      // Extract from a formatted string like "LSPA: ["B","C"]"
      const lspMatch = packetData.match(/LSP([A-Z]): (\[[^\]]+\])/);
      if (lspMatch) {
        nodeId = lspMatch[1];
        try {
          adjList = JSON.parse(lspMatch[2]);
        } catch (e) {
          console.error("Error parsing LSP data:", e);
        }
      }
    }
    
    const newPacket = {
      id: packetId,
      from: fromId,
      to: toId,
      data: nodeId && adjList.length ? [nodeId, adjList] : packetData, // Use parsed data if available
      type: packetType,
      x: fromX,
      y: fromY,
      size: packetSize
    };
    
    // Add to state
    setPackets(prev => [...prev, newPacket]);
    
    // Wait for DOM update
    setTimeout(() => {
      // Find packet element
      const packetEl = document.getElementById(packetId);
      if (!packetEl) {
        // If packet element not found, still call the callback to maintain step progression
        if (externalCallback) externalCallback();
        return;
      }
      
      // Use fixed duration from animationDuration parameter
      // This ensures all packets travel at the same speed regardless of distance
      const durationInSeconds = animationDuration / 1000;
      
      // Animate directly to target with smoother easing
      gsap.to(packetEl, {
        left: `${toX - halfPacketSize}px`, // Adjust for packet size
        top: `${toY - halfPacketSize}px`,  // Adjust for packet size
        duration: durationInSeconds,
        ease: "power1.inOut", // Linear with slight ease at ends
        onComplete: () => {
          // Remove packet
          setPackets(prev => prev.filter(p => p.id !== packetId));
          
          // Update LSDB based on packet type
          if (packetType === 'lsp') {
            // For LSP packets, update the LSDB with the link state information
            let updateData;
            
            if (Array.isArray(newPacket.data)) {
              // If we already parsed the data correctly in the packet creation
              updateData = newPacket.data;
            } else if (Array.isArray(packetData)) {
              // If the data was provided as an array directly from simulationUtils
              updateData = packetData;
            }
            
            if (updateData && updateData.length === 2) {
              updateLSDB(toId, updateData);
              highlightChange(toId, updateData);
            }
          } else if (packetType === 'hello') {
            // For Hello packets, update the LSDB to note the neighbor connection
            // When a router receives a Hello, it should record that router as a neighbor
            updateHelloPacket(fromId, toId);
          }
          
          // Call external callback if provided to signal completion for step sequencing
          if (externalCallback) externalCallback();
        }
      });
    }, 50);
  };
  
  // Process a Hello packet from one router to another
  const updateHelloPacket = (fromId, toId) => {
    // When a router receives a Hello packet, it adds the sender as a neighbor
    setLsdbData(prev => {
      const updated = JSON.parse(JSON.stringify(prev));
      
      // Ensure target router has an entry in LSDB
      if (!updated[toId]) {
        updated[toId] = {};
      }
      
      // If this router doesn't have an entry for itself, create one
      if (!updated[toId][toId]) {
        updated[toId][toId] = [];
      }
      
      // Add the sender to the target's list of neighbors
      // Use a Set temporarily to avoid duplicates, then convert back to array
      const neighbors = new Set(updated[toId][toId]);
      neighbors.add(fromId);
      updated[toId][toId] = Array.from(neighbors).sort();
      
      // Similarly, the source also learns that the target is a neighbor
      if (!updated[fromId]) {
        updated[fromId] = {};
      }
      
      if (!updated[fromId][fromId]) {
        updated[fromId][fromId] = [];
      }
      
      const sourceNeighbors = new Set(updated[fromId][fromId]);
      sourceNeighbors.add(toId);
      updated[fromId][fromId] = Array.from(sourceNeighbors).sort();
      
      // Add to processed LSPs 
      setProcessedLSPs(lspPrev => {
        const lspUpdated = { ...lspPrev };
        
        if (!lspUpdated[toId]) {
          lspUpdated[toId] = new Set();
        }
        
        if (!lspUpdated[fromId]) {
          lspUpdated[fromId] = new Set();
        }
        
        return lspUpdated;
      });
      
      return updated;
    });
    
    // Highlight the change
    highlightChange(toId, [toId, [fromId]]);
  };
  
  // Update a router's LSDB with new data
  const updateLSDB = (routerId, data) => {
    if (!data || !Array.isArray(data) || data.length < 2) {
      console.error("Invalid LSDB update data:", data);
      return;
    }
    
    const [nodeId, adjList] = data;
    
    if (!nodeId) {
      console.error("Missing nodeId in LSDB update");
      return;
    }
    
    // Create a unique key for this LSP
    const lspKey = `LSP${nodeId}: ${JSON.stringify(adjList)}`;
    
    // Check if this router has already processed this LSP
    setProcessedLSPs(prev => {
      const updated = { ...prev };
      
      // Initialize the set if it doesn't exist
      if (!updated[routerId]) {
        updated[routerId] = new Set();
      }
      
      // If router has already processed this LSP, skip the update
      if (updated[routerId].has(lspKey)) {
        console.log(`Router ${routerId} has already processed ${lspKey}, skipping update`);
        return updated;
      }
      
      // Otherwise mark it as processed
      updated[routerId].add(lspKey);
      
      // And update the LSDB
      setLsdbData(lsdbPrev => {
        // Make a deep copy of the previous state
        const lsdbUpdated = JSON.parse(JSON.stringify(lsdbPrev));
        
        // Ensure the router entry exists
        if (!lsdbUpdated[routerId]) {
          lsdbUpdated[routerId] = {};
        }
        
        // Update with the new adjacency list
        lsdbUpdated[routerId][nodeId] = adjList;
        
        console.log(`Updated LSDB for Router ${routerId}, added/updated node ${nodeId} with adj list:`, adjList);
        
        return lsdbUpdated;
      });
      
      return updated;
    });
  };
  
  // Highlight a change in the LSDB
  const highlightChange = (routerId, data) => {
    if (!data || !Array.isArray(data) || !data[0]) {
      console.error("Invalid highlight data:", data);
      return;
    }
    
    // Set the highlight with the router ID and data
    setCurrentHighlight({ 
      routerId, 
      data,
      timestamp: Date.now() // Add timestamp to ensure state update is detected
    });
    
    // Clear the highlight after 800ms
    setTimeout(() => {
      setCurrentHighlight(null);
    }, 800);
  };
  
  // Calculate routing tables for all routers
  const calculateRoutingTables = () => {
    const tables = {};
    
    routers.forEach(router => {
      tables[router.id] = calculateDijkstra(router.id);
    });
    
    setRoutingTables(tables);
  };
  
  // Dijkstra's algorithm for calculating shortest paths
  const calculateDijkstra = (startId) => {
    const distances = {};
    const previous = {};
    const unvisited = new Set();
    
    // Initialize data
    routers.forEach(router => {
      distances[router.id] = Infinity;
      previous[router.id] = null;
      unvisited.add(router.id);
    });
    
    distances[startId] = 0;
    
    while (unvisited.size > 0) {
      // Find the unvisited node with the smallest distance
      let current = null;
      let smallestDistance = Infinity;
      
      for (const id of unvisited) {
        if (distances[id] < smallestDistance) {
          smallestDistance = distances[id];
          current = id;
        }
      }
      
      // If we can't find a node, we're done
      if (current === null) break;
      
      // Remove the current node from unvisited
      unvisited.delete(current);
      
      // Skip if no LSDB data for this router
      if (!lsdbData[current]) continue;
      
      // Process neighbors
      for (const [neighbor, adjNodes] of Object.entries(lsdbData[current])) {
        // Skip if neighbor is the same as current
        if (neighbor === current) continue;
        
        // Find the cost from current to neighbor
        const link = links.find(l => 
          (l.source === current && l.target === neighbor) || 
          (l.source === neighbor && l.target === current)
        );
        
        if (link) {
          const cost = link.cost;
          const newDistance = distances[current] + cost;
          
          if (newDistance < distances[neighbor]) {
            distances[neighbor] = newDistance;
            previous[neighbor] = current;
          }
        }
      }
    }
    
    // Build the routing table
    const routingTable = {};
    
    routers.forEach(router => {
      if (router.id === startId) return;
      
      let path = [];
      let current = router.id;
      
      while (current !== null) {
        path.unshift(current);
        current = previous[current];
      }
      
      if (path.length > 1) {
        const nextHop = path[1]; // The next hop is the second node in the path
        routingTable[router.id] = {
          destination: router.id,
          nextHop,
          cost: distances[router.id]
        };
      }
    });
    
    return routingTable;
  };
  
  // Handle simulation pause
  const handlePauseSimulation = () => {
    setSimulationStatus('paused');
    // Pause GSAP animations
    gsap.globalTimeline.pause();
  };
  
  // Handle simulation resume
  const handleResumeSimulation = () => {
    setSimulationStatus('running');
    // Resume GSAP animations with current speed
    gsap.globalTimeline.play();
    gsap.globalTimeline.timeScale(animationSpeed);
  };
  
  // Handle simulation end
  const handleEndSimulation = () => {
    setSimulationStatus('idle');
    // Clear all animations
    gsap.globalTimeline.clear();
    setPackets([]);
    setCurrentStep(0);
  };
  
  // Handle simulation reset - keeps routers and links but resets simulation data
  const handleResetSimulation = () => {
    // Clear all animations first
    gsap.globalTimeline.clear();
    
    // Reset simulation data, but keep routers and links
    setLsdbData({});
    setRoutingTables({});
    setProcessedLSPs({});
    setPackets([]);
    setCurrentStep(0);
    setCurrentHighlight(null);
    
    // Reset to idle state
    setSimulationStatus('idle');
    
    // Reset animation speed to default
    setAnimationSpeed(0.5);
  };
  
  // Handle speed change
  const handleSpeedChange = (speed) => {
    setAnimationSpeed(speed);
    
    // Update existing animations
    if (simulationStatus === 'running') {
      gsap.globalTimeline.timeScale(speed);
    }
  };
  
  // Toggle connect mode
  const toggleConnectMode = () => {
    setConnectMode(!connectMode);
    setSelectedRouters([]);
  };
  
  return (
    <div className="simulator-wrapper">
      <div className="toolbox">
        <div
          className="router-template"
          draggable
          onDragEnd={handleRouterDrop}
        >
          Drag to add Router
        </div>
        <button 
          onClick={toggleConnectMode}
          className={connectMode ? 'active' : ''}
          disabled={simulationStatus === 'running'}
        >
          {connectMode ? 'Cancel Connect' : 'Connect Routers'}
        </button>
      </div>
      
      <div className="simulator-container">
        <div className="left-panel">
          <LSDBPanel 
            lsdbData={lsdbData}
            routingTables={routingTables}
            currentHighlight={currentHighlight}
            simulationStatus={simulationStatus}
            links={links}
          />
        </div>
        
        <div 
          className="simulator-stage" 
          ref={stageRef}
        >
          {/* Render router nodes */}
          {routers.map(router => (
            <RouterNode
              key={router.id}
              id={router.id}
              x={router.x}
              y={router.y}
              onDrag={handleRouterDrag}
              onClick={handleRouterClick}
              isSelected={selectedRouters.includes(router.id)}
              disabled={simulationStatus === 'running'}
            />
          ))}
          
          {/* Render links between routers */}
          {links.map(link => {
            const source = routers.find(r => r.id === link.source);
            const target = routers.find(r => r.id === link.target);
            return (
              <RouterLink
                key={link.id}
                source={source}
                target={target}
                cost={link.cost}
              />
            );
          })}
          
          {/* Render animation packets */}
          {packets.map(packet => (
            <LSPPacket
              key={packet.id}
              id={packet.id}
              x={packet.x}
              y={packet.y}
              data={packet.data}
              type={packet.type}
              size={packet.size}
            />
          ))}
        </div>
        
        <div className="right-panel">
          <ControlPanel
            onStartSimulation={handleStartSimulation}
            onPauseSimulation={handlePauseSimulation}
            onResumeSimulation={handleResumeSimulation}
            onEndSimulation={handleEndSimulation}
            onResetSimulation={handleResetSimulation}
            onSpeedChange={handleSpeedChange}
            simulationStatus={simulationStatus}
            speed={animationSpeed}
            disabled={routers.length < 2 || links.length === 0}
            currentStep={currentStep}
          />
        </div>
      </div>
      
      {/* Link cost modal */}
      {showLinkCostModal && (
        <LinkCostModal
          onAddLink={handleAddLink}
          onCancel={() => {
            setShowLinkCostModal(false);
            setSelectedRouters([]);
            setConnectMode(false);
          }}
        />
      )}
    </div>
  );
};

export default RouterSimulator; 