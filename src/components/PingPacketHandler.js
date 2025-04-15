// PingPacketHandler.js - Handles ping packet functionality for the router simulator
import { gsap } from 'gsap';

// Find a path through the network using the routing table
export const findPathFromRoutingTable = (sourceId, targetId, routingTables) => {
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
    
    // If next hop is a dash or self, it means we can't reach the destination
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
    if (path.length > 50) { // Arbitrary limit to prevent infinite loops
      console.log('Path finding looks like it has a loop');
      return null;
    }
  }

  return path;
};

// Animate a packet along a multi-hop path
export const animatePacketAlongPath = (
  path, 
  packetType, 
  packetContent, 
  routers, 
  links, 
  animationSpeed, 
  setAnimationInProgress, 
  setSimulationLogs, 
  animatePacket
) => {
  if (!path || path.length < 2) {
    console.log('Invalid path for animation');
    return;
  }

  // Mark animation as in progress
  setAnimationInProgress(true);

  // Highlight all links along the path
  const highlightLinks = () => {
    for (let i = 0; i < path.length - 1; i++) {
      const sourceId = path[i];
      const targetId = path[i + 1];

      // Find the link between these routers
      const linkBetween = links.find(link => 
        (link.source === sourceId && link.target === targetId) || 
        (link.source === targetId && link.target === sourceId)
      );

      if (linkBetween) {
        // Highlight this link in the UI
        const linkElement = document.getElementById(`link-${linkBetween.id}`);
        if (linkElement) {
          gsap.to(linkElement, {
            stroke: '#ffcc00',
            strokeWidth: 5,
            duration: 0.3
          });
        }
      }
    }
  };

  // Reset link highlights
  const resetLinkHighlights = () => {
    for (let i = 0; i < path.length - 1; i++) {
      const sourceId = path[i];
      const targetId = path[i + 1];

      // Find the link between these routers
      const linkBetween = links.find(link => 
        (link.source === sourceId && link.target === targetId) || 
        (link.source === targetId && link.target === sourceId)
      );

      if (linkBetween) {
        // Reset highlight
        const linkElement = document.getElementById(`link-${linkBetween.id}`);
        if (linkElement) {
          gsap.to(linkElement, {
            stroke: '#999',
            strokeWidth: 2,
            duration: 0.3
          });
        }
      }
    }
  };

  // Highlight all links in the path
  highlightLinks();

  // Set up the sequence of animations
  const animateHop = (hopIndex) => {
    if (hopIndex >= path.length - 1) {
      // End of path, animation complete
      setTimeout(() => {
        resetLinkHighlights();
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
      resetLinkHighlights();
      setAnimationInProgress(false);
      return;
    }

    // Animate packet for this hop
    animatePacket(
      sourceId,
      targetId,
      packetContent,
      packetType,
      1000 / animationSpeed,
      () => animateHop(hopIndex + 1) // Move to next hop when this animation completes
    );
  };

  // Start the animation from the first hop
  animateHop(0);
};

// Handle ping packet creation and animation
export const handlePingPacket = (
  packetData, 
  routers, 
  routingTables, 
  links, 
  animationSpeed,
  setAnimationInProgress,
  setSimulationLogs,
  animatePacket
) => {
  // Check if source router has a routing table
  if (!routingTables[packetData.source]) {
    return {
      success: false,
      message: `Router ${packetData.source} doesn't have a routing table yet. Please ensure the simulation has been started and routes have been established.`
    };
  }
  
  // Find the path using the routing table
  const path = findPathFromRoutingTable(packetData.source, packetData.target, routingTables);
  
  if (!path) {
    // If no path found, return error
    setSimulationLogs(prev => [
      ...prev,
      {
        message: `PING from Router ${packetData.source} to Router ${packetData.target} failed: destination unreachable`,
        type: 'error',
        timestamp: Date.now()
      }
    ]);
    return {
      success: false,
      message: `Router ${packetData.target} is unreachable from ${packetData.source} according to ${packetData.source}'s routing table.`
    };
  }
  
  console.log(`Found path from ${packetData.source} to ${packetData.target}:`, path);
  
  // Create packet content
  const pingContent = `PING ${packetData.source}→${packetData.target}`;
  
  // Animate the packet along the entire path
  animatePacketAlongPath(
    path,
    'ping',
    pingContent,
    routers,
    links, 
    animationSpeed,
    setAnimationInProgress,
    setSimulationLogs,
    animatePacket
  );
  
  return { success: true };
};
