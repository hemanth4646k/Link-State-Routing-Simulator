import React, { useState, useRef, useEffect } from 'react';
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
    // Don't allow dragging during simulation
    if (simulationStatus === 'running') return; 
    
    // In selection mode, only selected routers can be dragged
    if (selectionMode && !selectedElements.routers.includes(id)) return;
    
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
    // If in simulation, don't allow selection
    if (simulationStatus === 'running') return;
    
    if (connectMode) {
      if (selectedRouters.length === 0) {
        // First router selected for connection
        setSelectedRouters([id]);
      } else if (selectedRouters[0] !== id) {
        // Second router selected, show link cost modal
        setSelectedRouters([...selectedRouters, id]);
        setShowLinkCostModal(true);
      }
    } else if (selectionMode) {
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
    if (simulationStatus === 'running' || connectMode) return;
    
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
    // Clear existing selections when toggling
    setSelectedElements({routers: [], links: []});
    
    // Toggle the mode
    const newSelectionMode = !selectionMode;
    setSelectionMode(newSelectionMode);
    
    // Disable connect mode if we're entering selection mode
    if (newSelectionMode) {
      setConnectMode(false);
      setSelectedRouters([]);
    }
  };
  
  // Delete selected elements
  const deleteSelectedElements = () => {
    if (simulationStatus === 'running') return;
    
    const { routers: selectedRouterIds, links: selectedLinkIds } = selectedElements;
    
    // Delete selected links
    if (selectedLinkIds.length > 0) {
      setLinks(prev => prev.filter(link => !selectedLinkIds.includes(link.id)));
    }
    
    // Delete selected routers and all their connected links
    if (selectedRouterIds.length > 0) {
      // First, find all links connected to the selected routers
      const linkedLinkIds = links.filter(link => 
        selectedRouterIds.includes(link.source) || selectedRouterIds.includes(link.target)
      ).map(link => link.id);
      
      // Remove the routers
      setRouters(prev => prev.filter(router => !selectedRouterIds.includes(router.id)));
      
      // Remove all links connected to deleted routers
      setLinks(prev => prev.filter(link => !linkedLinkIds.includes(link.id)));
    }
    
    // Clear selection
    setSelectedElements({routers: [], links: []});
    setSelectionMode(false);
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
    
    // Reset any in-progress simulation state
    setCurrentStep(0);
    setCurrentHighlight(null);
    setPackets([]);
    setSimulationLogs([]); // Clear previous logs
    
    setSimulationStatus('running');
    
    // Convert our links to the format expected by the flooding algorithm
    const edgesForSimulation = links.map(link => [link.source, link.target, link.cost]);
    
    // Reset simulation data
    // Note: We're keeping any existing router and link data, but resetting the simulation state
    setLsdbData({});
    setRoutingTables({});
    setProcessedLSPs({});
    setRouterSequenceNumbers({}); // Reset sequence numbers
    
    // Start with empty LSDBs for each router
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
  const animatePacket = (fromId, toId, packetData, packetType = 'lsp', animationDuration = 1000, externalCallback = null, lspOwner = null, sequenceNumber = null) => {
    const fromRouter = routers.find(r => r.id === fromId);
    const toRouter = routers.find(r => r.id === toId);
    
    if (!fromRouter || !toRouter) {
      // If routers not found, still call the callback to maintain step progression
      if (externalCallback) externalCallback();
      return;
    }
    
    // Calculate center points of routers for the 3D scene
    const fromX = fromRouter.x;
    const fromY = fromRouter.y;
    const toX = toRouter.x;
    const toY = toRouter.y;
    
    // Use fixed packet size for consistency in 3D space
    const packetSize = 30;
    
    // Create packet with unique ID based on source, target and timestamp
    const timestamp = Date.now();
    const packetId = `packet-${fromId}-${toId}-${timestamp}-${Math.floor(Math.random() * 1000)}`;
    
    // Extract data for processing in two formats:
    // 1. The old format: "LSPA: ["B","C"]"
    // 2. The new format: "LSP-A-2"
    let nodeId = null;
    let adjList = [];
    let extractedSeqNumber = null;
    
    if (packetType === 'lsp' && typeof packetData === 'string') {
      // Try to match the new format first: "LSP-A-2"
      const newFormatMatch = packetData.match(/LSP-([A-Z])-(\d+)/);
      if (newFormatMatch) {
        // Use the explicit LSP owner if provided, otherwise use from the packet data
        nodeId = lspOwner || newFormatMatch[1];
        extractedSeqNumber = parseInt(newFormatMatch[2]);
        
        // For new format, get the ACTUAL established neighbors from LSDB
        // A neighbor is only established if BOTH routers know about each other
        // This means the owner router should have them in its LSDB
        if (lsdbData[nodeId] && lsdbData[nodeId][nodeId]) {
          // Use the confirmed neighbors from LSDB rather than physical links
          adjList = lsdbData[nodeId][nodeId];
        } else {
          // If no LSDB entry found, router doesn't know any neighbors yet
          adjList = [];
        }
      } else {
        // Fall back to the old format: "LSPA: ["B","C"]"
        const oldFormatMatch = packetData.match(/LSP([A-Z]): (\[[^\]]+\])/);
        if (oldFormatMatch) {
          nodeId = oldFormatMatch[1];
          try {
            adjList = JSON.parse(oldFormatMatch[2]);
          } catch (e) {
            console.error("Error parsing LSP data:", e);
          }
        }
      }
    }
    
    // Use the sequence number provided as parameter if available
    const finalSequenceNumber = sequenceNumber || extractedSeqNumber;
    
    // Store additional metadata for the packet
    const metadata = {
      lspOwner: lspOwner,
      sequenceNumber: finalSequenceNumber,
      sourceRouter: fromId
    };
    
    const newPacket = {
      id: packetId,
      from: fromId,
      to: toId,
      data: packetData, // Store the original packet data for display
      type: packetType,
      x: fromX,
      y: fromY,
      size: packetSize,
      metadata: metadata // Store the metadata for easy access
    };
    
    // Add packet to state
    setPackets(prev => [...prev, newPacket]);
    
    // Calculate distance between routers for adaptive timing
    const dx = toX - fromX;
    const dy = toY - fromY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Calculate appropriate animation duration based on distance
    // Cap between 0.3 seconds and 8 seconds (depending on speed)
    const minDuration = 0.3;
    const maxDuration = 5 / animationSpeed; // Reduced max duration for better experience
    
    // Calculate duration based on distance and animation speed
    const distanceFactor = Math.min(1.0, distance / 500); // Normalize distance
    const baseDuration = (minDuration + (maxDuration - minDuration) * distanceFactor) / animationSpeed;
    
    // Calculate final duration with a minimum for short distances
    const durationInSeconds = Math.max(minDuration, baseDuration);
    
    // Create a GSAP animation to update the packet position
    gsap.to({}, {
      duration: durationInSeconds,
      ease: "power2.inOut", // Smoother animation
      onUpdate: function() {
        // Calculate current position based on progress
        const progress = this.progress();
        const currentX = fromX + (toX - fromX) * progress;
        const currentY = fromY + (toY - fromY) * progress;
        
        // Update packet position in state
        setPackets(prevPackets => 
          prevPackets.map(p => 
            p.id === packetId 
              ? { ...p, x: currentX, y: currentY } 
              : p
          )
        );
      },
      onComplete: () => {
        // Find the packet data before removing it
        const currentPackets = [...packets]; // Get a snapshot of current packets
        const packet = currentPackets.find(p => p.id === packetId);
        
        // Remove packet when animation completes
        setPackets(prev => prev.filter(p => p.id !== packetId));
        
        // Update LSDB based on packet type
        if (packetType === 'lsp') {
          if (nodeId && adjList) {
            // Create the data for LSDB update with the router adjList
            const updateData = [nodeId, adjList];
            
            // Pass the source router and sequence number to the update function
            const packetMetadata = packet ? packet.metadata : metadata;
            updateLSDB(toId, updateData, packetMetadata);
            highlightChange(toId, updateData);
          }
        } else if (packetType === 'hello') {
          // For Hello packets, update the LSDB to note the neighbor connection
          // When a router receives a Hello, it should record that router as a neighbor
          updateHelloPacket(fromId, toId);
        }
        
        // Call external callback if provided to signal completion for step sequencing
        if (externalCallback) {
          // Call the callback immediately to avoid waiting
          externalCallback();
        }
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
    
    // If router has already processed this exact LSP, skip the update
    if (alreadyProcessed) {
      console.log(`Router ${routerId} skipping already processed LSP: ${lspKey}`);
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
      } else {
        console.log(`Router ${routerId} discarded LSP from ${lspOwner} with sequence ${seqNumber} (already has ${currentSeq})`);
        return; // Skip processing entirely
      }
    } else {
      // If no sequence number, we'll still update LSDB but not forward
      console.log(`Router ${routerId} received LSP without sequence number, will update LSDB but not forward`);
      shouldUpdateLSDB = true;
    }
    
    // Now update processed LSPs to mark this LSP as processed
    setProcessedLSPs(prev => {
      const updated = { ...prev };
      
      // Initialize the set if it doesn't exist
      if (!updated[routerId]) {
        updated[routerId] = new Set();
      }
      
      // Mark it as processed
      updated[routerId].add(lspKey);
      
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
        
        // Update the adjacency list
        lsdbUpdated[routerId][nodeId] = adjList;
        console.log(`Router ${routerId} updated LSDB with ${nodeId}'s adjacency list:`, adjList);
        
        // Now that we've updated the LSDB, update the sequence number
        if (seqNumber !== null) {
          // Initialize sequence number tracking if needed
          if (!lsdbUpdated[routerId].sequenceNumbers) {
            lsdbUpdated[routerId].sequenceNumbers = {};
          }
          
          // Update to the new sequence number
          lsdbUpdated[routerId].sequenceNumbers[lspOwner] = seqNumber;
          console.log(`Router ${routerId} updated sequence number for ${lspOwner} to ${seqNumber}`);
        }
        
        // Instead of forwarding LSPs immediately, queue them for the next step
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
              
              // Create a map of existing pending forwards to prevent duplicates
              // We'll use this to check before adding new forwards
              setPendingLSPForwards(prev => {
                // Create a map of existing forwards for duplicate checking
                const existingForwards = new Map();
                prev.forEach(forward => {
                  const key = `${forward.from}-${forward.to}-${forward.lspOwner}-${forward.sequenceNumber}`;
                  existingForwards.set(key, true);
                });
                
                // Only add forwards that don't exist yet
                const newForwards = forwardingTargets
                  .map(targetId => {
                    const forwardKey = `${routerId}-${targetId}-${lspOwner}-${seqNumber}`;
                    // Only include if not already in the queue
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
                  .filter(forward => forward !== null); // Remove any nulls
                
                console.log(`Adding ${newForwards.length} new forwards, skipping ${forwardingTargets.length - newForwards.length} duplicates`);
                
                // Combine with existing forwards
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
        // This ensures the left panel shows updated information after each packet
        setTimeout(() => {
          // Calculate updated routing tables for this router
          const routerTables = calculateDijkstraForRouter(routerId, lsdbUpdated);
          
          // Update routing tables state with the new information
          setRoutingTables(prevTables => {
            const updatedTables = { ...prevTables };
            
            // Initialize router entry if it doesn't exist
            if (!updatedTables[routerId]) {
              updatedTables[routerId] = {};
            }
            
            // Add self-route if missing
            if (!updatedTables[routerId].self) {
              updatedTables[routerId].self = {
                destination: routerId,
                nextHop: "—", // Em dash to represent direct
                cost: 0
              };
            }
            
            // Merge in the new calculated routes
            if (routerTables) {
              Object.keys(routerTables).forEach(destId => {
                if (destId !== 'self') {
                  updatedTables[routerId][destId] = routerTables[destId];
                }
              });
            }
            
            return updatedTables;
          });
        }, 10); // Very small timeout to ensure state updates have completed
        
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
    
    // Build a graph directly from links for guaranteed correctness
    const graph = {};
    
    // Initialize the graph structure
    routers.forEach(router => {
      graph[router.id] = {};
    });
    
    // Add all links to the graph with their costs
    links.forEach(link => {
      const source = link.source;
      const target = link.target;
      const cost = link.cost;
      
      if (!graph[source]) graph[source] = {};
      if (!graph[target]) graph[target] = {};
      
      graph[source][target] = cost;
      graph[target][source] = cost;
    });
    
    // Now run Dijkstra on the complete graph
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
  };
  
  // Handle simulation resume
  const handleResumeSimulation = () => {
    setSimulationStatus('running');
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
    
    // Reset animation speed to default if needed
    if (animationSpeed !== 0.5) {
      setAnimationSpeed(0.5);
    }
  };
  
  // Handle speed change
  const handleSpeedChange = (speed) => {
    setAnimationSpeed(speed);
  };
  
  // Toggle connect mode
  const toggleConnectMode = () => {
    setConnectMode(!connectMode);
    setSelectedRouters([]);
    setSelectionMode(false);
    setSelectedElements({routers: [], links: []});
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
    } else if (packetData.type === 'lsp') {
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
    // Advance the simulation by one step
    setCurrentStep(prev => prev + 1);
    
    const newStepNumber = currentStep + 1;
    console.log(`\n----- STARTING NEXT STEP: ${newStepNumber} -----`);
    
    // Print current LSDB state for debugging
    console.log("Current LSDB state:", JSON.stringify(lsdbData, null, 2));
    console.log("Current sequence numbers:", JSON.stringify(routerSequenceNumbers, null, 2));
    
    let animationsStarted = false; // Track if we started any animations in this step
    
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
            if (!neighborRelationships.includes(relationship)) {
              neighborRelationships.push(relationship);
            }
          });
        }
      });
      
      console.log(`Broadcasting hello messages for ${neighborRelationships.length} established connections`);
      
      // For each established relationship, send hello packets in both directions
      neighborRelationships.forEach((relationship, index) => {
        const [router1, router2] = relationship.split('-');
        const baseDelay = 200; // shorter delay for hello broadcasts to avoid waiting too long
        const staggeredDelay = index * baseDelay;
        
        // Send hello from router1 to router2
        setTimeout(() => {
          animatePacket(
            router1,
            router2,
            `Hello packet from ${router1} to ${router2}`,
            'hello'
          );
        }, staggeredDelay);
        
        // Send hello from router2 to router1 with a small additional delay
        setTimeout(() => {
          animatePacket(
            router2,
            router1,
            `Hello packet from ${router2} to ${router1}`,
            'hello'
          );
        }, staggeredDelay + 100);
        
        console.log(`Scheduled hello packet exchange for ${router1} <-> ${router2} with delay ${staggeredDelay}ms`);
      });
      
      if (neighborRelationships.length > 0) {
        animationsStarted = true;
        console.log(`Periodic hello packet broadcast initiated in step ${newStepNumber}`);
      }
    }
    
    // PHASE 1: Process any pending LSP forwards from the previous step
    if (pendingLSPForwards.length > 0) {
      console.log(`Processing ${pendingLSPForwards.length} pending LSP forwards from previous step`);
      
      // Create a copy to process
      const forwardsToProcess = [...pendingLSPForwards];
      
      // Clear the pending queue immediately to prevent double-processing
      setPendingLSPForwards([]);
      
      // Group forwards by source router to add staggered delays
      const forwardsBySource = {};
      forwardsToProcess.forEach(forward => {
        if (!forwardsBySource[forward.from]) {
          forwardsBySource[forward.from] = [];
        }
        forwardsBySource[forward.from].push(forward);
      });
      
      // Process each group of forwards with staggered delays
      Object.entries(forwardsBySource).forEach(([sourceRouter, forwards]) => {
        // Calculate equal time intervals for packet animations from the same source
        const totalForwardsFromSource = forwards.length;
        const baseDelay = 500; // base delay for packet spacing
        
        // Process each forward with a staggered delay
        forwards.forEach((forward, index) => {
          const staggeredDelay = index * baseDelay;
          
          console.log(`Forwarding LSP-${forward.lspOwner}-${forward.sequenceNumber} from ${forward.from} to ${forward.to} with delay ${staggeredDelay}ms`);
          
          // Use setTimeout to stagger the animations
          setTimeout(() => {
            animatePacket(
              forward.from,
              forward.to,
              forward.content,
              'lsp',
              1000,
              null,
              forward.lspOwner,
              forward.sequenceNumber
            );
          }, staggeredDelay);
        });
      });
      
      animationsStarted = true;
      console.log(`LSP Forwarding animations started in step ${newStepNumber}`);
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
    
    // Check for new links that haven't established hello packets yet
    let newLinksFound = false;
    links.forEach((link, linkIndex) => {
      const connectionKey = [link.source, link.target].sort().join('-');
      
      // If this link isn't in the established connections, it's a new link
      if (!establishedConnections.has(connectionKey)) {
        console.log(`Detected new link: ${link.source} <-> ${link.target}`);
        newLinksFound = true;
        
        // Base delay for staggering hello packets
        const baseDelay = 500; // base delay for packet spacing
        const linkDelay = linkIndex * baseDelay;
        
        // Send hello packets in both directions with staggered delays
        // From source to target
        setTimeout(() => {
          animatePacket(
            link.source,
            link.target,
            `Hello packet from ${link.source} to ${link.target}`,
            'hello'
          );
        }, linkDelay);
        
        // From target to source (add a small additional delay)
        setTimeout(() => {
          animatePacket(
            link.target,
            link.source,
            `Hello packet from ${link.target} to ${link.source}`,
            'hello'
          );
        }, linkDelay + 250); // additional delay for paired hello packets
        
        console.log(`Initiated hello packet exchange for new link: ${link.source} <-> ${link.target} with delay ${linkDelay}ms`);
      }
    });
    
    if (newLinksFound) {
      animationsStarted = true;
      console.log(`Hello packet exchange animations started in step ${newStepNumber}`);
    }
    
    // PHASE 3: LSP Flooding (Origination Only) - Always check this regardless of hello packets
    // For each router that has neighbors, originate an LSP to all neighbors
    // First, make a copy of the current sequence numbers to update
    const updatedSequenceNumbers = { ...routerSequenceNumbers };

    // Get routers with updated topology (those that have neighbors)
    const routersNeedingLSPFlood = new Set();
    
    // Check for LSPs that need to be originated
    console.log("Checking which routers need to originate new LSPs:");
    
    // Check each router to see if it has neighbors but hasn't flooded an LSP
    // or if its topology has changed since the last LSP flooding
    Object.entries(lsdbData).forEach(([routerId, routerData]) => {
      // Skip if router doesn't know about itself yet (no neighbors)
      if (!routerData[routerId]) {
        console.log(`Router ${routerId} doesn't know its own neighbors yet, can't flood LSP`);
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
          
          // Compare arrays
          const isOutdated = neighborView.length !== currentView.length || 
                             !neighborView.every(n => currentView.includes(n));
          
          if (isOutdated) {
            console.log(`Router ${routerId} needs to flood because neighbor ${neighborId} has outdated view: ${neighborView} vs ${currentView}`);
            return true;
          }
          
          return false;
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
    
    // For each router that needs to flood, send LSPs to all its neighbors
    routersNeedingLSPFlood.forEach(routerId => {
      // Get the router's current neighbors
      const neighbors = lsdbData[routerId][routerId];
      
      // Increment sequence number (or initialize to 1 if not yet set)
      if (!updatedSequenceNumbers[routerId]) {
        updatedSequenceNumbers[routerId] = 1;
      } else {
        updatedSequenceNumbers[routerId]++;
      }
      
      const seqNumber = updatedSequenceNumbers[routerId];
      
      console.log(`Router ${routerId} flooding LSP with sequence ${seqNumber} to ${neighbors.length} neighbors:`, neighbors);
      
      // Calculate equal time intervals for packet animations
      const baseDelay = 500; // base delay for packet spacing
      
      // Send an LSP from this router to each of its neighbors with staggered delays
      neighbors.forEach((neighborId, index) => {
        const staggeredDelay = index * baseDelay;
        
        console.log(`Sending LSP-${routerId}-${seqNumber} from ${routerId} to ${neighborId} with delay ${staggeredDelay}ms`);
        
        // Use setTimeout to stagger the animations
        setTimeout(() => {
          animatePacket(
            routerId,
            neighborId,
            `LSP-${routerId}-${seqNumber}`,
            'lsp',
            1000,
            null,
            routerId,
            seqNumber // Pass sequence number directly
          );
        }, staggeredDelay);
      });
      
      animationsStarted = true;
    });
    
    // Update sequence numbers in state if any were changed
    if (JSON.stringify(updatedSequenceNumbers) !== JSON.stringify(routerSequenceNumbers)) {
      console.log("Updating sequence numbers:", updatedSequenceNumbers);
      setRouterSequenceNumbers(updatedSequenceNumbers);
    } else {
      console.log("No sequence numbers were updated");
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
  
  return (
    <div className="router-simulator">
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
              onDragEnd={handleRouterDrop}
            >
              Drag to add Router
            </div>
            <button 
              onClick={toggleConnectMode}
              className={connectMode ? 'active' : ''}
              disabled={simulationStatus === 'running' || selectionMode}
            >
              {connectMode ? 'Cancel Connect' : 'Connect Routers'}
            </button>
            <button 
              onClick={toggleSelectionMode}
              className={selectionMode ? 'active' : ''}
              disabled={simulationStatus === 'running'}
            >
              {selectionMode ? 'Exit Selection Mode' : 'Selection Mode'}
            </button>
            {selectionMode && (
              <button 
                onClick={deleteSelectedElements}
                className="delete-button"
                disabled={simulationStatus === 'running' || 
                         (selectedElements.routers.length === 0 && selectedElements.links.length === 0)}
              >
                Delete Selected
              </button>
            )}
            <button 
              onClick={handleSendCustomPacket}
              className="custom-button"
              disabled={simulationStatus !== 'running' && simulationStatus !== 'paused'}
            >
              Send Custom Packet
            </button>
          </div>
        </div>
        
        {/* Main simulator container with the stage and 3D scene */}
        <div className="simulator-container">
          <div 
            className={`simulator-stage ${selectionMode ? 'selection-mode-active' : ''}`}
            ref={stageRef}
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
              disabled={simulationStatus === 'running'}
              connectMode={connectMode}
              selectionMode={selectionMode}
              simulationStatus={simulationStatus}
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
          
          {/* Right panel with controls */}
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
              onEditTopology={handleEditTopology}
              simulationStatus={simulationStatus}
              speed={animationSpeed}
              disabled={routers.length < 2 || links.length === 0}
              currentStep={currentStep}
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
            onClose={() => {
              setShowLinkCostModal(false);
              setSelectedRouters([]);
              setConnectMode(false);
            }}
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