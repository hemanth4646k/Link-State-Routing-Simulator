import React, { useState, useRef, useEffect, useCallback } from 'react';
import { gsap } from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import RouterNode from './RouterNode';
import RouterLink from './RouterLink';
import LSPPacket from './LSPPacket';
import ControlPanel from './ControlPanel';
import LSDBPanel from './LSDBPanel';
import LinkCostModal from './LinkCostModal';
import CustomPacketModal from './CustomPacketModal';
import ThreeScene from './ThreeScene';
import { runSimulation } from '../utils/simulationUtils';
import Tutorial from './Tutorial';

// Register the MotionPath plugin
gsap.registerPlugin(MotionPathPlugin);

const RouterSimulator = () => {
  const [routers, setRouters] = useState([]);
  const [links, setLinks] = useState([]);
  const [selectedRouters, setSelectedRouters] = useState([]);
  const [connectMode, setConnectMode] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedElements, setSelectedElements] = useState({routers: [], links: []});
  const [showLinkCostModal, setShowLinkCostModal] = useState(false);
  const [showCustomPacketModal, setShowCustomPacketModal] = useState(false); // New state for custom packet modal
  const [lsdbData, setLsdbData] = useState({});
  const [routingTables, setRoutingTables] = useState({});
  const [simulationStatus, setSimulationStatus] = useState('idle'); // idle, running, paused, completed
  const [animationSpeed, setAnimationSpeed] = useState(0.5);
  const [packets, setPackets] = useState([]);
  const [currentHighlight, setCurrentHighlight] = useState(null);
  const [currentStep, setCurrentStep] = useState(0); // Track current simulation step
  const [processedLSPs, setProcessedLSPs] = useState({}); // Track which LSPs each router has processed
  const [simulationLogs, setSimulationLogs] = useState([]); // Store logs from flooding.js
  const [routerSequenceNumbers, setRouterSequenceNumbers] = useState({}); // Track sequence numbers for each router's LSPs
  const [pendingLSPForwards, setPendingLSPForwards] = useState([]); // Queue of LSPs to be forwarded in the next step
  const [isPaused, setIsPaused] = useState(false);
  const [animationInProgress, setAnimationInProgress] = useState(false);
  // Add a new state variable to track routers that have recently had sequence numbers incremented due to topology changes
  const [recentlyIncrementedSequences, setRecentlyIncrementedSequences] = useState(new Set());
  const [showTutorial, setShowTutorial] = useState(true); // Always start with tutorial visible
  // First, add a new state for moveMode around line 40 where other state variables are defined
  const [moveMode, setMoveMode] = useState(false);
  
  const [isDraggingRouter, setIsDraggingRouter] = useState(false);
  const [dropIndicatorPos, setDropIndicatorPos] = useState({ x: 0, y: 0 });
  
  const stageRef = useRef(null);
  const nextRouterId = useRef(65); // ASCII for 'A'
  
  // Add new state for panel visibility
  const [leftPanelVisible, setLeftPanelVisible] = useState(true);
  const [rightPanelVisible, setRightPanelVisible] = useState(true);
  
  // Handle router dragging from the toolbox
  const handleRouterDrop = (e) => {
    if (simulationStatus === 'running') return;
    
    const stageRect = stageRef.current.getBoundingClientRect();
    const x = e.clientX - stageRect.left;
    const y = e.clientY - stageRect.top;
    
    // Account for the coordinate conversion that happens in ThreeScene
    // This ensures the router is placed exactly where it's dropped
    const scale = 30;
    const offsetX = 500;
    const offsetY = 500;
    
    // Apply the inverse of the ThreeScene conversion
    const correctedX = ((x - offsetX) / scale) * scale + offsetX;
    const correctedY = ((y - offsetY) / scale) * scale + offsetY;
    
    // Create new router with unique ID
    const newRouter = {
      id: String.fromCharCode(nextRouterId.current),
      x: correctedX,
      y: correctedY,
      lsdb: {},
      routingTable: {}
    };
    
    setRouters([...routers, newRouter]);
    nextRouterId.current += 1;
    
    // Reset dragging state
    setIsDraggingRouter(false);
  };
  
  // Handle router drag start from toolbox
  const handleRouterDragStart = (e) => {
    if (simulationStatus === 'running') return;
    setIsDraggingRouter(true);
  };
  
  // Handle router drag over the stage
  const handleRouterDragOver = (e) => {
    if (!isDraggingRouter || simulationStatus === 'running') return;
    e.preventDefault(); // Necessary to allow dropping
    
    const stageRect = stageRef.current.getBoundingClientRect();
    const x = e.clientX - stageRect.left;
    const y = e.clientY - stageRect.top;
    
    setDropIndicatorPos({ x, y });
  };
  
  // Handle router drag end (for cases where the drop is outside the target area)
  const handleRouterDragEnd = () => {
    setIsDraggingRouter(false);
  };
  
  // Handle router dragging on the stage
  const handleRouterDrag = (id, x, y) => {
    // Don't allow dragging during simulation
    if (simulationStatus === 'running') return; 
    
    // Don't allow dragging in selection (delete) mode
    if (selectionMode) return;
    
    // In move mode, we want to allow dragging the router that was clicked
    // The router will be selected in ThreeScene before dragging starts
    // So we'll make sure it's in the selected elements if it's not already
    if (moveMode) {
      if (!selectedElements.routers.includes(id)) {
        // Add the router to selected elements if it's not already there
        setSelectedElements(prev => ({
          ...prev,
          routers: [...prev.routers, id]
        }));
      }
    }
    
    // Ensure we have a valid stage reference
    if (!stageRef.current) return;
    
    // Get stage dimensions to keep routers within bounds
    const stageRect = stageRef.current.getBoundingClientRect();
    const stageWidth = stageRect.width;
    const stageHeight = stageRect.height;
    
    // Bounds checking: allow some room around edges
    const padding = 50;
    const minX = -padding;
    const minY = -padding;
    const maxX = stageWidth + padding;
    const maxY = stageHeight + padding;
    
    // Constrain coordinates to stage boundaries
    const boundedX = Math.max(minX, Math.min(maxX, x));
    const boundedY = Math.max(minY, Math.min(maxY, y));
    
    // Update router position in state
    setRouters(prev => {
      const updatedRouters = prev.map(router => 
        router.id === id 
          ? { ...router, x: boundedX, y: boundedY } 
          : router
      );
      
      return updatedRouters;
    });
  };
  
  // Handle router click - used for creating links or selecting elements
  const handleRouterClick = (id) => {
    // If in simulation and not paused, don't allow selection
    if (simulationStatus === 'running' && !isPaused) return;
    
    if (connectMode) {
      if (selectedRouters.length === 0) {
        // First router selected for connection
        setSelectedRouters([id]);
      } else if (selectedRouters[0] !== id) {
        // Second router selected, show link cost modal
        setSelectedRouters([...selectedRouters, id]);
        setShowLinkCostModal(true);
      }
    } else if (selectionMode || moveMode) {
      // Toggle selection of this router
      setSelectedElements(prev => {
        const isSelected = prev.routers.includes(id);
        return {
          ...prev,
          routers: isSelected 
            ? prev.routers.filter(routerId => routerId !== id) 
            : [...prev.routers, id]
        };
      });
    }
  };
  
  // Handle link click for selection
  const handleLinkClick = (linkId) => {
    if (simulationStatus === 'running' || connectMode || moveMode) return;
    
    if (selectionMode) {
      setSelectedElements(prev => {
        const isSelected = prev.links.includes(linkId);
        return {
          ...prev,
          links: isSelected 
            ? prev.links.filter(id => id !== linkId) 
            : [...prev.links, linkId]
        };
      });
    }
  };
  
  // Toggle selection mode
  const toggleSelectionMode = () => {
    if (selectionMode) {
      // If turning off selection mode, clear selected elements
      setSelectionMode(false);
      setSelectedElements({routers: [], links: []});
    } else {
      // If turning on selection mode, turn off connect mode
      setSelectionMode(true);
      setConnectMode(false);
      setSelectedRouters([]);
    }
  };
  
  // Delete selected elements
  const deleteSelectedElements = () => {
    // DEBUG: Log function entry
    console.log("===== DELETE SELECTED ELEMENTS FUNCTION STARTED =====");
    console.log("Current simulation status:", simulationStatus);
    console.log("Selected elements:", selectedElements);
    
    if (simulationStatus === 'idle') {
      console.log("Handling deletion during IDLE state");
      // Regular delete during non-simulation mode
      const { routers: selectedRouterIds, links: selectedLinkIds } = selectedElements;
      
      // List of routers that will need to flood new LSPs
      const routersNeedingLSPFlood = new Set();
      
      // Delete selected links
      if (selectedLinkIds.length > 0) {
        console.log("Deleting links:", selectedLinkIds);
        console.log("Current links before deletion:", links);
        
        // For each deleted link, identify the routers that need to send new LSPs
        const affectedLinks = links.filter(link => selectedLinkIds.includes(link.id));
        
        // Store the endpoints of each link so we can trigger LSP flooding
        affectedLinks.forEach(link => {
          routersNeedingLSPFlood.add(link.source);
          routersNeedingLSPFlood.add(link.target);
        });
        
        setLinks(prev => {
          const newLinks = prev.filter(link => !selectedLinkIds.includes(link.id));
          console.log("Links after deletion:", newLinks);
          
          // IMPORTANT: Immediately update the LSDB with the new topology
          // This must happen synchronously within this state update to ensure consistency
          setTimeout(() => {
            // Force update the LSDB for all affected routers based on the new links
            if (routersNeedingLSPFlood.size > 0) {
              console.log("Immediately updating LSDB after link deletion");
              updateLSDBAfterTopologyChange(Array.from(routersNeedingLSPFlood), newLinks);
            }
          }, 0);
          
          return newLinks;
        });
        
        // Don't call updateLSDBAfterTopologyChange here as we already called it in the setLinks callback
        return;
      }
      
      // Delete selected routers and all their connected links
      if (selectedRouterIds.length > 0) {
        console.log("Deleting routers:", selectedRouterIds);
        
        // First, find all links connected to the selected routers
        const linkedLinks = links.filter(link => 
          selectedRouterIds.includes(link.source) || selectedRouterIds.includes(link.target)
        );
        
        // Store the endpoints of each link so we can trigger LSP flooding
        linkedLinks.forEach(link => {
          if (!selectedRouterIds.includes(link.source)) {
            routersNeedingLSPFlood.add(link.source);
          }
          if (!selectedRouterIds.includes(link.target)) {
            routersNeedingLSPFlood.add(link.target);
          }
        });
        
        console.log("Also deleting linked links:", linkedLinks.map(link => link.id));
        
        // Remove the routers
        setRouters(prev => {
          const newRouters = prev.filter(router => !selectedRouterIds.includes(router.id));
          console.log("Routers after deletion:", newRouters);
          return newRouters;
        });
        
        // Remove all links connected to deleted routers
        const linkedLinkIds = linkedLinks.map(link => link.id);
        setLinks(prev => {
          const newLinks = prev.filter(link => !linkedLinkIds.includes(link.id));
          console.log("Links after router-related deletion:", newLinks);
          
          // IMPORTANT: Immediately update the LSDB with the new topology after router deletion
          setTimeout(() => {
            // Force update the LSDB for all affected routers based on the new links
            if (routersNeedingLSPFlood.size > 0) {
              console.log("Immediately updating LSDB after router deletion");
              updateLSDBAfterTopologyChange(Array.from(routersNeedingLSPFlood), newLinks);
            }
          }, 0);
          
          return newLinks;
        });
        
        // Don't call updateLSDBAfterTopologyChange here as we already called it in the setLinks callback
        return;
      }
      
      // Clear selection
      setSelectedElements({routers: [], links: []});
      setSelectionMode(false);
      console.log("Selection cleared");
    } 
    else if (simulationStatus === 'paused') {
      console.log("Handling deletion during PAUSED state (simulation active)");
      // During simulation, we need to trigger LSP flooding when topology changes
      const { routers: selectedRouterIds, links: selectedLinkIds } = selectedElements;
      
      // List of routers that will need to flood new LSPs
      const routersNeedingLSPFlood = new Set();
      
      // Process link deletions
      if (selectedLinkIds.length > 0) {
        // DEBUG: Log links before deletion
        console.log("Current links before deletion:", JSON.stringify(links));
        console.log("About to delete links:", selectedLinkIds);
        
        // For each deleted link, identify the routers that need to send new LSPs
        const affectedLinks = links.filter(link => selectedLinkIds.includes(link.id));
        console.log("Affected links:", JSON.stringify(affectedLinks));
        
        // Store the endpoints of each link so we can trigger LSP flooding
        affectedLinks.forEach(link => {
          routersNeedingLSPFlood.add(link.source);
          routersNeedingLSPFlood.add(link.target);
          
          console.log(`Link deletion affects routers: ${link.source} and ${link.target}`);
        });
        
        // Actually delete the links
        setLinks(prev => {
          const newLinks = prev.filter(link => !selectedLinkIds.includes(link.id));
          console.log("Links after deletion:", JSON.stringify(newLinks));
          
          // IMPORTANT: Immediately update the LSDB with the new topology
          // This must happen synchronously within this state update to ensure consistency
          setTimeout(() => {
            // Force update the LSDB for all affected routers based on the new links
            if (routersNeedingLSPFlood.size > 0) {
              console.log("Immediately updating LSDB after link deletion");
              updateLSDBAfterTopologyChange(Array.from(routersNeedingLSPFlood), newLinks);
            }
          }, 0);
          
          return newLinks;
        });
        
        // Don't call updateLSDBAfterTopologyChange here as we already called it in the setLinks callback
        return;
      }
      
      // Process router deletions
      if (selectedRouterIds.length > 0) {
        console.log("About to delete routers:", selectedRouterIds);
        
        // Find links connected to the routers being deleted
        const affectedLinks = links.filter(link => 
          selectedRouterIds.includes(link.source) || selectedRouterIds.includes(link.target)
        );
        
        console.log("Router deletion affects links:", JSON.stringify(affectedLinks));
        
        // For each affected link, the non-deleted router endpoint needs to flood a new LSP
        affectedLinks.forEach(link => {
          if (selectedRouterIds.includes(link.source) && !selectedRouterIds.includes(link.target)) {
            routersNeedingLSPFlood.add(link.target);
            console.log(`Router deletion affects router: ${link.target}`);
          } 
          else if (selectedRouterIds.includes(link.target) && !selectedRouterIds.includes(link.source)) {
            routersNeedingLSPFlood.add(link.source);
            console.log(`Router deletion affects router: ${link.source}`);
          }
        });
        
        // Delete the routers
        setRouters(prev => {
          const newRouters = prev.filter(router => !selectedRouterIds.includes(router.id));
          console.log("Routers after deletion:", JSON.stringify(newRouters));
          return newRouters;
        });
        
        // Delete the links connected to deleted routers
        const linkedLinkIds = affectedLinks.map(link => link.id);
        setLinks(prev => {
          const newLinks = prev.filter(link => !linkedLinkIds.includes(link.id));
          console.log("Links after router-related deletion:", JSON.stringify(newLinks));
          
          // IMPORTANT: Immediately update the LSDB with the new topology after router deletion
          setTimeout(() => {
            // Force update the LSDB for all affected routers based on the new links
            if (routersNeedingLSPFlood.size > 0) {
              console.log("Immediately updating LSDB after router deletion");
              updateLSDBAfterTopologyChange(Array.from(routersNeedingLSPFlood), newLinks);
            }
          }, 0);
          
          return newLinks;
        });
        
        // Don't call updateLSDBAfterTopologyChange here as we already called it in the setLinks callback
        return;
      }
      
      console.log("Routers needing LSP flood:", Array.from(routersNeedingLSPFlood));
      
      // Only call updateLSDBAfterTopologyChange if we haven't already handled it in the setLinks callbacks
      // This code path shouldn't be reached in normal operation
      if (routersNeedingLSPFlood.size > 0 && selectedLinkIds.length === 0 && selectedRouterIds.length === 0) {
        console.log("Calling updateLSDBAfterTopologyChange with affected routers");
        // Get current links to pass to the update function
        const currentLinks = [...links];
        updateLSDBAfterTopologyChange(Array.from(routersNeedingLSPFlood), currentLinks);
      } else {
        console.log("No routers need to flood LSPs or LSP flooding is handled directly in link/router deletion");
      }
      
      // Clear selection
      setSelectedElements({routers: [], links: []});
      setSelectionMode(false);
      console.log("Selection cleared");
    }
    
    console.log("===== DELETE SELECTED ELEMENTS FUNCTION COMPLETED =====");
  };
  
  // Modify the updateLSDBAfterTopologyChange function to properly handle topology changes
  const updateLSDBAfterTopologyChange = (affectedRouters, updatedLinks = null) => {
    console.log("===== UPDATE LSDB AFTER TOPOLOGY CHANGE =====");
    console.log(`Updating LSDB for routers: ${affectedRouters.join(', ')}`);
    
    if (!affectedRouters || affectedRouters.length === 0) {
      console.log("No affected routers, aborting LSDB update");
      return;
    }
    
    // STEP 1: Get current topology info
    console.log("STEP 1: Gathering current topology information");
    
    // Use the provided links if available, otherwise use current links state
    const currentLinks = updatedLinks || [...links];
    console.log("Current links for LSDB update:", currentLinks.map(l => `${l.source}-${l.target}`));
    
    // Make a local copy of LSDB to modify before setting state
    const updatedLSDB = JSON.parse(JSON.stringify(lsdbData));
    
    // Make a copy of sequence numbers to update
    const updatedSequenceNumbers = { ...routerSequenceNumbers };
    
    // STEP 2: Update the LSDB for each affected router
    console.log("STEP 2: Updating LSDB for each affected router");
    
    // For each affected router, update ONLY its own entry in its LSDB
    // and also update how it views the other affected router
    affectedRouters.forEach(routerId => {
      console.log(`Updating LSDB for router ${routerId}`);
      
      // Ensure router entry exists in LSDB
      if (!updatedLSDB[routerId]) {
        updatedLSDB[routerId] = {};
      }
      
      // Get current links for this router from our snapshot
      const routerLinks = currentLinks.filter(link => 
        link.source === routerId || link.target === routerId
      );
      
      console.log(`Router ${routerId} has ${routerLinks.length} links after topology change`);
      
      // Extract neighbors from links - these are the ACTUAL current neighbors
      const currentNeighbors = routerLinks.map(link => 
        link.source === routerId ? link.target : link.source
      );
      
      console.log(`Router ${routerId} new neighbors: ${currentNeighbors.join(', ') || 'NONE'}`);
      
      // Update this router's own entry in its LSDB
      updatedLSDB[routerId][routerId] = currentNeighbors;
      
      // Increment sequence number for this router to indicate topology change
      if (!updatedSequenceNumbers[routerId]) {
        updatedSequenceNumbers[routerId] = 1;
      } else {
        updatedSequenceNumbers[routerId]++;
      }
      console.log(`Incremented sequence number for router ${routerId} to ${updatedSequenceNumbers[routerId]} due to topology change`);
      
      // Update sequence number in the LSDB for this router
      // Initialize sequence number tracking if needed
      if (!updatedLSDB[routerId].sequenceNumbers) {
        updatedLSDB[routerId].sequenceNumbers = {};
      }
      // Set the router's own sequence number in its LSDB
      updatedLSDB[routerId].sequenceNumbers[routerId] = updatedSequenceNumbers[routerId];
      
      // For each affected router, remove the link to the other affected router from their view
      affectedRouters.forEach(otherRouterId => {
        if (routerId !== otherRouterId) {
          // If the link between these routers was deleted, remove them from each other's adjacency lists
          const isStillNeighbor = currentNeighbors.includes(otherRouterId);
          if (!isStillNeighbor) {
            // If otherRouterId is no longer a neighbor, update how this router views the other router
            // By removing itself from the other router's adjacency list
            if (updatedLSDB[routerId][otherRouterId]) {
              updatedLSDB[routerId][otherRouterId] = updatedLSDB[routerId][otherRouterId].filter(
                neighbor => neighbor !== routerId
              );
              console.log(`Router ${routerId} updated its view of ${otherRouterId}'s adjacency list by removing itself`);
            }
          }
        }
      });
    });
    
    // STEP 3: Apply the LSDB updates
    console.log("STEP 3: Applying LSDB updates to state");
    
    // Update LSDB state
    setLsdbData(updatedLSDB);
    console.log("LSDB updated:", updatedLSDB);
    
    // Update sequence numbers
    setRouterSequenceNumbers(updatedSequenceNumbers);
    console.log("Sequence numbers updated:", updatedSequenceNumbers);
    
    // Track which routers have had their sequence numbers incremented
    setRecentlyIncrementedSequences(prev => {
      const newSet = new Set(prev);
      affectedRouters.forEach(routerId => newSet.add(routerId));
      console.log("Tracking routers with recently incremented sequence numbers:", Array.from(newSet));
      return newSet;
    });
    
    // STEP 4: Force UI refresh and log messages
    console.log("STEP 4: Forcing UI to refresh");
    
    // Add an immediate visual refresh that forces the UI to update
    if (affectedRouters.length > 0) {
      setCurrentHighlight({
        routerId: affectedRouters[0],
        data: [affectedRouters[0], updatedLSDB[affectedRouters[0]][affectedRouters[0]] || []],
        timestamp: Date.now()
      });
    }
    
    // STEP 5: Update routing tables for all affected routers
    console.log("STEP 5: Updating routing tables for affected routers");
    
    // Update routing tables for ALL routers, not just the affected ones
    // This ensures consistency across the network
    const allRouterIds = routers.map(r => r.id);
    console.log(`Updating routing tables for ALL routers after topology change:`, allRouterIds);
    
    allRouterIds.forEach(routerId => {
      const routerTables = calculateDijkstraForRouter(routerId, updatedLSDB);
      setRoutingTables(prevTables => {
        const updatedTables = { ...prevTables };
        
        // Ensure router entry exists
        if (!updatedTables[routerId]) {
          updatedTables[routerId] = {};
        }
        
        // Always include self route
        updatedTables[routerId].self = {
          destination: routerId,
          nextHop: "—", // Em dash to represent direct
          cost: 0
        };
        
        // Clear previous routes that might be affected by the topology change
        if (affectedRouters.includes(routerId)) {
          const destinations = Object.keys(updatedTables[routerId]).filter(key => key !== 'self');
          destinations.forEach(destId => {
            delete updatedTables[routerId][destId];
          });
          
          console.log(`Cleared existing routes for Router ${routerId} due to topology change`);
        }
        
        // Add routes from calculated tables
        if (routerTables) {
          Object.keys(routerTables).forEach(destId => {
            if (destId !== 'self') {
              updatedTables[routerId][destId] = routerTables[destId];
            }
          });
        }
        
        // Special handling for direct connections that were removed
        affectedRouters.forEach(affectedId => {
          // If this is a directly affected router, check for routes through the other affected router
          if (routerId === affectedId) {
            // Find the other affected router(s)
            const otherAffectedRouters = affectedRouters.filter(id => id !== routerId);
            
            otherAffectedRouters.forEach(otherRouterId => {
              // Check if there's a route through the other affected router
              Object.keys(updatedTables[routerId]).forEach(destId => {
                if (destId !== 'self') {
                  const route = updatedTables[routerId][destId];
                  // If the next hop is the other affected router, this route may now be invalid
                  if (route && route.nextHop === otherRouterId) {
                    // Double check if this router still has a connection to the other router
                    const stillConnected = updatedLSDB[routerId][routerId] && 
                                          updatedLSDB[routerId][routerId].includes(otherRouterId);
                    
                    if (!stillConnected) {
                      console.log(`Removing route from ${routerId} to ${destId} through disconnected router ${otherRouterId}`);
                      delete updatedTables[routerId][destId];
                    }
                  }
                }
              });
            });
          }
        });
        
        console.log(`Updated routing table for Router ${routerId} after topology change:`, updatedTables[routerId]);
        return updatedTables;
      });
    });
    
    // Log a message to indicate topology changes
    setSimulationLogs(prev => [
      ...prev, 
      { 
        message: `Topology changed: Routers ${affectedRouters.join(', ')} updated their LSDB with new neighbor information`, 
        type: 'warning',
        timestamp: Date.now()
      }
    ]);
    
    // Log a message to inform the user to click Next Step
    setSimulationLogs(prev => [
      ...prev, 
      { 
        message: `Click Next Step to trigger LSP flooding with incremented sequence numbers`, 
        type: 'info',
        timestamp: Date.now()
      }
    ]);
    
    console.log("===== UPDATE LSDB AFTER TOPOLOGY CHANGE COMPLETE =====");
    // LSP flooding will happen only after Next Step button is clicked
  };
  
  // Add a link between routers with a cost
  const handleAddLink = (cost) => {
    const [sourceId, targetId] = selectedRouters;
    const source = routers.find(r => r.id === sourceId);
    const target = routers.find(r => r.id === targetId);
    
    // Check if a link already exists between these routers (in either direction)
    const existingLinkForward = links.find(link => 
      (link.source === sourceId && link.target === targetId)
    );
    
    const existingLinkBackward = links.find(link => 
      (link.source === targetId && link.target === sourceId)
    );
    
    if (existingLinkForward || existingLinkBackward) {
      // If a link already exists, update its cost instead of creating a new one
      const existingLink = existingLinkForward || existingLinkBackward;
      const existingCost = existingLink.cost;
      
      // Confirm with the user before updating
      const confirmUpdate = window.confirm(
        `A link already exists between Router ${sourceId} and Router ${targetId} with cost ${existingCost}. \n\n` +
        `In Link State Routing, we should update the existing link's cost instead of creating duplicate links. \n\n` +
        `Would you like to update the cost from ${existingCost} to ${cost}?`
      );
      
      if (confirmUpdate) {
        // Update the existing link's cost
        setLinks(prevLinks => 
          prevLinks.map(link => 
            link === existingLink ? { ...link, cost: parseInt(cost) } : link
          )
        );
        
        // In Link State Algorithm, only the directly connected routers would detect the change
        // They would then originate new LSPs with incremented sequence numbers
        if (simulationStatus === 'running') {
          // Mark the affected routers for LSP origination in the next step
          // First, identify the routers directly connected to this link
          const affectedRouters = [existingLink.source, existingLink.target];
          
          // Increment sequence numbers only for these directly affected routers
          // This will trigger them to generate new LSPs in the next step
          setRouterSequenceNumbers(prevSeqNums => {
            const newSeqNums = { ...prevSeqNums };
            
            affectedRouters.forEach(routerId => {
              if (!newSeqNums[routerId]) {
                newSeqNums[routerId] = 1;
              } else {
                newSeqNums[routerId]++;
              }
              console.log(`Incremented sequence number for Router ${routerId} to ${newSeqNums[routerId]} due to link cost update`);
            });
            
            return newSeqNums;
          });
          
          // Add the routers to a set of recently incremented sequences
          // This will be used in the next step to originate new LSPs
          setRecentlyIncrementedSequences(prevSet => {
            const newSet = new Set(prevSet);
            affectedRouters.forEach(routerId => newSet.add(routerId));
            return newSet;
          });
          
          // Update ONLY the directly connected routers' view of their own neighborhood
          setLsdbData(prevLsdb => {
            const updatedLsdb = JSON.parse(JSON.stringify(prevLsdb));
            
            // For each affected router
            affectedRouters.forEach(routerId => {
              // Ensure the router has an entry in the LSDB
              if (!updatedLsdb[routerId]) {
                updatedLsdb[routerId] = {};
              }
              
              // Ensure sequence numbers tracking exists
              if (!updatedLsdb[routerId].sequenceNumbers) {
                updatedLsdb[routerId].sequenceNumbers = {};
              }
              
              // Update the router's own sequence number
              const seqNum = prevLsdb[routerId]?.sequenceNumbers?.[routerId] || 0;
              updatedLsdb[routerId].sequenceNumbers[routerId] = seqNum + 1;
              
              // The router's view of itself (neighbors) doesn't change, just the link cost
              // But we need to set the sequence number that will trigger LSP flooding
            });
            
            return updatedLsdb;
          });
          
          // Show feedback to the user about what will happen
          alert(
            `Link cost updated from ${existingCost} to ${cost}.\n\n` +
            `Router ${existingLink.source} and Router ${existingLink.target} will detect this change and ` +
            `originate new LSPs with incremented sequence numbers.\n\n` +
            `Other routers will learn about this change through normal LSP flooding in subsequent steps.\n\n` +
            `You can now use the Next Step button to observe how this change propagates through the network.`
          );
        }
      }
    } else {
      // Create a new link if none exists
      const newLink = {
        id: `${sourceId}-${targetId}`,
        source: sourceId,
        target: targetId,
        cost: parseInt(cost)
      };
      
      setLinks([...links, newLink]);
    }
    
    // Reset UI state
    setSelectedRouters([]);
    setShowLinkCostModal(false);
    setConnectMode(false);
  };
  
  // Handle simulation start
  const handleStartSimulation = () => {
    if (routers.length < 2 || links.length === 0) return;
    
    // Reset any in-progress simulation state
    setCurrentStep(0);
    setCurrentHighlight(null);
    setPackets([]);
    setSimulationLogs([]); // Clear previous logs
    setPendingLSPForwards([]); // Clear any pending forwards
    
    setSimulationStatus('running');
    
    // Convert our links to the format expected by the flooding algorithm
    const edgesForSimulation = links.map(link => [link.source, link.target, link.cost]);
    
    // Reset simulation data completely
    // Start with empty LSDBs for each router
    const initialLSDB = {};
    const initialProcessedLSPs = {};
    const initialRoutingTables = {};
    const initialSequenceNumbers = {};
    
    // Initialize empty data structures for each router
    routers.forEach(router => {
      // Initialize empty LSDB for each router
      initialLSDB[router.id] = {
        // Only include self entry, with empty neighbors list
        [router.id]: []
      };
      
      // Initialize empty processed LSPs set for each router
      initialProcessedLSPs[router.id] = new Set();
      
      // Initialize empty routing table with just the self entry
      initialRoutingTables[router.id] = {
        self: {
          destination: router.id,
          nextHop: "—", // Em dash to represent direct
          cost: 0
        }
      };
      
      // Initialize sequence number to 0
      initialSequenceNumbers[router.id] = 0;
    });
    
    // Set all the simulation state at once to ensure consistency
    setLsdbData(initialLSDB);
    setProcessedLSPs(initialProcessedLSPs);
    setRoutingTables(initialRoutingTables);
    setRouterSequenceNumbers(initialSequenceNumbers);
    
    // Save current animation speed for consistent use
    const currentSpeed = animationSpeed;
    
    // Run the simulation with the current topology
    // This now just initializes the simulation without automatically exchanging packets
    runSimulation(
      edgesForSimulation, 
      routers[0].id, 
      currentSpeed, 
      (animationData) => handleAnimationStep(animationData),
      (logs) => {
        // We need to update the logs immediately to keep them in sync with animations
        setSimulationLogs(logs);
      }
    );
    
    // Broadcast hello messages from both sides of all edges
    // Use setTimeout to ensure this happens after the simulation is initialized
    setTimeout(() => {
      console.log(`Initiating hello packet exchange for ${links.length} links (${links.length * 2} hello packets total)`);
      
      // Broadcast hello packets for all links
      links.forEach(link => {
        // Send hello from source to target
        animatePacket(
          link.source,
          link.target,
          `Hello packet from ${link.source} to ${link.target}`,
          'hello',
          1000,  // animation duration
          null,  // callback
          null,  // owner (not needed for hello)
          null   // sequence (not needed for hello)
        );
        
        // Send hello from target to source
        animatePacket(
          link.target,
          link.source,
          `Hello packet from ${link.target} to ${link.source}`,
          'hello',
          1000,  // animation duration
          null,  // callback
          null,  // owner (not needed for hello)
          null   // sequence (not needed for hello)
        );
      });
    }, 500); // Short delay to ensure simulation is fully initialized
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
      // Only mark simulation as completed when user explicitly ends it
      // We're not auto-completing any more
      // Note: This block will now be handled in handleEndSimulation instead
      
      // Do not update simulation status to 'completed' here
      // setSimulationStatus('completed');
      
      // We still want to initialize empty routing tables for display
      if (Object.keys(routingTables).length === 0) {
        // Create a basic routing table structure
        const initialRoutingTables = {};
        routers.forEach(router => {
          initialRoutingTables[router.id] = {
            self: {
              destination: router.id,
              nextHop: "—", // Em dash to represent direct
              cost: 0
            }
          };
        });
        // Set initial tables
        setRoutingTables(initialRoutingTables);
      }
    }
  };
  
  // Animate a packet moving from source to target
  const animatePacket = (fromId, toId, packetData, packetType = 'lsp', animationDuration = 1000, externalCallback = null, lspOwner = null, sequenceNumber = null, additionalData = null) => {
    // Don't start new animations if paused
    if (isPaused) return;
    
    // Set animation in progress
    setAnimationInProgress(true);
    
    // Check if the from or to router still exists
    const fromRouter = routers.find(r => r.id === fromId);
    const toRouter = routers.find(r => r.id === toId);
    
    if (!fromRouter || !toRouter) {
      console.log(`Cannot send packet: Router ${!fromRouter ? fromId : toId} not found`);
      if (externalCallback) externalCallback();
      setAnimationInProgress(false);
      return;
    }
    
    // Check if there's a direct link between these routers
    const linkExists = links.some(link => 
      (link.source === fromId && link.target === toId) || 
      (link.source === toId && link.target === fromId)
    );
    
    if (!linkExists) {
      console.log(`Cannot send packet from ${fromId} to ${toId}: No direct link exists`);
      // Add log entry to show the user what happened
      setSimulationLogs(prev => [
        ...prev,
        {
          message: `Failed to send ${packetType.toUpperCase()} packet: No link between Routers ${fromId} and ${toId}`,
          type: 'error',
          timestamp: Date.now()
        }
      ]);
      if (externalCallback) externalCallback();
      setAnimationInProgress(false);
      return;
    }
    
    // Calculate center points of routers
    const fromX = fromRouter.x;
    const fromY = fromRouter.y;
    const toX = toRouter.x;
    const toY = toRouter.y;
    
    // Use fixed packet size for consistency in 3D space
    const packetSize = 30;
    
    // Create packet with unique ID
    const packetId = `packet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Store metadata for the packet
    const metadata = {
      lspOwner: lspOwner,
      sequenceNumber: sequenceNumber,
      sourceRouter: fromId,
      additionalData: additionalData
    };
    
    // Create a new packet
    const newPacket = {
      id: packetId,
      from: fromId,
      to: toId,
      x: fromX,
      y: fromY,
      size: packetSize,
      data: packetData,
      type: packetType,
      metadata: metadata
    };
    
    // Add packet to state
    setPackets(prev => [...prev, newPacket]);
    
    // Log the packet for debugging
    if (packetType === 'lsp') {
      const metaInfo = lspOwner && sequenceNumber ? 
        `LSP from ${lspOwner} with sequence ${sequenceNumber}` :
        `Unknown LSP`;
      console.log(`Creating ${packetType} packet ${packetId} from ${fromId} to ${toId} (${metaInfo})`);
    } else {
      console.log(`Creating ${packetType} packet ${packetId} from ${fromId} to ${toId}`);
    }
    
    // Use a fixed duration for all packets regardless of distance
    // This ensures all packets reach their destinations at the same time
    const durationInSeconds = 1.0 / animationSpeed;
    
    // Create and manage animation
    gsap.to({}, {
      duration: durationInSeconds,
      ease: "power3.out",
      overwrite: "auto",
      onUpdate: function() {
        // Calculate current position based on progress
        const progress = this.progress();
        const currentX = fromX + (toX - fromX) * progress;
        const currentY = fromY + (toY - fromY) * progress;
        
        // Update packet position
        setPackets(prevPackets => 
          prevPackets.map(p => 
            p.id === packetId 
              ? { ...p, x: currentX, y: currentY }
              : p
          )
        );
      },
      clearProps: "all",
      onComplete: () => {
        // Find the packet data before removing it
        const currentPackets = [...packets]; // Get a snapshot of current packets
        const packet = currentPackets.find(p => p.id === packetId);
        
        // Remove packet when animation completes
        setPackets(prev => prev.filter(p => p.id !== packetId));
        
        // Make the receiving router glow to indicate packet reception
        const receivingRouterNode = document.getElementById(`router-${toId}`);
        if (receivingRouterNode && receivingRouterNode.glow) {
          receivingRouterNode.glow('receive');
        }
        
        // Also glow the 3D router
        if (window[`router3D_${toId}`] && window[`router3D_${toId}`].glow) {
          window[`router3D_${toId}`].glow('receive');
        }
        
        // Update receiver based on packet type
        if (packetType === 'lsp') {
          // For LSP packets, update the link-state database
          // If we have additionalData (direct LSP data), use that
          if (additionalData) {
            // Use the directly passed data for the LSP
            updateLSDB(toId, additionalData, {
              lspOwner: lspOwner,
              sequenceNumber: sequenceNumber,
              sourceRouter: fromId
            });
            highlightChange(toId, additionalData);
          } else {
            // Otherwise parse from the packet content
            const match = packetData.match(/LSP-([A-Z])-(\d+)/);
            if (match) {
              const pktLspOwner = match[1];
              const pktSeqNumber = parseInt(match[2]);
              
              // If we have explicit metadata, use that
              const metaData = {
                lspOwner: lspOwner || pktLspOwner,
                sequenceNumber: sequenceNumber || pktSeqNumber,
                sourceRouter: fromId
              };
              
              // Get adjacency list from originating router's LSDB
              let adjList = [];
              if (lsdbData[pktLspOwner] && Array.isArray(lsdbData[pktLspOwner][pktLspOwner])) {
                adjList = [...lsdbData[pktLspOwner][pktLspOwner]];
              }
              
              // Update the receiver's LSDB with this data
              const updateData = [pktLspOwner, adjList];
              updateLSDB(toId, updateData, metaData);
              highlightChange(toId, updateData);
            } else {
              console.log(`Invalid LSP format: ${packetData}`);
            }
          }
        } else if (packetType === 'hello') {
          // For hello packets, update the neighbor relationship
          updateHelloPacket(fromId, toId);
        }
        else if (packetType === 'ping') {
          // For ping packets, just log the successful hop (no need to update routing information)
          console.log(`Ping packet from ${fromId} to ${toId} hop completed`);
          
          // Add a visual effect to the receiving router to indicate ping reception
          const receivingRouterNode = document.getElementById(`router-${toId}`);
          if (receivingRouterNode && receivingRouterNode.glow) {
            receivingRouterNode.glow('receive');
          }
          
          // Also glow the 3D router if it exists
          if (window[`router3D_${toId}`] && window[`router3D_${toId}`].glow) {
            window[`router3D_${toId}`].glow('receive');
          }
        }
        // If there's an external callback, call it
        if (externalCallback) {
          externalCallback();
        }
        
        // Mark animation as completed
        setAnimationInProgress(false);
      }
    });
  };
  
  // Process a Hello packet from one router to another
  const updateHelloPacket = (fromId, toId) => {
    // When a router receives a Hello packet, it adds the sender as a neighbor
    // But the sender doesn't automatically know about the receiver
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
      
      // IMPORTANT: The sender does NOT automatically learn about the target
      // This is a one-way hello packet. The target learns about the sender,
      // but the sender doesn't learn about the target unless it receives 
      // a hello packet from the target.
      
      // Add to processed LSPs 
      setProcessedLSPs(lspPrev => {
        const lspUpdated = { ...lspPrev };
        
        if (!lspUpdated[toId]) {
          lspUpdated[toId] = new Set();
        }
        
        // Initialize the sender's entry if needed but don't update neighbors
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
  const updateLSDB = (routerId, data, packetMetadata = null) => {
    if (!data || !Array.isArray(data) || data.length < 2) {
      return;
    }
    
    const [nodeId, adjList] = data;
    
    if (!nodeId) {
      return;
    }
    
    // Get sequence information directly from the packet metadata
    console.log(`Router ${routerId} received data:`, data);
    console.log(`Packet metadata:`, packetMetadata);
    
    // Extract sequence number information from packet metadata if available
    let seqNumber = null;
    let lspOwner = nodeId;
    let sourceRouter = null;
    
    if (packetMetadata) {
      lspOwner = packetMetadata.lspOwner || nodeId;
      seqNumber = packetMetadata.sequenceNumber;
      sourceRouter = packetMetadata.sourceRouter;
      
      if (seqNumber !== null) {
        console.log(`Router ${routerId} received LSP from ${lspOwner} with sequence number ${seqNumber} via ${sourceRouter}`);
      }
    } else {
      console.log(`Router ${routerId} received data without metadata`);
      
      // Try extracting sequence from packet data for backward compatibility
      const seqMatch = Array.from(packets)
        .filter(p => p.to === routerId && p.type === 'lsp')
        .sort((a, b) => b.id.localeCompare(a.id))[0]; // Sort by ID in descending order
      
      if (seqMatch && seqMatch.data) {
        const match = seqMatch.data.match(/LSP-([A-Z])-(\d+)/);
        if (match) {
          lspOwner = match[1];
          seqNumber = parseInt(match[2]);
          sourceRouter = seqMatch.from;
          console.log(`Router ${routerId} extracted sequence from packet: LSP from ${lspOwner} with seq ${seqNumber}`);
        }
      }
    }
    
    // Create a unique key for this LSP
    const lspKey = `LSP${nodeId}: ${JSON.stringify(adjList)}`;
    
    // Check FIRST if this router has already processed this EXACT LSP
    // This prevents multiple processing of identical LSPs
    const alreadyProcessed = processedLSPs[routerId] && processedLSPs[routerId].has(lspKey);
    console.log(`Router ${routerId} processing LSP ${lspKey} - Already processed: ${alreadyProcessed}`);
    
    // Get the router DOM node to trigger glow effect
    const routerNode = document.getElementById(`router-${routerId}`);
    
    // If router has already processed this exact LSP, skip the update
    if (alreadyProcessed) {
      console.log(`Router ${routerId} skipping already processed LSP: ${lspKey}`);
      // Add red glow if the router node exists
      if (routerNode && routerNode.glow) {
        routerNode.glow(false); // False = rejection (red glow)
      }
      // Also glow the 3D router
      if (window[`router3D_${routerId}`] && window[`router3D_${routerId}`].glow) {
        window[`router3D_${routerId}`].glow('reject');
      }
      return;
    }
    
    // Next check the sequence number BEFORE updating any state
    let shouldForward = false;
    let shouldUpdateLSDB = false;
    
    // Make a copy of LSDB for sequence number checking
    const currentLSDB = JSON.parse(JSON.stringify(lsdbData));
    
    // Check if we need to update based on sequence number
    if (seqNumber !== null) {
      // Get current sequence number, if any
      const currentSeqNumbers = (currentLSDB[routerId] && currentLSDB[routerId].sequenceNumbers) || {};
      const currentSeq = currentSeqNumbers[lspOwner] || 0;
      
      console.log(`Router ${routerId} comparing sequence numbers for ${lspOwner}: new=${seqNumber}, current=${currentSeq}`);
      
      // If the incoming sequence number is greater, we should update and forward
      if (seqNumber > currentSeq) {
        console.log(`Router ${routerId} will process and forward LSP from ${lspOwner} with sequence ${seqNumber} (current: ${currentSeq})`);
        shouldForward = true;
        shouldUpdateLSDB = true;
        
        // Add green glow if the router node exists
        if (routerNode && routerNode.glow) {
          routerNode.glow(true); // True = acceptance (green glow)
        }
        // Also glow the 3D router
        if (window[`router3D_${routerId}`] && window[`router3D_${routerId}`].glow) {
          window[`router3D_${routerId}`].glow('accept');
        }
      } else {
        console.log(`Router ${routerId} discarded LSP from ${lspOwner} with sequence ${seqNumber} (already has ${currentSeq})`);
        // Add red glow if the router node exists
        if (routerNode && routerNode.glow) {
          routerNode.glow(false); // False = rejection (red glow)
        }
        // Also glow the 3D router
        if (window[`router3D_${routerId}`] && window[`router3D_${routerId}`].glow) {
          window[`router3D_${routerId}`].glow('reject');
        }
        return; // Skip processing entirely
      }
    } else {
      // If no sequence number, we'll still update LSDB but not forward
      console.log(`Router ${routerId} received LSP without sequence number, will update LSDB but not forward`);
      shouldUpdateLSDB = true;
      
      // Add green glow if the router node exists
      if (routerNode && routerNode.glow) {
        routerNode.glow(true); // True = acceptance (green glow)
      }
      // Also glow the 3D router
      if (window[`router3D_${routerId}`] && window[`router3D_${routerId}`].glow) {
        window[`router3D_${routerId}`].glow('accept');
      }
    }
    
    // Now update processed LSPs to mark this LSP as processed
    // Include sequence number in the key to properly track processed LSPs
    setProcessedLSPs(prev => {
      const updated = { ...prev };
      
      // Initialize the set if it doesn't exist
      if (!updated[routerId]) {
        updated[routerId] = new Set();
      }
      
      // Create a more specific LSP key that includes the sequence number
      const sequencedLspKey = seqNumber ? `LSP${nodeId}-${seqNumber}: ${JSON.stringify(adjList)}` : lspKey;
      
      // Mark it as processed
      updated[routerId].add(sequencedLspKey);
      
      return updated;
    });
    
    // Update the LSDB if needed
    if (shouldUpdateLSDB) {
      setLsdbData(lsdbPrev => {
        // Make a deep copy of the previous state
        const lsdbUpdated = JSON.parse(JSON.stringify(lsdbPrev));
        
        // Ensure the router entry exists
        if (!lsdbUpdated[routerId]) {
          lsdbUpdated[routerId] = {};
        }
        
        // Sort the adjacency list to ensure consistent comparisons
        const sortedAdjList = [...adjList].sort();
        
        // Flag to track if this LSP represents a topology change
        let topologyChanged = false;
        let removedNeighbors = [];
        
        // Check if this is a change in adjacency list that indicates a link deletion
        // by comparing previous and new adjacency lists
        if (lsdbUpdated[routerId][nodeId] && lsdbUpdated[routerId][nodeId].length !== sortedAdjList.length) {
          // Find neighbors that were removed (present in old list but not in new list)
          const oldNeighbors = new Set(lsdbUpdated[routerId][nodeId]);
          const newNeighbors = new Set(sortedAdjList);
          
          // Find neighbors that were removed (exist in old but not in new)
          removedNeighbors = [...oldNeighbors].filter(n => !newNeighbors.has(n));
          
          if (removedNeighbors.length > 0) {
            topologyChanged = true;
            console.log(`Router ${routerId} detected that router ${nodeId} removed neighbors: ${removedNeighbors.join(', ')}`);
            
            // For each removed neighbor, update the receiver's view of that neighbor
            removedNeighbors.forEach(removedNeighborId => {
              // If the receiver has information about the removed neighbor
              if (lsdbUpdated[routerId][removedNeighborId]) {
                // Update the receiver's view of the removed neighbor by removing nodeId from its adjacency list
                lsdbUpdated[routerId][removedNeighborId] = lsdbUpdated[routerId][removedNeighborId].filter(
                  neighbor => neighbor !== nodeId
                );
                console.log(`Router ${routerId} updated its view of router ${removedNeighborId} by removing ${nodeId} from its adjacency list`);
              }
            });
          }
        } else if (!lsdbUpdated[routerId][nodeId] || JSON.stringify(lsdbUpdated[routerId][nodeId]) !== JSON.stringify(sortedAdjList)) {
          // Check if this is a new node or the adjacency list has changed in other ways
          topologyChanged = true;
        }
        
        // Update the adjacency list - no connectivity checks needed
        // Each router should maintain info about all routers in the network
        lsdbUpdated[routerId][nodeId] = sortedAdjList;
        console.log(`Router ${routerId} updated LSDB with ${nodeId}'s adjacency list:`, sortedAdjList);
        
        // Update sequence number if provided
        if (seqNumber !== null) {
          // Initialize sequence number tracking if needed
          if (!lsdbUpdated[routerId].sequenceNumbers) {
            lsdbUpdated[routerId].sequenceNumbers = {};
          }
          // Update to the new sequence number
          lsdbUpdated[routerId].sequenceNumbers[lspOwner] = seqNumber;
          console.log(`Router ${routerId} updated sequence number for ${lspOwner} to ${seqNumber}`);
        }
        
        // Queue LSP forwarding if needed
        if (shouldForward && seqNumber !== null) {
          // Find potential forwarding targets
          if (lsdbUpdated[routerId][routerId]) {
            const neighbors = lsdbUpdated[routerId][routerId];
            
            console.log(`Router ${routerId} neighbors:`, neighbors);
            console.log(`Router ${routerId} received LSP from:`, sourceRouter);
            
            // Find all neighbors except the one that sent us this LSP
            const forwardingTargets = neighbors.filter(neighborId => neighborId !== sourceRouter);
            
            console.log(`Router ${routerId} potential forwarding targets:`, forwardingTargets);
            
            if (forwardingTargets.length > 0) {
              console.log(`Router ${routerId} queueing LSP-${lspOwner}-${seqNumber} to be forwarded to ${forwardingTargets.length} neighbors in next step`);
              
              setPendingLSPForwards(prev => {
                const existingForwards = new Map();
                prev.forEach(forward => {
                  const key = `${forward.from}-${forward.to}-${forward.lspOwner}-${forward.sequenceNumber}`;
                  existingForwards.set(key, true);
                });
                
                const newForwards = forwardingTargets
                  .map(targetId => {
                    const forwardKey = `${routerId}-${targetId}-${lspOwner}-${seqNumber}`;
                    if (!existingForwards.has(forwardKey)) {
                      return {
                        from: routerId,
                        to: targetId,
                        lspOwner: lspOwner,
                        sequenceNumber: seqNumber,
                        content: `LSP-${lspOwner}-${seqNumber}`
                      };
                    }
                    return null;
                  })
                  .filter(forward => forward !== null);
                
                return [...prev, ...newForwards];
              });
            } else {
              console.log(`Router ${routerId} has no other neighbors to forward the LSP to`);
            }
          } else {
            console.log(`Router ${routerId} doesn't know its own neighbors yet, can't forward LSP`);
          }
        }
        
        // Update routing tables immediately to reflect the new LSDB information
        setTimeout(() => {
          // We need to make sure we calculate the routing table based on the LATEST LSDB data
          // So we first get a fresh copy of the current LSDB state
          setLsdbData(currentLSDBState => {
            // Calculate routing tables for ALL routers if this was a topology change
            const routersToUpdate = topologyChanged ? routers.map(r => r.id) : [routerId];
            console.log(`Updating routing tables for ${topologyChanged ? 'ALL' : 'single'} router(s):`, routersToUpdate);
            
            // Update routing tables for each relevant router
            routersToUpdate.forEach(rid => {
              const routerTables = calculateDijkstraForRouter(rid, currentLSDBState);
              
              // Update the routing tables
              setRoutingTables(prevTables => {
                const updatedTables = { ...prevTables };
                
                // Ensure router entry exists
                if (!updatedTables[rid]) {
                  updatedTables[rid] = {};
                }
                
                // Always include self route
                updatedTables[rid].self = {
                  destination: rid,
                  nextHop: "—", // Em dash to represent direct
                  cost: 0
                };
                
                // Clear previous routes that might be affected by the topology change
                if (topologyChanged) {
                  const destinations = Object.keys(updatedTables[rid]).filter(key => key !== 'self');
                  destinations.forEach(destId => {
                    delete updatedTables[rid][destId];
                  });
                  
                  console.log(`Cleared existing routes for Router ${rid} due to topology change`);
                }
                
                // Add new routes from calculated tables
                if (routerTables) {
                  Object.keys(routerTables).forEach(destId => {
                    if (destId !== 'self') {
                      updatedTables[rid][destId] = routerTables[destId];
                    }
                  });
                }
                
                // If there were any removed neighbors, make sure routes through them are gone
                if (removedNeighbors.length > 0 && topologyChanged) {
                  console.log(`Checking for routes through removed neighbors: ${removedNeighbors.join(', ')}`);
                  
                  // For each destination, if the next hop is a removed neighbor, remove the route
                  Object.keys(updatedTables[rid]).forEach(destId => {
                    if (destId !== 'self') {
                      const route = updatedTables[rid][destId];
                      // If the next hop is the other affected router, this route may now be invalid
                      if (route && removedNeighbors.includes(route.nextHop)) {
                        console.log(`Removing route to ${destId} through removed neighbor ${route.nextHop}`);
                        delete updatedTables[rid][destId];
                      }
                    }
                  });
                }
                
                // Log the updated routing table for debugging
                console.log(`Updated routing table for Router ${rid}:`, updatedTables[rid]);
                
                return updatedTables;
              });
            });
            
            // Return the unchanged LSDB
            return currentLSDBState;
          });
        }, 10);
        
        return lsdbUpdated;
      });
    }
  };
  
  // Highlight a change in the LSDB
  const highlightChange = (routerId, data) => {
    if (!data || !Array.isArray(data) || !data[0]) {
      return;
    }
    
    // Set the highlight with the router ID and data
    setCurrentHighlight({ 
      routerId, 
      data,
      timestamp: Date.now() // Add timestamp to ensure state update is detected
    });
    
    // Clear the highlight immediately instead of using setTimeout
    setCurrentHighlight(null);
  };
  
  // Calculate routing tables for all routers - this is kept for reference but not used directly
  const calculateRoutingTables = () => {
    const tables = {};
    
    // Make sure we have complete LSDB data before calculating routing tables
    // Check if all routers have an entry in the LSDB
    const routersWithLSDB = Object.keys(lsdbData);
    const allRoutersInLSDB = routers.every(router => routersWithLSDB.includes(router.id));
    
    if (!allRoutersInLSDB) {
      console.error("Not all routers have LSDB data, cannot calculate routing tables");
      return;
    }
    
    // Make sure the LSDB data is complete by checking if every router has knowledge of all links
    // This is required for accurate routing table calculation
    let lsdbComplete = true;
    
    routers.forEach(router => {
      // Skip if this router has no LSDB entry
      if (!lsdbData[router.id]) {
        lsdbComplete = false;
        return;
      }
      
      // Check if this router has knowledge of all relevant routers
      const knownRouters = Object.keys(lsdbData[router.id]);
      if (knownRouters.length < routers.length) {
        // If router doesn't know about all other routers, LSDB might be incomplete
        // This is a simple heuristic and may not be 100% accurate
        lsdbComplete = false;
      }
    });
    
    if (!lsdbComplete) {
      console.warn("LSDB data may be incomplete, routing tables may be inaccurate");
    }
    
    // Now calculate the routing tables
    routers.forEach(router => {
      tables[router.id] = calculateDijkstra(router.id);
    });
    
    // Add direct routes to self in each routing table
    routers.forEach(router => {
      const routingTable = tables[router.id] || {};
      
      // Add route to self
      routingTable.self = {
        destination: router.id,
        nextHop: "—", // Em dash to represent direct
        cost: 0
      };
      
      tables[router.id] = routingTable;
    });
    
    // Only update routing tables if we have valid data for all routers
    if (Object.keys(tables).length === routers.length) {
      console.log("Setting routing tables:", tables);
      setRoutingTables(tables);
    } else {
      console.error("Could not calculate routing tables for all routers");
    }
  };
  
  // New function to calculate Dijkstra for a router directly from LSDB and topology
  const calculateDijkstraForRouter = (startId, currentLSDB) => {
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
    
    // Build a graph from the LSDB data instead of physical links
    const graph = {};
    
    // Initialize the graph structure
    routers.forEach(router => {
      graph[router.id] = {};
    });
    
    // We need to verify bi-directional connectivity in the LSDB
    // First, collect all confirmed connections from the LSDB
    const confirmedConnections = new Set();
    
    // Log the current LSDB state for debugging
    console.log(`Router ${startId} calculating routes with LSDB:`, JSON.stringify(currentLSDB[startId]));
    
    // Verify all connections are truly bidirectional according to the LSDB
    Object.entries(currentLSDB).forEach(([routerId, routerData]) => {
      // Skip sequence numbers entry
      if (routerId === 'sequenceNumbers') return;
      
      // For each router's view of its neighbors
      if (routerData[routerId] && Array.isArray(routerData[routerId])) {
        routerData[routerId].forEach(neighborId => {
          // Check if the neighbor also knows about this router
          const neighborKnowsThisRouter = currentLSDB[neighborId] && 
              currentLSDB[neighborId][neighborId] &&
              Array.isArray(currentLSDB[neighborId][neighborId]) &&
              currentLSDB[neighborId][neighborId].includes(routerId);
          
          if (neighborKnowsThisRouter) {
            // This is a confirmed bidirectional connection
            const connectionKey = [routerId, neighborId].sort().join('-');
            confirmedConnections.add(connectionKey);
          } else {
            console.log(`Connection ${routerId}-${neighborId} not bidirectional in LSDB - not used for routing`);
          }
        });
      }
    });
    
    console.log(`Router ${startId} confirmed bidirectional connections:`, Array.from(confirmedConnections));
    
    // Now build the graph only with confirmed connections
    confirmedConnections.forEach(connection => {
      const [router1, router2] = connection.split('-');
      
      // Find the physical link to get the cost
      const link = links.find(link => 
        (link.source === router1 && link.target === router2) ||
        (link.source === router2 && link.target === router1)
      );
      
      if (link) {
        // Add the link to the graph with its cost
        if (!graph[router1]) graph[router1] = {};
        if (!graph[router2]) graph[router2] = {};
        
        graph[router1][router2] = link.cost;
        graph[router2][router1] = link.cost;
      }
    });
    
    // Debug the graph
    console.log(`Graph for Router ${startId} routing calculation:`, JSON.stringify(graph, null, 2));
    
    // Special check for the current router - only include connections that the router itself knows about
    // This ensures routers don't route through connections they don't personally know about
    if (currentLSDB[startId] && currentLSDB[startId][startId]) {
      // Get the router's own view of its neighbors
      const ownNeighbors = new Set(currentLSDB[startId][startId]);
      
      // Ensure the router's outgoing connections match its own view
      Object.keys(graph[startId]).forEach(neighborId => {
        if (!ownNeighbors.has(neighborId)) {
          console.log(`Router ${startId} doesn't know about connection to ${neighborId}, removing from graph`);
          delete graph[startId][neighborId];
        }
      });
    }
    
    // Now run Dijkstra on the graph built from LSDB
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
      
      // If we can't find a node or all remaining nodes are unreachable, we're done
      if (current === null || smallestDistance === Infinity) break;
      
      // Remove the current node from unvisited
      unvisited.delete(current);
      
      // Check all neighbors in the graph
      const neighbors = graph[current] || {};
      
      for (const neighbor in neighbors) {
        const cost = neighbors[neighbor];
        if (cost !== undefined) {
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
    
    // For each router except the source
    routers.forEach(router => {
      if (router.id === startId) return; // Skip self (handled separately)
      
      // Skip if no path exists
      if (distances[router.id] === Infinity) return;
      
      // Reconstruct the path to this destination
      let path = [];
      let current = router.id;
      
      while (current !== null) {
        path.unshift(current);
        current = previous[current];
      }
      
      // If we found a valid path (at least 2 nodes)
      if (path.length > 1) {
        // The next hop is the second node in the path
        const nextHop = path[1];
        
        routingTable[router.id] = {
          destination: router.id,
          nextHop,
          cost: distances[router.id]
        };
      }
    });
    
    return routingTable;
  };
  
  // Dijkstra's algorithm for calculating shortest paths
  const calculateDijkstra = (startId) => {
    return calculateDijkstraForRouter(startId, lsdbData);
  };
  
  // Handle simulation pause
  const handlePauseSimulation = () => {
    setSimulationStatus('paused');
    setIsPaused(true);
    
    // Pause all GSAP animations
    gsap.globalTimeline.pause();
    
    // Clear any pending timeouts
    const highestId = setTimeout(() => {}, 0);
    for (let i = 0; i < highestId; i++) {
      clearTimeout(i);
    }
  };
  
  // Handle simulation resume
  const handleResumeSimulation = () => {
    setSimulationStatus('running');
    setIsPaused(false);
    
    // Resume GSAP animations
    gsap.globalTimeline.resume();
  };
  
  // Handle simulation end
  const handleEndSimulation = () => {
    setSimulationStatus('completed');
    
    // Clear all animations
    setPackets([]);
    
    // Calculate routing tables based on current LSDB data
    const updatedLSDB = JSON.parse(JSON.stringify(lsdbData));
    console.log("Final LSDB data:", updatedLSDB);
    
    // Calculate routing tables
    console.log("Calculating routing tables after simulation completion");
    
    // Calculate tables for each router
    const tables = {};
    routers.forEach(router => {
      tables[router.id] = calculateDijkstraForRouter(router.id, updatedLSDB);
      
      // Always ensure there's at least an entry for self
      if (!tables[router.id]) {
        tables[router.id] = {};
      }
      
      // Add route to self
      tables[router.id].self = {
        destination: router.id,
        nextHop: "—", // Em dash to represent direct
        cost: 0
      };
    });
    
    console.log("Generated routing tables:", tables);
    setRoutingTables(tables);
    console.log("Routing tables keys:", Object.keys(tables));
    
    // Update step counter
    setCurrentStep(prev => prev + 1);
  };
  
  // Handle simulation reset - keeps routers and links but resets simulation data
  const handleResetSimulation = () => {
    // Reset simulation data, but keep routers and links
    setLsdbData({});
    setRoutingTables({});
    setProcessedLSPs({});
    setPackets([]);
    setCurrentStep(0);
    setCurrentHighlight(null);
    setSimulationLogs([]);
    
    // Reset to idle state
    setSimulationStatus('idle');
    
    // Resume and clear any paused GSAP animations
    gsap.globalTimeline.clear();
    gsap.globalTimeline.resume();
    
    // Kill any in-progress animations
    gsap.killTweensOf('*');
    
    // Reset the paused state
    setIsPaused(false);
    setAnimationInProgress(false);
    
    // No longer reset animation speed to default - preserve user's preference
  };
  
  // Handle speed change
  const handleSpeedChange = (speed) => {
    setAnimationSpeed(speed);
    
    // Update all active GSAP animations to the new speed
    const allAnimations = gsap.globalTimeline.getChildren();
    allAnimations.forEach(animation => {
      if (animation.isActive()) {
        // Calculate new duration based on the speed
        const newDuration = 1.0 / speed;
        // Get current progress
        const currentProgress = animation.progress();
        // Adjust the timeline to the new speed while preserving progress
        animation.duration(newDuration);
        animation.progress(currentProgress);
      }
    });
  };
  
  // Toggle connect mode
  const toggleConnectMode = () => {
    // If already in connect mode, cancel it by clearing selected routers
    if (connectMode) {
      setConnectMode(false);
      setSelectedRouters([]);
    } else {
      // If turning on connect mode, turn off selection mode
      setConnectMode(true);
      setSelectionMode(false);
      setSelectedElements({routers: [], links: []});
    }
  };

  // Handle cancellation of link creation
  const handleCancelLink = () => {
    // Clear selected routers
    setSelectedRouters([]);
    // Close the modal
    setShowLinkCostModal(false);
    // Exit connect mode
    setConnectMode(false);
  };

  const toggleLeftPanel = () => {
    setLeftPanelVisible(!leftPanelVisible);
  };
  
  const toggleRightPanel = () => {
    setRightPanelVisible(!rightPanelVisible);
  };
  
  // Handle sending a custom packet
  const handleSendCustomPacket = () => {
    // Only allow sending custom packets during simulation
    if (simulationStatus !== 'running' && simulationStatus !== 'paused') return;
    
    // Show the custom packet modal
    setShowCustomPacketModal(true);
  };
  // Function to find a path from source to destination using routing tables
const findPathFromRoutingTable = (sourceId, targetId) => {
  if (sourceId === targetId) return [sourceId]; // Same router

  // Check if source router has a routing table
  if (!routingTables[sourceId]) {
    console.log(`No routing table found for router ${sourceId}`);
    return null;
  }

  // Check if there's a route to the target router
  if (!routingTables[sourceId][targetId]) {
    console.log(`No route from ${sourceId} to ${targetId} in routing table`);
    return null;
  }

  const path = [sourceId];
  let currentRouter = sourceId;

  // Follow the path through the routing table
  while (currentRouter !== targetId) {
    // Get the next hop from the routing table
    const nextHop = routingTables[currentRouter][targetId].nextHop;
    
    // If next hop is a dash or self, it means direct connection or unreachable
    if (nextHop === "—" || nextHop === currentRouter) {
      if (nextHop === currentRouter) {
        // Direct connection
        path.push(targetId);
        break;
      } else {
        console.log(`No valid next hop from ${currentRouter} to ${targetId}`);
        return null;
      }
    }

    path.push(nextHop);
    currentRouter = nextHop;

    // Safety check for loops
    if (path.length > routers.length) {
      console.log('Path finding looks like it has a loop');
      return null;
    }
  }

  return path;
};
// Helper function to calculate a color in a gradient between two colors
function calculateGradientColor(startColor, endColor, ratio) {
  // Parse the hex colors into RGB components
  const start = {
    r: parseInt(startColor.slice(1, 3), 16),
    g: parseInt(startColor.slice(3, 5), 16),
    b: parseInt(startColor.slice(5, 7), 16)
  };
  
  const end = {
    r: parseInt(endColor.slice(1, 3), 16),
    g: parseInt(endColor.slice(3, 5), 16),
    b: parseInt(endColor.slice(5, 7), 16)
  };
  
  // Interpolate between start and end colors
  const r = Math.round(start.r + ratio * (end.r - start.r));
  const g = Math.round(start.g + ratio * (end.g - start.g));
  const b = Math.round(start.b + ratio * (end.b - start.b));
  
  // Convert RGB back to hex
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
// Function to animate a packet along a multi-hop path
const animatePingAlongPath = (path) => {
  if (!path || path.length < 2) {
    console.log('Invalid path for animation');
    return;
  }

  // Mark animation as in progress
  setAnimationInProgress(true);

  // Highlight all links along the path
  const highlightedLinks = [];
  for (let i = 0; i < path.length - 1; i++) {
    const sourceId = path[i];
    const targetId = path[i + 1];

    // Find the link between these routers
    const linkBetween = links.find(link => 
      (link.source === sourceId && link.target === targetId) || 
      (link.source === targetId && link.target === sourceId)
    );

    if (linkBetween) {
      highlightedLinks.push(linkBetween.id);
      // Highlight this link in the UI
      const linkElement = document.getElementById(`link-${linkBetween.id}`);
      if (linkElement) {
        const ratio = i / (path.length - 2); // 0 for first link, 1 for last link
        const color = calculateGradientColor('#ffcc00', '#ff8c00', ratio);
        gsap.to(linkElement, {
          stroke: color,
          strokeWidth: 5,
          duration: 0.3
        });
      }
    }
  }

  // Set up the sequence of animations
  const animateHop = (hopIndex) => {
    if (hopIndex >= path.length - 1) {
      // End of path, animation complete
      setTimeout(() => {
        // Reset link highlights
        highlightedLinks.forEach(linkId => {
          const linkElement = document.getElementById(`link-${linkId}`);
          if (linkElement) {
            gsap.to(linkElement, {
              stroke: '#999',
              strokeWidth: 2,
              duration: 0.3
            });
          }
        });
        
        setAnimationInProgress(false);
        
        // Add log entry for the ping completion
        setSimulationLogs(prev => [
          ...prev,
          {
            message: `PING from Router ${path[0]} to Router ${path[path.length-1]} completed successfully via route: ${path.join(' → ')}`,
            type: 'success',
            timestamp: Date.now()
          }
        ]);
      }, 1000 / animationSpeed);
      return;
    }

    const sourceId = path[hopIndex];
    const targetId = path[hopIndex + 1];

    // Find the router objects
    const sourceRouter = routers.find(r => r.id === sourceId);
    const targetRouter = routers.find(r => r.id === targetId);

    if (!sourceRouter || !targetRouter) {
      console.error(`Router not found for hop ${sourceId} -> ${targetId}`);
      setAnimationInProgress(false);
      return;
    }

    // Animate packet for this hop
    animatePacket(
      sourceId,
      targetId,
      `PING ${path[0]}→${path[path.length-1]}`,
      'ping',
      1000 / animationSpeed,
      () => animateHop(hopIndex + 1) // Move to next hop when this animation completes
    );
  };

  // Start the animation from the first hop
  animateHop(0);
};
  // Process the custom packet from the modal
  const handleCustomPacketSubmit = (packetData) => {
    if (packetData.type === 'hello') {
      // Check if the routers are actually neighbors (connected by a link)
      const areNeighbors = links.some(link => 
        (link.source === packetData.source && link.target === packetData.target) ||
        (link.source === packetData.target && link.target === packetData.source)
      );
      
      if (!areNeighbors) {
        alert(`Routers ${packetData.source} and ${packetData.target} are not neighbors. Hello packets can only be exchanged between directly connected routers.`);
        return;
      }
      
      // Animate a Hello packet between specified routers
      animatePacket(
        packetData.source,
        packetData.target,
        `Hello packet from ${packetData.source} to ${packetData.target}`,
        'hello'
      );
    }else if (packetData.type === 'ping') {
      // Check if source router has a routing table
      if (!routingTables[packetData.source]) {
        alert(`Router ${packetData.source} doesn't have a routing table yet. Please ensure the simulation has been started and routes have been established.`);
        return;
      }
      
      // Find the path using the routing table
      const path = findPathFromRoutingTable(packetData.source, packetData.target);
      
      if (!path) {
        // If no path found, show an error message
        alert(`Router ${packetData.target} is unreachable from ${packetData.source} according to ${packetData.source}'s routing table.`);
        
        // Add log entry
        setSimulationLogs(prev => [
          ...prev,
          {
            message: `PING from Router ${packetData.source} to Router ${packetData.target} failed: destination unreachable`,
            type: 'error',
            timestamp: Date.now()
          }
        ]);
        return;
      }
      
      console.log(`Found path from ${packetData.source} to ${packetData.target}:`, path);
      
      // Animate the packet along the entire path
      animatePingAlongPath(path); 
    } 
    else if (packetData.type === 'lsp') {
      // Check if the source and target are neighbors for LSP (since only neighbors can directly exchange LSPs)
      const areNeighbors = links.some(link => 
        (link.source === packetData.source && link.target === packetData.target) ||
        (link.source === packetData.target && link.target === packetData.source)
      );
      
      if (!areNeighbors) {
        alert(`Routers ${packetData.source} and ${packetData.target} are not neighbors. LSPs can only be sent between directly connected routers.`);
        return;
      }
      
      // Check for bidirectional hello exchange - source must know target as a neighbor
      // This checks if the target is in the source's neighbor list
      const sourceLSDB = lsdbData[packetData.source];
      const bidirectionalExchange = sourceLSDB && 
                                   sourceLSDB[packetData.source] && 
                                   sourceLSDB[packetData.source].includes(packetData.target);
      
      if (!bidirectionalExchange) {
        alert(`Router ${packetData.source} doesn't recognize ${packetData.target} as a neighbor yet. A bidirectional hello packet exchange is required before LSPs can be sent.`);
        return;
      }
      
      // Create LSP content with the format: LSP-A-2 where A is the owner (not the sender)
      const lspContent = `LSP-${packetData.lspOwner}-${packetData.sequenceNumber}`;
      
      // Send LSP from source to target
      animatePacket(
        packetData.source,
        packetData.target,
        lspContent,
        'lsp',
        1000,
        null,
        packetData.lspOwner,  // Pass the LSP owner explicitly
        packetData.sequenceNumber // Pass the sequence number explicitly
      );
    }
  };
  
  // Handle next step button click
  const handleNextStep = () => {
    // Don't process next step if paused or if animation is in progress
    if (isPaused || animationInProgress) return;
    
    // Advance the simulation by one step
    setCurrentStep(prev => prev + 1);
    
    const newStepNumber = currentStep + 1;
    console.log(`\n----- STARTING NEXT STEP: ${newStepNumber} -----`);
    
    // Print current LSDB state for debugging
    console.log("Current LSDB state:", JSON.stringify(lsdbData, null, 2));
    console.log("Current sequence numbers:", JSON.stringify(routerSequenceNumbers, null, 2));
    
    let animationsStarted = false; // Track if we started any animations in this step
    
    // Collect all animations to synchronize them
    const animations = [];
    
    // PHASE 0: Check if we need to broadcast hello messages (every 15 steps)
    if (newStepNumber % 15 === 0) {
      console.log(`Step ${newStepNumber} is a multiple of 15 - broadcasting hello messages from all routers`);
      
      // Get all established neighbor relationships from the LSDB
      const neighborRelationships = [];
      
      Object.entries(lsdbData).forEach(([routerId, routerData]) => {
        // Check if the router knows its own neighbors
        if (routerData[routerId]) {
          // For each neighbor this router knows about
          routerData[routerId].forEach(neighborId => {
            // Create a unique relationship identifier
            const relationship = [routerId, neighborId].sort().join('-');
            
            // Verify that this link still exists in the current topology
            const linkExists = links.some(link => 
              (link.source === routerId && link.target === neighborId) ||
              (link.source === neighborId && link.target === routerId)
            );
            
            // Only add if the link still exists in the current topology
            if (linkExists && !neighborRelationships.includes(relationship)) {
              neighborRelationships.push(relationship);
            } else if (!linkExists) {
              console.log(`Skip hello for ${routerId}-${neighborId}: Link no longer exists in topology`);
            }
          });
        }
      });
      
      console.log(`Broadcasting hello messages for ${neighborRelationships.length} established connections`);
      
      // Group by source-target pairs for staggered delays within each pair
      const groupedHellos = {};
      
      // For each established relationship, prepare hello packets in both directions
      neighborRelationships.forEach((relationship) => {
        const [router1, router2] = relationship.split('-');
        
        // Create or get the group for this router pair
        const pairKey1 = `${router1}-${router2}`;
        if (!groupedHellos[pairKey1]) groupedHellos[pairKey1] = [];
        
        // Add hello from router1 to router2
        groupedHellos[pairKey1].push({
          from: router1,
          to: router2,
          content: `Hello packet from ${router1} to ${router2}`,
          type: 'hello'
        });
        
        // Create or get the group for the reverse direction
        const pairKey2 = `${router2}-${router1}`;
        if (!groupedHellos[pairKey2]) groupedHellos[pairKey2] = [];
        
        // Add hello from router2 to router1
        groupedHellos[pairKey2].push({
          from: router2,
          to: router1,
          content: `Hello packet from ${router2} to ${router1}`,
          type: 'hello'
        });
      });
      
      // Add all hello animations to the queue with appropriate delays within each group
      Object.values(groupedHellos).forEach(group => {
        group.forEach((packet, index) => {
          animations.push({
            ...packet,
            groupDelay: index * 300 // 300ms stagger within each group
          });
        });
      });
      
      if (neighborRelationships.length > 0) {
        animationsStarted = true;
        console.log(`Periodic hello packet broadcast prepared in step ${newStepNumber}`);
      }
    }
    
    // PHASE 1: Process any pending LSP forwards from the previous step
    if (pendingLSPForwards.length > 0) {
      console.log(`Processing ${pendingLSPForwards.length} pending LSP forwards from previous step`);
      
      // Create a copy to process
      const forwardsToProcess = [...pendingLSPForwards];
      
      // Clear the pending queue immediately to prevent double-processing
      setPendingLSPForwards([]);
      
      // Group forwards by source-target pairs for staggered delays within each pair
      const groupedForwards = {};
      
      forwardsToProcess.forEach(forward => {
        const pairKey = `${forward.from}-${forward.to}`;
        if (!groupedForwards[pairKey]) groupedForwards[pairKey] = [];
        groupedForwards[pairKey].push(forward);
      });
      
      // Add all LSP forward animations to the queue with staggered delays
      Object.entries(groupedForwards).forEach(([pairKey, forwards]) => {
        forwards.forEach((forward, index) => {
          animations.push({
            from: forward.from,
            to: forward.to,
            content: forward.content,
            type: 'lsp',
            lspOwner: forward.lspOwner,
            sequenceNumber: forward.sequenceNumber,
            groupDelay: index * 300 // 300ms stagger within each group
          });
        });
      });
      
      animationsStarted = true;
      console.log(`LSP Forwarding animations prepared in step ${newStepNumber}`);
    }
    
    // PHASE 2: Hello Packet Exchange for New Links
    // Track previously established connections to identify new links
    const establishedConnections = new Set();
    
    // For each router in the LSDB, check its neighbors
    Object.entries(lsdbData).forEach(([routerId, routerData]) => {
      // Check if the router has data about itself (its neighbor list)
      if (routerData[routerId]) {
        console.log(`Router ${routerId} knows about these neighbors:`, routerData[routerId]);
        // For each neighbor this router knows about
        routerData[routerId].forEach(neighborId => {
          // Create a unique identifier for this connection (sorted for consistency)
          const connectionKey = [routerId, neighborId].sort().join('-');
          establishedConnections.add(connectionKey);
        });
      } else {
        console.log(`Router ${routerId} doesn't know its own neighbors yet`);
      }
    });
    
    console.log("Established connections:", Array.from(establishedConnections));
    
    // Group new hello packets by source-target pairs
    const groupedNewHellos = {};
    
    // Check for new links that haven't established hello packets yet
    let newLinksFound = false;
    links.forEach((link) => {
      const connectionKey = [link.source, link.target].sort().join('-');
      
      // If this link isn't in the established connections, it's a new link
      if (!establishedConnections.has(connectionKey)) {
        console.log(`Detected new link: ${link.source} <-> ${link.target}`);
        newLinksFound = true;
        
        // Create group for source to target
        const pairKey1 = `${link.source}-${link.target}`;
        if (!groupedNewHellos[pairKey1]) groupedNewHellos[pairKey1] = [];
        
        // Add hello from source to target
        groupedNewHellos[pairKey1].push({
          from: link.source,
          to: link.target,
          content: `Hello packet from ${link.source} to ${link.target}`,
          type: 'hello'
        });
        
        // Create group for target to source
        const pairKey2 = `${link.target}-${link.source}`;
        if (!groupedNewHellos[pairKey2]) groupedNewHellos[pairKey2] = [];
        
        // Add hello from target to source
        groupedNewHellos[pairKey2].push({
          from: link.target,
          to: link.source,
          content: `Hello packet from ${link.target} to ${link.source}`,
          type: 'hello'
        });
      }
    });
    
    // Add all new hello animations to the queue with staggered delays within each group
    Object.values(groupedNewHellos).forEach(group => {
      group.forEach((packet, index) => {
        animations.push({
          ...packet,
          groupDelay: index * 300 // 300ms stagger within each group
        });
      });
    });
    
    if (newLinksFound) {
      animationsStarted = true;
      console.log(`Hello packet exchange animations prepared in step ${newStepNumber}`);
      
      // PHASE 2.5: Exchange of existing LSPs for newly connected routers
      // When routers are newly connected, they need to share ALL their LSPs with each other
      // We'll add this exchange to happen immediately after the hello exchange
      
      console.log("Checking for LSP exchange between newly connected routers");
      
      // Group for LSP exchanges between newly connected routers
      const groupedLSPExchanges = {};
      
      // For each newly detected link
      links.forEach((link) => {
        const connectionKey = [link.source, link.target].sort().join('-');
        
        // Only for new links that just exchanged hello packets
        if (!establishedConnections.has(connectionKey)) {
          const sourceId = link.source;
          const targetId = link.target;
          
          // For each router in the newly formed link
          [sourceId, targetId].forEach(routerId => {
            const neighborId = routerId === sourceId ? targetId : sourceId;
            
            // Get all LSPs this router knows about (except its own, which will be handled by normal LSP flooding)
            const knownLSPs = [];
            
            // Go through the router's LSDB and collect LSPs to share
            if (lsdbData[routerId]) {
              Object.entries(lsdbData[routerId]).forEach(([lspOwnerId, adjacencyList]) => {
                // Skip self entry (handled by normal LSP flooding) and special entries like sequenceNumbers
                if (lspOwnerId !== routerId && lspOwnerId !== 'sequenceNumbers' && Array.isArray(adjacencyList)) {
                  // Get the sequence number for this LSP owner
                  let seqNumber = 0;
                  if (lsdbData[routerId].sequenceNumbers && lsdbData[routerId].sequenceNumbers[lspOwnerId]) {
                    seqNumber = lsdbData[routerId].sequenceNumbers[lspOwnerId];
                  }
                  
                  // Only forward if we have a valid sequence number
                  if (seqNumber > 0) {
                    knownLSPs.push({
                      lspOwner: lspOwnerId,
                      adjacencyList: adjacencyList,
                      sequenceNumber: seqNumber
                    });
                  }
                }
              });
            }
            
            console.log(`Router ${routerId} will share ${knownLSPs.length} received LSPs with new neighbor ${neighborId}`);
            
            // Prepare to send each known LSP to the new neighbor
            knownLSPs.forEach(lsp => {
              const pairKey = `${routerId}-${neighborId}`;
              if (!groupedLSPExchanges[pairKey]) groupedLSPExchanges[pairKey] = [];
              
              groupedLSPExchanges[pairKey].push({
                from: routerId,
                to: neighborId,
                content: `LSP-${lsp.lspOwner}-${lsp.sequenceNumber}`,
                type: 'lsp',
                lspOwner: lsp.lspOwner,
                sequenceNumber: lsp.sequenceNumber,
                data: [lsp.lspOwner, lsp.adjacencyList]  // Pass the actual data
              });
              
              console.log(`Router ${routerId} queueing LSP-${lsp.lspOwner}-${lsp.sequenceNumber} to be sent to new neighbor ${neighborId}`);
            });
          });
        }
      });
      
      // Add all LSP exchange animations to the queue with staggered delays within each group
      // Use a longer initial delay to ensure these happen after hello packets
      Object.values(groupedLSPExchanges).forEach((group, groupIndex) => {
        group.forEach((packet, index) => {
          animations.push({
            ...packet,
            groupDelay: 600 + (groupIndex * 200) + (index * 300) // Start after hello packets, then stagger
          });
        });
      });
      
      if (Object.keys(groupedLSPExchanges).length > 0) {
        console.log(`LSP exchange for newly connected routers prepared: ${Object.keys(groupedLSPExchanges).length} groups`);
        animationsStarted = true;
      }
    }
    
    // PHASE 3: LSP Flooding (Origination Only) - Always check this regardless of hello packets
    // First, make a copy of the current sequence numbers to update
    const updatedSequenceNumbers = { ...routerSequenceNumbers };

    // Get routers with updated topology (those that have neighbors)
    const routersNeedingLSPFlood = new Set();
    
    // Check for LSPs that need to be originated
    console.log("Checking which routers need to originate new LSPs:");
    
    // Log recently incremented routers to help with debugging
    console.log("Routers with recently incremented sequence numbers:", Array.from(recentlyIncrementedSequences));
    
    // First, add all routers that had sequence numbers incremented due to topology changes
    recentlyIncrementedSequences.forEach(routerId => {
      if (lsdbData[routerId] && lsdbData[routerId][routerId]) {
        // Only include if the router knows its own neighbors
        routersNeedingLSPFlood.add(routerId);
        console.log(`Router ${routerId} needs to flood LSP due to recently incremented sequence number`); 
      }
    });
    
    // Check each router to see if it has neighbors but hasn't flooded an LSP
    // or if its topology has changed since the last LSP flooding
    Object.entries(lsdbData).forEach(([routerId, routerData]) => {
      // Skip if router doesn't know about itself yet (no neighbors)
      if (!routerData[routerId]) {
        console.log(`Router ${routerId} doesn't know its own neighbors yet, can't flood LSP`);
        return;
      }
      
      // Skip if already added due to sequence number increment
      if (routersNeedingLSPFlood.has(routerId)) {
        return;
      }
      
      const currentNeighbors = routerData[routerId];
      console.log(`Router ${routerId} has neighbors:`, currentNeighbors);
      
      // If this router has neighbors, it should send an LSP
      if (currentNeighbors.length > 0) {
        // Check if any neighbor doesn't have this router's LSP
        // or if the topology has changed since the last LSP
        const needsToFlood = currentNeighbors.some(neighborId => {
          // If the neighbor doesn't exist in LSDB yet, it needs LSP
          if (!lsdbData[neighborId]) {
            console.log(`Router ${routerId} needs to flood because neighbor ${neighborId} doesn't exist in LSDB yet`);
            return true;
          }
          
          // If the neighbor doesn't know about this router's LSP, it needs one
          if (!lsdbData[neighborId][routerId]) {
            console.log(`Router ${routerId} needs to flood because neighbor ${neighborId} doesn't know about its LSP`);
            return true;
          }
          
          // Check if neighbor has outdated neighbor information
          // Requires deep comparison of neighbor lists
          const neighborView = lsdbData[neighborId][routerId] || [];
          const currentView = routerData[routerId];
          
          // Fix: Sort the arrays before comparison to ensure consistent comparison
          const sortedNeighborView = [...neighborView].sort();
          const sortedCurrentView = [...currentView].sort();
          
          // Compare arrays using JSON.stringify for deep equality
          const neighborViewStr = JSON.stringify(sortedNeighborView);
          const currentViewStr = JSON.stringify(sortedCurrentView);
          
          // Check if the neighbor has an outdated view of this router's neighbors
          const contentOutdated = neighborViewStr !== currentViewStr;
          
          // Also check if the neighbor has an outdated sequence number
          const currentSeqNum = routerSequenceNumbers[routerId] || 0;
          const neighborSeqNums = (lsdbData[neighborId].sequenceNumbers || {});
          const neighborSeqNum = neighborSeqNums[routerId] || 0;
          const seqNumOutdated = currentSeqNum > neighborSeqNum;
          
          // Log the sequence number comparison
          if (seqNumOutdated) {
            console.log(`Router ${routerId} needs to flood because neighbor ${neighborId} has outdated sequence number: ${neighborSeqNum} vs ${currentSeqNum}`);
          }
          
          if (contentOutdated) {
            console.log(`Router ${routerId} needs to flood because neighbor ${neighborId} has outdated view: ${neighborView} vs ${currentView}`);
          }
          
          return contentOutdated || seqNumOutdated;
        });
        
        if (needsToFlood) {
          routersNeedingLSPFlood.add(routerId);
          console.log(`Router ${routerId} needs to flood LSP to its neighbors`);
        } else {
          console.log(`Router ${routerId} doesn't need to flood LSP (neighbors have current info)`);
        }
      }
    });
    
    console.log(`Routers needing to flood LSPs: ${Array.from(routersNeedingLSPFlood).join(', ') || 'None'}`);
    
    // Group LSP origination packets by source-target pairs
    const groupedLSPOriginations = {};
    
    // For each router that needs to flood, prepare LSPs to all its neighbors
    routersNeedingLSPFlood.forEach(routerId => {
      // Get the router's current neighbors
      const neighbors = lsdbData[routerId][routerId];
      
      // Increment sequence number (or initialize to 1 if not yet set)
      // BUT ONLY if it wasn't already incremented by a topology change
      if (!recentlyIncrementedSequences.has(routerId)) {
        if (!updatedSequenceNumbers[routerId]) {
          updatedSequenceNumbers[routerId] = 1;
        } else {
          updatedSequenceNumbers[routerId]++;
        }
        console.log(`Incremented sequence number for router ${routerId} to ${updatedSequenceNumbers[routerId]}`);
      } else {
        console.log(`Router ${routerId} sequence number already incremented by topology change, keeping at ${updatedSequenceNumbers[routerId]}`);
      }
      
      const seqNumber = updatedSequenceNumbers[routerId];
      
      console.log(`Router ${routerId} flooding LSP with sequence ${seqNumber} to ${neighbors.length} neighbors:`, neighbors);
      
      // Prepare an LSP from this router to each of its neighbors
      neighbors.forEach((neighborId) => {
        const pairKey = `${routerId}-${neighborId}`;
        if (!groupedLSPOriginations[pairKey]) groupedLSPOriginations[pairKey] = [];
        
        groupedLSPOriginations[pairKey].push({
          from: routerId,
          to: neighborId,
          content: `LSP-${routerId}-${seqNumber}`,
          type: 'lsp',
          lspOwner: routerId,
          sequenceNumber: seqNumber
        });
      });
      
      animationsStarted = true;
    });
    
    // Add all LSP origination animations to the queue with staggered delays within each group
    Object.values(groupedLSPOriginations).forEach(group => {
      group.forEach((packet, index) => {
        animations.push({
          ...packet,
          groupDelay: index * 300 // 300ms stagger within each group
        });
      });
    });
    
    // Update sequence numbers in state if any were changed
    if (JSON.stringify(updatedSequenceNumbers) !== JSON.stringify(routerSequenceNumbers)) {
      console.log("Updating sequence numbers:", updatedSequenceNumbers);
      setRouterSequenceNumbers(updatedSequenceNumbers);
    } else {
      console.log("No sequence numbers were updated");
    }
    
    // Execute all animations synchronously with their group delays
    if (animations.length > 0) {
      // Set animation in progress to prevent new steps
      setAnimationInProgress(true);
      
      // Count how many animations we're waiting for
      let pendingAnimations = animations.length;
      const animationCompletionCallback = () => {
        pendingAnimations--;
        if (pendingAnimations <= 0) {
          // All animations are complete
          setAnimationInProgress(false);
        }
      };
      
      // Start all animations simultaneously (respecting their group delays)
      animations.forEach(animation => {
        setTimeout(() => {
          animatePacket(
            animation.from,
            animation.to,
            animation.content,
            animation.type,
            1000, // same duration for all packets
            animationCompletionCallback,
            animation.lspOwner,
            animation.sequenceNumber,
            animation.data // Pass the LSP data if available
          );
        }, animation.groupDelay || 0);
      });
      
      animationsStarted = true;
      console.log(`Started ${animations.length} synchronized animations in step ${newStepNumber}`);
    }
    
    // If no animations were started in this step, check if simulation is complete
    if (!animationsStarted) {
      console.log("No animations were started in this step. Link-state database may be stable.");
      
      // Check if all routers have complete routing tables
      const allRoutersHaveTables = routers.every(router => {
        // Skip check if routing tables aren't initialized yet
        if (!routingTables[router.id]) return false;
        
        // Count routes to other routers (excluding self)
        const routes = Object.keys(routingTables[router.id]).filter(k => k !== 'self');
        // A router should have routes to all other routers in a connected network
        return routes.length === routers.length - 1;
      });
      
      if (allRoutersHaveTables) {
        console.log("All routers have complete routing tables. Simulation can be finished.");
      } else {
        console.log("Routing tables are not yet complete. Continue simulation.");
      }
    }
    
    // Log completion of this step with a summary of what happened
    let stepSummary = [];
    if (newStepNumber % 15 === 0 && routers.length > 0) stepSummary.push("Hello broadcast");
    if (pendingLSPForwards.length > 0) stepSummary.push("LSP forwarding");
    if (newLinksFound) stepSummary.push("Hello exchange");
    if (routersNeedingLSPFlood.size > 0) stepSummary.push("LSP origination");
    
    const stepTypeDescription = stepSummary.length > 0 
      ? `(${stepSummary.join(", ")})`
      : "(No actions)";
    
    // Only clear the recently incremented sequences if they were actually processed
    // or if there's nothing to process (prevents accumulation of stale entries)
    const shouldClearIncrements = routersNeedingLSPFlood.size > 0 || recentlyIncrementedSequences.size === 0;
    
    if (shouldClearIncrements) {
      setRecentlyIncrementedSequences(new Set());
      console.log("Cleared recently incremented sequence numbers tracking");
    } else {
      console.log("Preserving recently incremented sequence numbers for next step");
    }
      
    console.log(`----- COMPLETED NEXT STEP: ${newStepNumber} ${stepTypeDescription} -----\n`);
  };
  
  // Handle edit topology button click
  const handleEditTopology = () => {
    // Pause the simulation if it's running
    if (simulationStatus === 'running') {
      handlePauseSimulation();
    }
    
    // You could show a message or enable specific UI elements here
    console.log("Entering topology edit mode");
    
    // Toggle the ability to modify the network while simulation is paused
    // This is a placeholder - implement the actual topology editing mode based on your app's needs
    // You might want to set a special state variable like setTopologyEditMode(true)
  };
  
  // Add CSS for the simulation info and step counter
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      .simulation-info {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .step-counter {
        background-color: #4a5568;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: bold;
        font-size: 14px;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  
  // Handle tutorial completion
  const handleTutorialComplete = () => {
    console.log('Tutorial completed, hiding it');
    setShowTutorial(false);
    // Store in localStorage to remember the user has completed the tutorial
    localStorage.setItem('lsaTutorialCompleted', 'true');
  };
  
  return (
    <div className="router-simulator">
      {showTutorial && (
        console.log('About to render Tutorial component, showTutorial:', showTutorial),
        <Tutorial key="tutorial" onComplete={handleTutorialComplete} />
      )}
      <div className="simulator-wrapper">
        {/* Toolbox */}
        <div className="toolbox">
          <div className="toolbox-title">
            <h1>Link State Routing Simulator</h1>
            <div className="simulation-info">
              <div className={`simulation-status-badge status-${simulationStatus}`}>
                {simulationStatus.charAt(0).toUpperCase() + simulationStatus.slice(1)}
              </div>
              {simulationStatus !== 'idle' && (
                <div className="step-counter">
                  Step: {currentStep}
                </div>
              )}
            </div>
          </div>
          <div className="toolbox-actions">
            <div
              className="router-template"
              draggable
              onDragStart={handleRouterDragStart}
              onDragEnd={handleRouterDragEnd}
              style={{ pointerEvents: 'auto' }}
            >
              Drag to add Router
            </div>
            <button 
              onClick={toggleConnectMode}
              className={`toolbox-button ${connectMode ? 'active' : ''}`}
              disabled={simulationStatus === 'running' || selectionMode || moveMode}
            >
              {connectMode ? 'Cancel Connect' : 'Connect Routers'}
            </button>
            
            {!selectionMode ? (
              // Show "Delete Elements" button when not in selection mode
              <button 
                onClick={() => {
                  // Turn off other modes
                  setSelectionMode(true);
                  setConnectMode(false);
                  setMoveMode(false);
                  setSelectedRouters([]);
                }}
                className="toolbox-button"
                disabled={simulationStatus === 'running' || moveMode}
              >
                Delete Elements
              </button>
            ) : (
              // Show Delete and Cancel buttons when in selection mode
              <>
                <button 
                  onClick={deleteSelectedElements}
                  className="toolbox-button delete-button"
                  disabled={selectedElements.routers.length === 0 && selectedElements.links.length === 0}
                >
                  Delete
                </button>
                <button 
                  onClick={() => {
                    setSelectionMode(false);
                    setSelectedElements({routers: [], links: []});
                  }}
                  className="toolbox-button"
                >
                  Cancel
                </button>
              </>
            )}
            
            <button
              onClick={() => {
                // Turn off other modes
                if (moveMode) {
                  setMoveMode(false);
                } else {
                  setMoveMode(true);
                  setConnectMode(false);
                  setSelectionMode(false);
                  setSelectedRouters([]);
                  setSelectedElements({routers: [], links: []});
                }
              }}
              className={`toolbox-button ${moveMode ? 'active' : ''}`}
              disabled={simulationStatus === 'running'}
            >
              {moveMode ? 'Exit Move Mode' : 'Move Elements'}
            </button>
            <button
              onClick={() => {
                console.log('Help button clicked, showing tutorial');
                // Force showing the tutorial and reset localStorage
                localStorage.removeItem('lsaTutorialCompleted');
                setShowTutorial(true);
              }}
              className="toolbox-button"
              title="View the tutorial again"
            >
              Help
            </button>
            <button 
              onClick={handleSendCustomPacket}
              className="toolbox-button custom-button"
              disabled={simulationStatus !== 'running' && simulationStatus !== 'paused' || isPaused}
            >
              Send Custom Packet
            </button>
          </div>
        </div>
        
        {/* Main simulator container with the stage and 3D scene */}
        <div className="simulator-container">
          <div 
            className={`simulator-stage ${selectionMode || moveMode ? 'selection-mode-active' : ''}`}
            ref={stageRef}
            onDragOver={handleRouterDragOver}
            onDrop={handleRouterDrop}
          >
            <ThreeScene
              routers={routers}
              links={links}
              packets={packets}
              onRouterClick={handleRouterClick}
              onRouterDrag={handleRouterDrag}
              onLinkClick={handleLinkClick}
              selectedRouters={selectedRouters}
              selectedElements={selectedElements}
              disabled={simulationStatus === 'running' && !isPaused}
              connectMode={connectMode}
              selectionMode={selectionMode}
              moveMode={moveMode}
              simulationStatus={simulationStatus}
              isDraggingRouter={isDraggingRouter}
              dropIndicatorPos={dropIndicatorPos}
            />
          </div>
          
          {/* Left panel with LSDB */}
          <div className={`left-panel ${!leftPanelVisible ? 'collapsed' : ''}`}>
            <LSDBPanel 
              lsdbData={lsdbData}
              routingTables={routingTables}
              currentHighlight={currentHighlight}
              simulationStatus={simulationStatus}
              links={links}
              simulationLogs={simulationLogs}
            />
          </div>
          
          {/* Button to toggle left panel */}
          <button 
            className={`panel-toggle left-panel-toggle ${!leftPanelVisible ? 'collapsed' : ''}`}
            onClick={toggleLeftPanel}
            aria-label={leftPanelVisible ? 'Hide left panel' : 'Show left panel'}
          >
            {leftPanelVisible ? '◄' : '►'}
          </button>
          
          {/* Control Panel with disabled state for pause */}
          <div className={`right-panel ${!rightPanelVisible ? 'collapsed' : ''}`}>
            <ControlPanel 
              onStartSimulation={handleStartSimulation}
              onPauseSimulation={handlePauseSimulation}
              onResumeSimulation={handleResumeSimulation}
              onEndSimulation={handleEndSimulation}
              onResetSimulation={handleResetSimulation}
              onSpeedChange={handleSpeedChange}
              onSendCustomPacket={handleSendCustomPacket}
              onNextStep={handleNextStep}
              simulationStatus={simulationStatus}
              speed={animationSpeed}
              disabled={routers.length < 2 || links.length === 0}
              currentStep={currentStep}
              isPaused={isPaused}
              animationInProgress={animationInProgress}
            />
          </div>
          
          {/* Button to toggle right panel */}
          <button 
            className={`panel-toggle right-panel-toggle ${!rightPanelVisible ? 'collapsed' : ''}`}
            onClick={toggleRightPanel}
            aria-label={rightPanelVisible ? 'Hide right panel' : 'Show right panel'}
          >
            {rightPanelVisible ? '►' : '◄'}
          </button>
        </div>
        
        {/* Link cost modal overlay */}
        {showLinkCostModal && (
          <LinkCostModal 
            onClose={handleCancelLink}
            onAddLink={handleAddLink}
          />
        )}
        
        {/* Custom packet modal overlay */}
        {showCustomPacketModal && (
          <CustomPacketModal
            onClose={() => setShowCustomPacketModal(false)}
            onSendPacket={handleCustomPacketSubmit}
            routers={routers}
            lsdbData={lsdbData}
          />
        )}
      </div>
    </div>
  );
};

export default RouterSimulator; 