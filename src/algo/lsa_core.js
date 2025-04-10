// --- Link State Routing Simulation ---
// --- Designed for Node.js Environment ---

const process = require("process"); // Ensure process is available

class Router {
  constructor(id) {
    this.id = id;
    this.neighbors = new Set();
    this.linkCosts = new Map(); // Maps neighborId -> cost
    this.lsdb = new Map(); // Link State Database: maps router ID to its LSP
    this.sequence = 0; // Sequence number for LSPs
    this.active = false; // Router activation status
    this.pendingLSPs = []; // Queue for LSPs that need to be forwarded
    this.rejectedLSPs = []; // Queue for rejected LSPs
    this.needsTableUpdate = false; // Flag to indicate routing table needs update
    this.routingTable = new Map(); // Maps destination -> {nextHop, cost}
    this.savedNeighbors = new Set(); // Store neighbors during failure
    this.savedLinkCosts = new Map(); // Store link costs during failure
  }

  // Start the router
  start() {
    this.active = true;
    // Initial discovery is handled via Hello packets during network setup/changes
  }

  // Stop the router
  stop() {
    this.active = false;

    // Clear other state if necessary
    this.neighbors.clear();
    this.lsdb.clear();
    this.pendingLSPs = [];
    this.rejectedLSPs = [];
    this.savedNeighbors.clear();
    this.savedLinkCosts.clear();
  }

  // Send Hello packets to all neighbors
  sendHelloPackets() {
    if (!this.active) return;

    // Only log if there are neighbors to send to
    if (this.neighbors.size > 0) {
      this.neighbors.forEach((neighbor) => {
        // Check if the neighbor router exists and is active before sending
        const neighborRouter = network.routers.get(neighbor);
        if (!neighborRouter || !neighborRouter.active) {
          // Skip sending to inactive/non-existent routers
          return;
        }

        // Get the link cost for this neighbor
        const cost = this.linkCosts.get(neighbor) || 1;

        // Assume network instance is globally available or passed in
        network.deliverMessage({
          type: "HELLO",
          sender: this.id,
          receiver: neighbor,
          cost: cost,
          timestamp: network.currentTime, // Use network's current time
        });
      });
    }
  }

  // Renamed method to match the call in Network.broadcastHelloPackets
  broadcastHelloPackets() {
    // Just call the existing implementation
    this.sendHelloPackets();
  }

  // Generate a Link State Packet
  generateLSP() {
    this.sequence++;

    // Create an array of neighbor objects with costs
    const neighborsWithCosts = Array.from(this.neighbors).map((neighborId) => ({
      id: neighborId,
      cost: this.linkCosts.get(neighborId) || 1,
    }));

    return {
      type: "LSP",
      sender: this.id, // The immediate sender in this hop
      originRouter: this.id, // The router this LSP describes
      sequence: this.sequence,
      neighborsWithCosts: neighborsWithCosts, // List of neighbors with costs
      timestamp: network.currentTime, // Timestamp of generation
    };
  }

  // Add a new neighbor connection (called when HELLO received)
  _addNeighborInternal(neighborId, cost = 1) {
    if (!this.neighbors.has(neighborId)) {
      this.neighbors.add(neighborId);
      this.linkCosts.set(neighborId, cost);
      return true; // Indicates a change happened
    } else if (this.linkCosts.get(neighborId) !== cost) {
      // Cost has changed
      this.linkCosts.set(neighborId, cost);
      return true; // Cost change also requires LSP update
    }
    return false; // No change
  }

  // Remove a neighbor connection (due to timeout or explicit disconnect)
  removeNeighbor(neighborId) {
    if (!this.active) return; // Don't process if router is inactive

    if (this.neighbors.has(neighborId)) {
      this.neighbors.delete(neighborId);
      this.linkCosts.delete(neighborId);

      // Generate and flood new LSP due to topology change
      // Check if active before flooding
      if (this.active) {
        this.floodLSP(); // Flood immediately upon detecting change
      }
    }
  }

  // Process a received message
  receiveMessage(message) {
    if (!this.active) {
      return;
    }

    switch (message.type) {
      case "HELLO":
        this.handleHello(message);
        break;
      case "LSP":
        this.handleLSP(message);
        break;
      default:
        console.log(
          `Router ${this.id} received unknown message type: ${message.type} from ${message.sender}`
        );
    }
  }

  // Handle a received Hello packet
  handleHello(message) {
    if (!this.active) return;
    console.log(
      `Router ${this.id} received Hello from Router ${message.sender}`
    );

    // If this is a new neighbor, add it and trigger state changes
    const added = this._addNeighborInternal(message.sender, message.cost);
    if (added) {
      // Mark that routing table needs update eventually
      this.needsTableUpdate = true;

      // Queue this router for LSP flooding in the next phase
      // This ensures we flood *after* establishing the link via Hello
      network.queueForFloodingLSP(this.id);

      // --- ADDED: Send existing LSDB directly to the new neighbor ---
      this.sendDbdToNeighbor(message.sender);
      // --- END ADDED SECTION ---
    }
  }

  // Handle a received LSP (REVISED VERSION - THIS IS THE CORRECT ONE)
  handleLSP(message) {
    if (!this.active) return;

    const originRouter = message.originRouter;
    const sequence = message.sequence;
    const existingLSP = this.lsdb.get(originRouter);

    // Ignore our own LSPs reflected back (shouldn't happen with correct flooding logic)
    if (originRouter === this.id) {
      return;
    }

    // Check if this is a new or more recent LSP
    if (!existingLSP || sequence > existingLSP.sequence) {
      console.log(
        `Router ${this.id} received NEW/UPDATED LSP-${originRouter}-${sequence} from ${message.sender}`
      );

      // Store the LSP in the LSDB
      this.lsdb.set(originRouter, {
        sequence: sequence,
        neighborsWithCosts: message.neighborsWithCosts, // Store neighbors with costs
        timestamp: message.timestamp, // Store the LSP generation time
      });

      // Add to pending LSPs to forward (will be forwarded during the next processing phase)
      // Don't forward back to the sender
      this.pendingLSPs.push({ 
        ...message, 
        sender: this.id,  // Update sender for next hop
        receivedFrom: message.sender  // Store who we received it from
      });

      // Mark that routing table needs update, but don't update immediately
      this.needsTableUpdate = true;
    } else if (sequence === existingLSP.sequence) {
      // Add to rejected LSPs only if it's the exact same sequence
      this.rejectedLSPs.push(message);
    } else {
      console.log(
        `Router ${this.id} discarded OLD LSP-${originRouter}-${sequence} (have ${existingLSP.sequence}) from ${message.sender}`
      );
    }
  }

  // Process rejected packets - called during ordered processing phase
  processRejectedLSPs() {
    if (!this.active) return;
    if (this.rejectedLSPs.length > 0) {
      this.rejectedLSPs = [];
    }
  }

  // Update routing table if needed - called during ordered processing phase
  processRoutingTableUpdate() {
    if (!this.active) return;
    if (this.needsTableUpdate) {
      this.updateTopology(); // Computes view, resets flag
      this.needsTableUpdate = false; // Reset the flag
    }
  }

  // Forward pending LSPs - called during ordered processing phase
  processPendingLSPs() {
    if (!this.active) return;
    if (this.pendingLSPs.length === 0) return;

    // Use a Set to avoid processing duplicates if somehow added multiple times
    const uniqueLSPs = new Map();
    this.pendingLSPs.forEach((lsp) => {
      const key = `${lsp.originRouter}-${lsp.sequence}`;
      // Keep only the first instance encountered in this batch
      if (!uniqueLSPs.has(key)) {
        uniqueLSPs.set(key, lsp);
      }
    });

    this.pendingLSPs = []; // Clear the original queue

    if (uniqueLSPs.size > 0) {
      console.log(
        `Router ${this.id} processing ${uniqueLSPs.size} pending LSP(s) for forwarding.`
      );
    }

    // Forward each unique LSP to appropriate neighbors
    uniqueLSPs.forEach((lsp) => {
      this.neighbors.forEach((neighbor) => {
        // *** CRITICAL: Do NOT forward the LSP back to the router that sent it to us ***
        if (neighbor !== lsp.receivedFrom) {
          const forwardedLSP = { ...lsp, sender: this.id, receiver: neighbor }; // Set new sender/receiver for this hop
          // Clean up the temporary field if desired
          delete forwardedLSP.receivedFrom;

          // --- Prediction Logic ---
          let rejectionStatus = "";
          const neighborRouter = network.routers.get(neighbor);
          if (neighborRouter && neighborRouter.active) {
            const neighborLSPInfo = neighborRouter.lsdb.get(lsp.originRouter);
            if (neighborLSPInfo && neighborLSPInfo.sequence >= lsp.sequence) {
              rejectionStatus = " [EXPECTED REJECT]"; // Append if neighbor has same or newer LSP
            }
          }
          // --- End Prediction Logic ---

          network.deliverMessage(forwardedLSP);
        }
      });
    });
  }

  // Generate and flood a new LSP to all neighbors
  floodLSP() {
    if (!this.active) return;

    const lsp = this.generateLSP(); // Sequence number is incremented here
    console.log(
      `
[Step: ${network.currentTime}] [sim] Router ${this.id} flooding LSP-${
        this.id
      }-${lsp.sequence} (Neighbors: ${
        lsp.neighborsWithCosts.map((n) => `${n.id} (${n.cost})`).join(",") ||
        "None"
      })`
    );

    // Add to own LSDB first (important!)
    this.lsdb.set(this.id, {
      sequence: lsp.sequence,
      neighborsWithCosts: lsp.neighborsWithCosts, // Use current neighbors
      timestamp: lsp.timestamp,
    });

    // Send to all current neighbors
    if (this.neighbors.size > 0) {
      this.neighbors.forEach((neighbor) => {
        // Create a copy for each message sent
        const msgCopy = { ...lsp, sender: this.id, receiver: neighbor };
        network.deliverMessage(msgCopy);
      });
    }

    // Mark that routing table might need an update (though flooding usually follows an update)
    this.needsTableUpdate = true;
  }

  // --- NEW METHOD: Send full DBD to a specific neighbor ---
  sendDbdToNeighbor(neighborId) {
    if (!this.active) return;

    this.lsdb.forEach((lspData, originRouter) => {
      // Construct the LSP message from LSDB data
      const lspMessage = {
        type: "LSP",
        sender: this.id, // We are the sender in this hop
        receiver: neighborId, // Sending specifically to this neighbor
        originRouter: originRouter, // The original creator of the LSP
        sequence: lspData.sequence,
        neighborsWithCosts: lspData.neighborsWithCosts,
        timestamp: lspData.timestamp,
      };

      // --- Prediction Logic ---
      let rejectionStatus = "";
      const neighborRouter = network.routers.get(neighborId);
      if (neighborRouter && neighborRouter.active) {
        const neighborLSPInfo = neighborRouter.lsdb.get(originRouter);
        if (neighborLSPInfo && neighborLSPInfo.sequence >= lspData.sequence) {
          rejectionStatus = " [EXPECTED REJECT]"; // Append if neighbor has same or newer LSP
        }
      }
      // --- End Prediction Logic ---

      network.deliverMessage(lspMessage);
    });
  }
  // --- END NEW METHOD ---

  // Display the network topology from this router's perspective (LSDB)
  updateTopology() {
    if (!this.active) return;

    // Build a weighted graph representation from the LSDB
    const graph = new Map();
    const links = new Set(); // Store unique links "A-B:cost"

    // Add self to the graph
    if (!graph.has(this.id)) {
      graph.set(this.id, new Map());
      // Add own neighbors with costs
      this.neighbors.forEach((neighbor) => {
        graph.get(this.id).set(neighbor, this.linkCosts.get(neighbor) || 1);
      });
    }

    // Add links from self
    this.neighbors.forEach((neighbor) => {
      const cost = this.linkCosts.get(neighbor) || 1;
      const link = [this.id, neighbor].sort().join("-") + ":" + cost;
      links.add(link);

      // Ensure neighbor node exists in graph
      if (!graph.has(neighbor)) {
        graph.set(neighbor, new Map());
      }
      graph.get(neighbor).set(this.id, cost); // Add back link with same cost
    });

    // Process LSDB entries
    this.lsdb.forEach((lspData, routerId) => {
      // Ensure the originating router node exists in our graph view
      if (!graph.has(routerId)) {
        graph.set(routerId, new Map());
      }

      // Add neighbors with costs reported by this router in its LSP
      lspData.neighborsWithCosts.forEach((neighbor) => {
        // Ensure the neighbor node exists
        if (!graph.has(neighbor.id)) {
          graph.set(neighbor.id, new Map());
        }

        // Add bidirectional edge with cost
        graph.get(routerId).set(neighbor.id, neighbor.cost);
        graph.get(neighbor.id).set(routerId, neighbor.cost); // Assume bidirectional links with same cost

        // Add to links set (sorted to avoid duplicates like A-B vs B-A)
        const [r1, r2] = [routerId, neighbor.id].sort();
        const link = `${r1}-${r2}:${neighbor.cost}`;
        links.add(link);
      });
    });

    // --- Run Dijkstra's algorithm to compute shortest paths ---
    this.computeRoutingTable(graph);
  }

  // Implement Dijkstra's Algorithm for shortest path computation
  computeRoutingTable(graph) {
    if (!graph.has(this.id)) return; // Can't compute if we're not in the graph

    const distances = new Map(); // Maps node -> distance from source
    const previous = new Map(); // Maps node -> previous node in optimal path
    const unvisited = new Set(); // Set of unvisited nodes

    // Initialize
    graph.forEach((_, node) => {
      distances.set(node, node === this.id ? 0 : Infinity);
      previous.set(node, null); // Initialize previous for all nodes
      unvisited.add(node);
    });

    // Main Dijkstra loop
    while (unvisited.size > 0) {
      // Find the unvisited node with minimum distance
      let current = null;
      let minDistance = Infinity;

      for (const node of unvisited) {
         const dist = distances.get(node);
         if (dist < minDistance) {
            minDistance = dist;
            current = node;
         }
      }

      // If no reachable nodes remain, break
      if (current === null || minDistance === Infinity) break;

      // Remove from unvisited
      unvisited.delete(current);

      // Consider all neighbors of current node from the graph
      const neighbors = graph.get(current);
      if (!neighbors) continue; // Should not happen if graph is well-formed

      neighbors.forEach((cost, neighbor) => {
        // Only consider if neighbor is still unvisited
        if (unvisited.has(neighbor)) {
          const altDistance = distances.get(current) + cost;

          // If we found a better path, update distance and previous node
          if (altDistance < distances.get(neighbor)) {
            distances.set(neighbor, altDistance);
            previous.set(neighbor, current);
          }
        }
      });
    }

    // Build routing table from results
    this.routingTable.clear();

    // For each destination
    graph.forEach((_, dest) => {
      if (dest === this.id) return; // Skip ourselves

      const path = [];
      let curr = dest;
      let pathExists = false;

      // Reconstruct path from destination to source using the 'previous' map
      // Check if a path exists (i.e., distance is not Infinity)
      if(distances.get(dest) !== Infinity) {
          while (curr !== null) {
             path.unshift(curr); // Add to beginning of path
             if (curr === this.id) {
                 pathExists = true;
                 break; // Reached source
             }
             curr = previous.get(curr);
             // Safety break for potential loops if graph/previous logic had issues
             if (path.length > graph.size) {
                 pathExists = false;
                 break;
             }
          }
      }

      // If path exists and has at least one hop (source is not added to its own table)
      // The reconstructed path includes the source, so path.length > 1 means reachable
      if (pathExists && path.length > 1) {
          // The first node AFTER the source in the reconstructed path is the next hop
          const nextHop = path[1];
          this.routingTable.set(dest, {
             nextHop: nextHop,
             cost: distances.get(dest),
          });
      }
    });

    // Print the routing table
    this.printRoutingTable();
  }

  // Print the routing table
  printRoutingTable() {
    console.log(`\n--- Routing Table for Router ${this.id} ---`);
    console.log("Destination | Next Hop | Cost");
    console.log("------------|----------|------");

    // Sort destinations alphabetically for consistent output
    const sortedDests = Array.from(this.routingTable.keys()).sort();

    if (sortedDests.length === 0) {
      console.log("No reachable destinations.");
    } else {
      sortedDests.forEach((dest) => {
        const { nextHop, cost } = this.routingTable.get(dest);
        console.log(`${dest.padEnd(11)}| ${nextHop.padEnd(9)}| ${cost}`);
      });
    }

    console.log("------------------------------\n");
  }

  // New method: Simulate router failure without removing links
  fail() {
    if (!this.active) {
      console.log(`Router ${this.id} is already down.`);
      return false;
    }

    console.log(`Router ${this.id} failing (going down but preserving links)`);

    // Save current neighbors and link costs before failing
    this.savedNeighbors = new Set(this.neighbors);
    this.savedLinkCosts = new Map(this.linkCosts);

    // Set router to inactive state
    this.active = false;

    // Notify neighbors of failure by removing neighbor relationship
    // on their side (but without the normal LSP flooding from this router)
    this.savedNeighbors.forEach((neighborId) => {
      const neighbor = network.routers.get(neighborId);
      if (neighbor && neighbor.active) {
        console.log(`  Informing router ${neighborId} of ${this.id}'s failure`);
        // This neighbor will handle the failure, remove the link, and flood *its* LSP
        neighbor.handleNeighborFailure(this.id);
      }
    });

    return true;
  }

  // New method: Handle notification that a neighbor has failed
  handleNeighborFailure(neighborId) {
    if (!this.active) return;

    console.log(
      `Router ${this.id} received notification that Router ${neighborId} has failed`
    );

    if (this.neighbors.has(neighborId)) {
      // Remove neighbor
      this.neighbors.delete(neighborId);
      this.linkCosts.delete(neighborId); // Also remove cost

      // Generate and flood new LSP due to topology change
      if (this.active) {
        this.floodLSP();
      }
    }
  }

  // New method: Recover router after failure without recreating it
  recover() {
    if (this.active) {
      console.log(`Router ${this.id} is already up.`);
      return false;
    }

    console.log(`Router ${this.id} recovering (coming back online)`);

    // Restore router to active state
    this.active = true;

    // Restore saved neighbors and link costs, but neighbors will need to rediscover us
    this.neighbors = new Set();
    this.linkCosts = new Map();

    // Send Hello packets to all *previously known* neighbors to re-establish connections
    console.log(
      `Router ${this.id} sending recovery Hello packets to ${this.savedNeighbors.size} previous neighbors`
    );
    this.savedNeighbors.forEach((neighborId) => {
      const cost = this.savedLinkCosts.get(neighborId) || 1;
      // Check if the neighbor still exists in the network
      const neighborRouter = network.routers.get(neighborId);
      if (neighborRouter) { // Only send if the neighbor router object still exists
          console.log(
             `  Recovery Hello packet ${this.id} -> ${neighborId} (cost: ${cost})`
          );

          network.deliverMessage({
             type: "HELLO",
             sender: this.id,
             receiver: neighborId,
             cost: cost,
             timestamp: network.currentTime,
          });
      } else {
          console.log(`  Skipping recovery Hello to non-existent previous neighbor ${neighborId}`);
      }
    });

    // Reset saved state after recovery is initiated
    this.savedNeighbors.clear();
    this.savedLinkCosts.clear();

    // Generate and flood an LSP immediately upon recovery with empty neighbor list initially
    // Neighbors will be added back as HELLOs are exchanged in subsequent steps.
    this.floodLSP();

    return true;
  }
} // --- End of Router Class ---

// Network simulator to handle message delivery and time management
class Network {
  constructor() {
    this.routers = new Map(); // Store router objects
    this.links = []; // Store link pairs [id1, id2, cost] for topology printing
    this.linkDelays = new Map(); // Store link delays: key "A-B" -> delay
    this.currentTime = 0; // Represents simulation steps
    this.messageQueue = []; // Messages scheduled for future delivery steps
    this.running = false;
    this.paused = false; // Used for menu interaction
    this.scheduledEvents = []; // Custom scheduled events { time, callback }
    this.routersToFloodLSP = new Set(); // Routers needing to flood LSP after state change
    this.pendingTopologyChanges = []; // Actions queued while menu is active
    this.pendingRouterCreations = new Set(); // Track IDs queued for creation
    this.keyListener = null; // Reference to the keyboard listener
  }

  // Queue a router ID for LSP flooding at the end of the current time step
  queueForFloodingLSP(routerId) {
    if (this.routers.has(routerId) && this.routers.get(routerId).active) {
      this.routersToFloodLSP.add(routerId);
    }
  }

  // Process the queued LSP floods
  processQueuedLSPFloods() {
    if (this.routersToFloodLSP.size > 0) {
      console.log(
        `
--- Processing ${this.routersToFloodLSP.size} queued LSP floods at end of Step ${this.currentTime} ---`
      );

      // Flood LSPs in alphabetical order for consistency
      const sortedIds = Array.from(this.routersToFloodLSP).sort();
      sortedIds.forEach((routerId) => {
        const router = this.routers.get(routerId);
        // Double check router exists and is active before flooding
        if (router && router.active) {
          router.floodLSP(); // Let the router handle its own flooding
        } else {
          console.log(
            `Skipping queued flood for inactive/removed Router ${routerId}`
          );
        }
      });

      // Clear the queue for the next time step
      this.routersToFloodLSP.clear();
    }
  }

  // Create a new router and add it to the network
  createRouter(id) {
    if (id && !this.routers.has(id)) {
      const router = new Router(id);
      this.routers.set(id, router);
      console.log(`Created Router ${id} at step ${this.currentTime}`);
      router.start(); // Start the router immediately upon creation
      this.pendingRouterCreations.add(id); // Track the ID
      // Do NOT flood LSP here, happens on first HELLO exchange or recovery
      return router;
    } else if (this.routers.has(id)) {
      console.log(`Router ${id} already exists.`);
      return this.routers.get(id);
    } else {
      console.log(`Invalid ID provided for createRouter.`);
      return null;
    }
  }

  // Connect two routers (create a link) with cost and delay
  connectRouters(id1, id2, cost = 1, delay = 1) {
    const router1 = this.routers.get(id1);
    const router2 = this.routers.get(id2);

    if (router1 && router1.active && router2 && router2.active) {
      // Check if link already exists
      const linkExists = this.links.some(
        ([r1, r2]) => (r1 === id1 && r2 === id2) || (r1 === id2 && r2 === id1)
      );
      const delayKey = [id1, id2].sort().join('-');

      if (linkExists || this.linkDelays.has(delayKey)) {
        console.log(`Link between ${id1} and ${id2} already exists.`);
        return;
      }

      // Add bidirectional link representation with cost
      this.links.push([id1, id2, cost]);
      // Store delay (for display purposes only - all messages delivered in 1 step)
      this.linkDelays.set(delayKey, delay);

      console.log(
        `Established link between Router ${id1} and Router ${id2} with cost ${cost} (topology delay ${delay}, actual delivery: 1 step) at step ${this.currentTime}`
      );

      // Send initial Hello packets immediately to start neighbor discovery
      network.deliverMessage({
        type: "HELLO",
        sender: id1,
        receiver: id2,
        cost: cost,
        timestamp: this.currentTime,
      });

      network.deliverMessage({
        type: "HELLO",
        sender: id2,
        receiver: id1,
        cost: cost,
        timestamp: this.currentTime,
      });
      // Routers will add neighbors and queue LSP floods upon receiving these HELLOs
    } else {
      console.log(
        `Error: Cannot connect routers ${id1}-${id2}. One or both routers don't exist or are inactive.`
      );
    }
  }

  // Disconnect two routers
  disconnectRouters(id1, id2) {
    // Find and remove the link representation
    const initialLinkCount = this.links.length;
    this.links = this.links.filter(
      ([r1, r2]) => !((r1 === id1 && r2 === id2) || (r1 === id2 && r2 === id1))
    );
    // Remove delay information
    const delayKey = [id1, id2].sort().join('-');
    const delayRemoved = this.linkDelays.delete(delayKey);

    if (this.links.length < initialLinkCount || delayRemoved) {
      console.log(
        `Removed link between Router ${id1} and Router ${id2} at step ${this.currentTime}`
      );

      const router1 = this.routers.get(id1);
      const router2 = this.routers.get(id2);

      // Tell both routers to remove the neighbor relationship
      // This will trigger their internal logic (including LSP flooding)
      if (router1 && router1.active) {
        router1.removeNeighbor(id2);
      }
      if (router2 && router2.active) {
        router2.removeNeighbor(id1);
      }
      // No need to manually flood here, removeNeighbor handles it
    } else {
      console.log(
        `No existing link found between ${id1} and ${id2} to disconnect.`
      );
    }
  }

  // Setup the initial topology
  setupInitialTopology() {
    console.log(
      `
=== Setting up initial network topology at step ${this.currentTime} ===
`
    );

    // Create routers A through D
    const routerIds = ["A", "B", "C", "D"];
    routerIds.forEach((id) => this.createRouter(id)); // createRouter now also starts them

    // Initial network topology links with costs and delays
    // Format: connectRouters(id1, id2, cost, delay)
    this.connectRouters("A", "B", 5, 2); // Cost 5, Delay 2 steps
    this.connectRouters("A", "C", 2, 1); // Cost 2, Delay 1 step
    this.connectRouters("B", "C", 1, 1); // Cost 1, Delay 1 step
    this.connectRouters("C", "D", 3, 3); // Cost 3, Delay 3 steps

    // Print initial logical topology
    this.printTopology();

    // Routers are started within createRouter
    // Initial Hellos are sent within connectRouters
    // The simulation loop will handle the first Hello processing and LSP floods
  }

  // The logic to execute for each time step (called manually)
  _simulationTick() {
    // --- Start of Time Step ---
    this.currentTime++;
    console.log(
      `

==================== STEP: ${this.currentTime} ====================`
    );

    // 1. Process scheduled events (custom events, predefined changes)
    // NOTE: Synchronized Hellos are removed
    this.processScheduledEvents();

    // 2. PHASE 1: Message Reception
    // Process message queue (deliver messages scheduled for <= currentTime)
    console.log(
      `--- Phase 1: Processing Message Queue (${this.messageQueue.length} items) ---`
    );
    this.processMessageQueue();

    // 3. PHASE 2: Router Internal Processing & Reaction
    console.log("--- Phase 2: Router Processing ---");

    //  a. Process rejected LSPs (optional cleanup/logging)
    this.routers.forEach((router) => {
      if (router.active) router.processRejectedLSPs();
    });

    //  b. Update topology/routing tables if needed (flagged by received LSPs/Hellos)
    this.routers.forEach((router) => {
      if (router.active && router.needsTableUpdate) {
        router.processRoutingTableUpdate(); // Computes view, resets flag
      }
    });

    //  c. Process forwarding of pending LSPs (received in Phase 1)
    this.routers.forEach((router) => {
      if (router.active) router.processPendingLSPs(); // Forwards LSPs added in handleLSP
    });

    //  d. Process any queued LSP floods (triggered by neighbor changes in Phase 1)
    // Important: This allows routers that just discovered neighbors to flood their *own* LSPs
    this.processQueuedLSPFloods();

    console.log(
      `================== End of Step ${this.currentTime} ==================`
    );
    // Prompt is handled after the tick call in the keyboard listener

    // REMOVED: Check simulation end condition (user controls end)
  }

  // REMOVED: promptNextStep method (integrated into listener)

  // REMOVED: _startSimulationInterval method
  // REMOVED: _stopSimulationInterval method

  // Start the network simulation
  start() {
    if (this.running) return;
    this.running = true;
    this.paused = false; // Ensure not paused at start
    this.currentTime = 0; // Reset step counter

    console.log(
      `
=== Initializing network simulation (Manual Step Mode) ===
`
    );

    this.setupInitialTopology(); // Creates routers, links, sends initial Hellos

    // REMOVED: Schedule the first synchronized Hello broadcast check

    this.setupKeyboardListener(); // Listen for keys

    // REMOVED: Start the simulation clock interval

    // Initial state message
    console.log(`
=== Simulation Ready at STEP: ${this.currentTime} ===`);
    this.promptUser(); // Show initial prompt
  }

  // Pause the simulation (enter menu mode)
  pauseSimulation() {
    // Only pause if running
    if (!this.paused && this.running) {
      this.paused = true;
      // REMOVED: Stop the clock interval
      // REMOVED: Pause router timeouts

      console.log(
        `

=== SIMULATION PAUSED AT STEP ${this.currentTime} ===`
      );
      this.displayTopologyMenu(); // Show menu immediately
    } else if (this.paused) {
      console.log("Already paused. Use the menu or 'r' to resume.");
    }
  }

  // Apply pending topology changes queued during menu interaction
  applyPendingChanges() {
    if (this.pendingTopologyChanges.length > 0) {
      console.log(
        `\n=== Applying ${this.pendingTopologyChanges.length} pending topology changes ===`
      );

      // Apply all pending changes
      this.pendingTopologyChanges.forEach((change) => {
         try {
           change();
         } catch (e) {
           console.error("Error applying queued change:", e);
         }
      });
      this.pendingTopologyChanges = []; // Clear the queue
      this.pendingRouterCreations.clear(); // Clear the tracking set

      console.log("=== All pending changes applied ===\n");
    }
  }

  // Resume the simulation from paused (menu) state
  resumeSimulation() {
    if (this.paused && this.running) {
      // Apply pending changes *before* marking as unpaused
      this.applyPendingChanges();

      // REMOVED: Resume router timeouts

      // Mark as unpaused
      this.paused = false;
      console.log(`
=== SIMULATION RUNNING AT STEP ${this.currentTime} ===`);
      this.promptUser(); // Show prompt for next action
      // REMOVED: Restart the interval timer
    }
  }

  // Stop the network simulation
  stop() {
    if (!this.running) return; // Prevent multiple stops

    console.log(`
=== Ending simulation at step ${this.currentTime} ===
`);
    this.running = false;
    this.paused = false; // Ensure not marked as paused

    // Clean up listeners and terminal state
    if (this.keyListener && process.stdin.removeListener) {
      process.stdin.removeListener("data", this.keyListener);
      console.log("Keyboard listener removed.");
    }
    try {
      if (process.stdin.isTTY) {
        // Check if it's a TTY before attempting
        process.stdin.setRawMode(false);
        console.log("Raw mode disabled.");
      }
      process.stdin.pause(); // Stop reading input
      console.log("Stdin paused.");
    } catch (e) {
      console.warn("Could not fully restore terminal settings:", e.message);
    }
    console.log("Simulation stopped completely.");
    // setTimeout(() => process.exit(0), 500); // Keep for forceful exit if needed
  }

  // Consistent prompt message
  promptUser() {
     console.log("\n>>> Press 'n' for next step | 'm' for menu | Ctrl+C to exit <<<");
  }

  // --- Input Handling ---

  setupKeyboardListener() {
    console.log("\n-----------------------------------------------------");
    console.log('CONTROLS: "n" -> Next Step | "m" -> Menu | Ctrl+C -> Exit');
    console.log("-----------------------------------------------------\n");

    if (!process.stdin.setRawMode) {
      console.error(
        "Fatal Error: Cannot set raw mode. Input unavailable. Exiting."
      );
      process.exit(1);
    }

    try {
      process.stdin.setRawMode(true);
    } catch (e) {
      console.error("Fatal Error setting raw mode:", e);
      process.exit(1);
    }
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    // Use a named function for the listener
    this.keyListener = (key) => {
      // Ctrl+C to exit
      if (key === "") { // Check for Ctrl+C character
        this.stop();
        return;
      }

      if (!this.paused) {
        // --- Simulation Running ---
        if (key.toLowerCase() === "n") {
          this._simulationTick(); // Advance one step
          this.promptUser();     // Prompt for next action after step completes
        } else if (key.toLowerCase() === "m") {
          this.pauseSimulation(); // Enter menu mode (pauses)
        }
        // Ignore other keys when running
      } else {
        // --- Simulation Paused (Menu Active) ---
        if (/^[1-6]$/.test(key)) {
          // Check if it's a valid menu digit (1-6)
          this.handleMenuInput(key); // Handles input, may call resumeSimulation
        } else if (key.toLowerCase() === "r") {
          this.resumeSimulation(); // Explicitly resume running state
        } else if (key.toLowerCase() === "m") {
          console.log("Already in menu mode. Choose an option or 'r' to resume.");
          this.displayTopologyMenu(); // Re-display menu
        } else if (key.toLowerCase() === "n") {
          console.log("Simulation is paused. Use the menu or press 'r' to resume running.");
        }
        // Ignore other keys silently when paused menu is active
      }
    };

    // Clear previous listeners just in case
    process.stdin.removeAllListeners("data");
    // Add the new listener
    process.stdin.on("data", this.keyListener);
  }

  // Display topology modification menu when paused
  displayTopologyMenu() {
    console.log("\n=== TOPOLOGY MODIFICATION MENU (Simulation Paused) ===");
    console.log("  1. Create a new router");
    console.log("  2. Add a new link between routers (cost & delay)");
    console.log("  3. Remove a link between routers");
    console.log("  4. View current network links & status");
    console.log("  5. Take a router down (failure)");
    console.log("  6. Bring a router up (recovery)");
    console.log("  r. Resume running simulation"); // Changed from 7
    console.log("------------------------------------");
    process.stdout.write("Enter your choice (1-6 or r): ");
  }

  // Handle menu input when paused
  handleMenuInput(key) {
    console.log(`
Selected option: ${key}`); // Acknowledge input
    switch (key) {
      case "1":
        this.handleCreateRouter(); // Will call resumeSimulation after input
        break;
      case "2":
        this.handleAddLink(); // Will call resumeSimulation after input
        break;
      case "3":
        this.handleRemoveLink(); // Will call resumeSimulation after input
        break;
      case "4":
        this.printTopology();
        // Re-display menu after viewing topology
        this.displayTopologyMenu();
        break;
      case "5":
        this.handleRouterFailure(); // Will call resumeSimulation after input
        break;
      case "6":
        this.handleRouterRecovery(); // Will call resumeSimulation after input
        break;
      case "r": // Explicit resume option
        this.resumeSimulation();
        break;
      default:
        // This case should ideally not be hit due to the listener filter
        console.log("Invalid choice. Please enter 1-6 or r.");
        this.displayTopologyMenu(); // Show menu again
    }
  }

  // Handle creating a new router from menu
  handleCreateRouter() {
    process.stdout.write("Enter new router ID (single uppercase letter): ");
    this.readUserInput((id) => {
      id = id.toUpperCase();
      if (id && /^[A-Z]$/.test(id)) {
        if (this.routers.has(id) || this.pendingRouterCreations.has(id)) {
          console.log(`Router ${id} already exists or is queued for creation.`);
          this.displayTopologyMenu(); // Stay in menu
        } else {
          this.pendingTopologyChanges.push(() => {
            this.createRouter(id);
          });
          this.pendingRouterCreations.add(id);
          console.log(
            `Router ${id} creation queued. It will be created upon resume.`
          );
          this.resumeSimulation(); // Process queue and unpause
        }
      } else {
        console.log("Invalid router ID. Must be a single uppercase letter.");
        this.displayTopologyMenu(); // Stay in menu
      }
    });
  }

  // Handle adding a new link from menu
  handleAddLink() {
    process.stdout.write("Enter first router ID: ");
    this.readUserInput((id1) => {
      process.stdout.write("Enter second router ID: ");
      this.readUserInput((id2) => {
        process.stdout.write("Enter link cost (positive number, default 1): ");
        this.readUserInput((costStr) => {
           process.stdout.write("Enter link delay (positive integer steps, default 1): ");
           this.readUserInput((delayStr) => {
              id1 = id1.toUpperCase();
              id2 = id2.toUpperCase();
              const cost = costStr ? parseInt(costStr, 10) : 1;
              const delay = delayStr ? parseInt(delayStr, 10) : 1;

              if (isNaN(cost) || cost <= 0) {
                 console.log("Invalid cost. Must be a positive number.");
                 this.displayTopologyMenu(); // Stay in menu
                 return;
              }
              if (isNaN(delay) || delay <= 0 || !Number.isInteger(delay)) {
                 console.log("Invalid delay. Must be a positive integer.");
                 this.displayTopologyMenu(); // Stay in menu
                 return;
              }

              if (id1 === id2) {
                 console.log("Cannot link a router to itself.");
                 this.displayTopologyMenu(); // Stay in menu
                 return;
              }

              const r1Exists =
                 this.routers.has(id1) || this.pendingRouterCreations.has(id1);
              const r2Exists =
                 this.routers.has(id2) || this.pendingRouterCreations.has(id2);

              if (!r1Exists || !r2Exists) {
                 console.log(
                    "One or both specified routers do not exist (or aren't queued for creation)."
                 );
                 this.displayTopologyMenu(); // Stay in menu
                 return;
              }

              this.pendingTopologyChanges.push(() => {
                 // Schedule connection for the *next* logical time step AFTER resuming
                 this.scheduleConnectRouters(id1, id2, cost, delay);
              });
              console.log(
                 `Link ${id1}<->${id2} (Cost: ${cost}, Delay: ${delay}) connection scheduled. Will be established in the next step (Step=${this.currentTime + 1}) after resuming.`
              );
              this.resumeSimulation(); // Process queue (scheduling the connection) and unpause
           });
        });
      });
    });
  }

  // Handle removing a link from menu
  handleRemoveLink() {
    process.stdout.write("Enter first router ID of link to remove: ");
    this.readUserInput((id1) => {
      process.stdout.write("Enter second router ID of link to remove: ");
      this.readUserInput((id2) => {
        id1 = id1.toUpperCase();
        id2 = id2.toUpperCase();

        const linkExists = this.links.some(
          ([r1, r2]) => (r1 === id1 && r2 === id2) || (r1 === id2 && r2 === id1)
        );
        const delayKey = [id1, id2].sort().join('-');

        if (!linkExists && !this.linkDelays.has(delayKey)) {
          console.log(
            `No active link found between ${id1} and ${id2} to remove.`
          );
          this.displayTopologyMenu(); // Stay in menu
        } else {
          this.pendingTopologyChanges.push(() => {
            this.disconnectRouters(id1, id2);
          });
          console.log(
            `Link ${id1}<->${id2} removal queued. Routers will be notified upon resume.`
          );
          this.resumeSimulation(); // Process queue and unpause
        }
      });
    });
  }

  // Helper function to read a single line of user input
  readUserInput(callback) {
    // Temporarily disable raw mode and the main key listener
    if (this.keyListener) {
      process.stdin.removeListener("data", this.keyListener);
    }
    try {
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
    } catch (e) {
      console.warn("Couldn't disable raw mode for input.");
    }

    // Read one line
    process.stdin.once("data", (data) => {
      const input = data.toString().trim();

      // Restore raw mode and the main listener
      try {
        if (process.stdin.isTTY) process.stdin.setRawMode(true);
      } catch (e) {
        console.error("Fatal: Failed to re-enable raw mode. Exiting.");
        this.stop();
        process.exit(1); // Exit if terminal state is broken
      }
      if (this.keyListener) {
        // Clear just in case before re-adding
        process.stdin.removeAllListeners("data");
        // Re-attach the listener for 'n', 'm', menu keys, 'r' based on paused state
        process.stdin.on("data", this.keyListener);
      }

      callback(input); // Process the collected input line
    });
  }

  // --- Simulation Event Processing ---

  // Schedule an event to happen at a specific step
  scheduleEvent(step, callback) {
    this.scheduledEvents.push({ time: step, callback });
    // Optional: Sort events by time for efficiency, but linear scan is ok for few events
    this.scheduledEvents.sort((a, b) => a.time - b.time); // Keep sorted
  }

  // Process events scheduled for the current step
  processScheduledEvents() {
    // Check if we need to send Hello packets (every helloInterval steps)
    if (this.currentTime % 15 === 0) {
      console.log(`\n>>> Broadcasting Hello Packets at Step ${this.currentTime} <<<`);
      this.broadcastHelloPackets();
    }

    // --- Custom Scheduled Events & Predefined Topology Changes ---
    const eventsForNow = [];
    const remainingEvents = [];

    // Process events scheduled for now or earlier
    let i = 0;
    while (i < this.scheduledEvents.length && this.scheduledEvents[i].time <= this.currentTime) {
       eventsForNow.push(this.scheduledEvents[i]);
       i++;
    }
    // Remaining events are from index i onwards
    this.scheduledEvents = this.scheduledEvents.slice(i);

    // Execute events scheduled for now
    if (eventsForNow.length > 0) {
      console.log(
        `
>>> Processing ${eventsForNow.length} Custom Scheduled Event(s) at Step ${this.currentTime} <<<`
      );
      eventsForNow.forEach((event) => {
        try {
          event.callback();
        } catch (e) {
          console.error(
            `Error executing scheduled event at step ${event.time}:`,
            e
          );
        }
      });
    }

    // --- Example Hardcoded Topology Changes (Trigger at specific steps) ---
    if (this.currentTime === 60) {
      console.log(
        `
>>> Processing Predefined Event: NETWORK CHANGE at Step ${this.currentTime} <<<`
      );
      console.log("      Adding Router E, G and link E<->G");
      const routerE = this.createRouter("E");
      const routerG = this.createRouter("G");
      if(routerE && routerG) {
         this.connectRouters("E", "G", 4, 2); // Cost 4, Delay 2
      }
      this.printTopology();
    }

    if (this.currentTime === 75) {
      console.log(
        `
>>> Processing Predefined Event: NETWORK CHANGE at Step ${this.currentTime} <<<`
      );
      console.log("      Router B failure");

      const routerB = this.routers.get("B");
      if (routerB && routerB.active) {
        routerB.fail();
        this.printTopology();
      } else {
        console.log("      Router B does not exist or is already down.");
      }
    }

    if (this.currentTime === 90) {
      console.log(
        `
>>> Processing Predefined Event: NETWORK CHANGE at Step ${this.currentTime} <<<`
      );
      console.log("      Link failure between C and D");
      this.disconnectRouters("C", "D");
      this.printTopology();
    }

    if (this.currentTime === 105) {
      console.log(
        `
>>> Processing Predefined Event: NETWORK CHANGE at Step ${this.currentTime} <<<`
      );
      console.log("      Router B recovery");

      const routerB = this.routers.get("B");
      if (routerB && !routerB.active) {
        routerB.recover();
        this.printTopology();
      } else {
        console.log("      Router B does not exist or is already up.");
      }
    }

    if (this.currentTime === 120) {
      console.log(
        `
>>> Processing Predefined Event: NETWORK CHANGE at Step ${this.currentTime} <<<`
      );
      console.log("      Adding new link between B and E");
      // Ensure E exists (it should from step=60)
      if (this.routers.has("E") && this.routers.has("B")) {
        this.connectRouters("B", "E", 2, 1); // Cost 2, Delay 1
      } else {
        console.log("      Router B or E does not exist, cannot add link B<->E");
      }
      this.printTopology();
    }
  }

  // Broadcast Hello packets from all active routers
  broadcastHelloPackets() {
    this.routers.forEach((router) => {
      if (router.active) {
        router.broadcastHelloPackets();
      }
    });
  }

  // Deliver a message (add to queue with calculated delay)
  deliverMessage(message) {
    const sender = message.sender;
    const receiver = message.receiver;

    if (!sender || !receiver) {
        console.error("Error: Message missing sender or receiver:", message);
        return;
    }

    // Log message sending with [sim] prefix
    if (message.type === "HELLO") {
      console.log(`[sim] Router ${sender} sending HELLO packet to Router ${receiver} (will arrive at Step=${this.currentTime + 1})`);
    } else if (message.type === "LSP") {
      if (message.originRouter === sender) {
        console.log(`[sim] Router ${sender} sending own LSP-${message.originRouter}-${message.sequence} to Router ${receiver}`);
      } else {
        console.log(`[sim] Router ${sender} forwarding LSP-${message.originRouter}-${message.sequence} to Router ${receiver}`);
      }
    }

    // Fixed delay of 1 step for all messages, ignoring link-specific delays
    const deliveryTime = this.currentTime + 1;

    this.messageQueue.push({
      message,
      deliveryTime,
    });
    // Keep message queue sorted by delivery time for efficient processing
    this.messageQueue.sort((a, b) => a.deliveryTime - b.deliveryTime);
  }

  // Process messages in the queue that are due for delivery at the current step
  processMessageQueue() {
    const messagesToDeliver = [];

    // Since the queue is sorted, find the index boundary
    let i = 0;
    while (i < this.messageQueue.length && this.messageQueue[i].deliveryTime <= this.currentTime) {
        messagesToDeliver.push(this.messageQueue[i].message);
        i++;
    }

    // Remove delivered messages from the front of the queue
    if (i > 0) {
        this.messageQueue.splice(0, i);
    }

    // Deliver messages
    if (messagesToDeliver.length > 0) {
      console.log(
        ` Delivering ${messagesToDeliver.length} message(s) scheduled for Step <= ${this.currentTime}`
      );
      messagesToDeliver.forEach((message) => {
        const receiver = this.routers.get(message.receiver);
        if (receiver && receiver.active) {
          // Deliver only if receiver exists and is active
          try {
            receiver.receiveMessage(message);
          } catch (e) {
            console.error(
              `Error during message processing at Router ${message.receiver}:`,
              e
            );
          }
        } else if (receiver && !receiver.active) {
          // Handle message delivery to an inactive (failed) router
          // OSPF typically doesn't explicitly notify sender of neighbor failure on message discard,
          // failure is detected via Hellos (or lack thereof). Since we removed timeouts,
          // we just discard the message here. The topology change was already (or should be)
          // handled when the router failed or link was disconnected.
          console.log(
             `  Discarding ${message.type} to FAILED Router ${message.receiver} from ${message.sender}`
          );
        } else {
          console.log(
            `  Discarding ${message.type} to NON-EXISTENT Router ${message.receiver} from ${message.sender}`
          );
        }
      });
    }
  }

  // Print current network topology based on the 'links' array
  printTopology() {
    console.log("\n=== Current Network Links (Cost, Display Delay) ===");
    if (this.links.length === 0) {
      console.log("  No links defined.");
    } else {
      // Sort links for consistent output
      const sortedLinks = this.links
        .map((link) => {
          const [r1, r2, cost] = link;
          const delayKey = [r1, r2].sort().join('-');
          const delay = this.linkDelays.get(delayKey) || '?'; // Get delay
          // Sort router IDs for display consistency within the link string
          const [disp_r1, disp_r2] = [r1, r2].sort();
          return `${disp_r1} <--> ${disp_r2} (Cost: ${cost || 1}, Delay: ${delay} [all messages delivered in 1 step])`;
        })
        .sort(); // Sort the array of strings
      sortedLinks.forEach((linkStr) => {
        console.log(`  ${linkStr}`);
      });
    }

    // Print router status
    this.printRouterStatus();

    console.log("========================================\n");
  }

  // New method to print router status (active/inactive)
  printRouterStatus() {
    const activeRouters = [];
    const inactiveRouters = [];

    // Categorize routers by status
    this.routers.forEach((router, id) => {
      if (router.active) {
        activeRouters.push(id);
      } else {
        inactiveRouters.push(id);
      }
    });

    // Sort for consistent output
    activeRouters.sort();
    inactiveRouters.sort();

    console.log("\n=== Router Status ===");
    if (activeRouters.length > 0) {
      console.log(`  Active: ${activeRouters.join(", ")}`);
    } else {
      console.log("  No active routers");
    }

    if (inactiveRouters.length > 0) {
      console.log(`  Inactive: ${inactiveRouters.join(", ")}`);
    }
    // No need to print "No inactive routers" if empty

  }

  // Schedule connectRouters to be called in the *next* step after resuming
  scheduleConnectRouters(id1, id2, cost = 1, delay = 1) {
    const targetStep = this.currentTime + 1;
    console.log(
      ` Create Link ${id1} ${id2} ${cost} ${targetStep}.`
    );
    this.scheduleEvent(targetStep, () => {
      console.log(
        `
>>> Executing scheduled connection: ${id1}<->${id2} (Cost: ${cost}, Display Delay: ${delay}) at Step=${this.currentTime} <<<`
      );
      this.connectRouters(id1, id2, cost, delay);
    });
  }

  // Handle router failure from menu
  handleRouterFailure() {
    // First, display the current active routers
    const activeRouters = Array.from(this.routers.entries())
      .filter(([_, router]) => router.active)
      .map(([id, _]) => id)
      .sort();

    if (activeRouters.length === 0) {
      console.log("No active routers to fail.");
      this.displayTopologyMenu();
      return;
    }

    console.log("\nCurrently active routers: " + activeRouters.join(", "));
    process.stdout.write("Enter router ID to take down: ");
    this.readUserInput((id) => {
      id = id.toUpperCase();
      if (id && /^[A-Z]$/.test(id)) {
        const router = this.routers.get(id);
        if (router && router.active) {
          this.pendingTopologyChanges.push(() => {
            router.fail();
          });
          console.log(`Router ${id} failure queued. Will be processed on resume.`);
          this.resumeSimulation(); // Process queue and unpause
        } else if (router && !router.active) {
          console.log(`Router ${id} is already down.`);
          this.displayTopologyMenu(); // Stay in menu
        } else {
          console.log(`Router ${id} does not exist.`);
          this.displayTopologyMenu(); // Stay in menu
        }
      } else {
        console.log("Invalid router ID. Must be a single uppercase letter.");
        this.displayTopologyMenu(); // Stay in menu
      }
    });
  }

  // Handle router recovery from menu
  handleRouterRecovery() {
    // First, display the currently down routers
    const inactiveRouters = Array.from(this.routers.entries())
      .filter(([_, router]) => !router.active)
      .map(([id, _]) => id)
      .sort();

    if (inactiveRouters.length === 0) {
      console.log("No inactive routers to recover.");
      this.displayTopologyMenu();
      return;
    }

    console.log("\nCurrently inactive routers: " + inactiveRouters.join(", "));
    process.stdout.write("Enter router ID to bring up: ");
    this.readUserInput((id) => {
      id = id.toUpperCase();
      if (id && /^[A-Z]$/.test(id)) {
        const router = this.routers.get(id);
        if (router && !router.active) {
          this.pendingTopologyChanges.push(() => {
            router.recover();
          });
          console.log(`Router ${id} recovery queued. Will be processed on resume.`);
          this.resumeSimulation(); // Process queue and unpause
        } else if (router && router.active) {
          console.log(`Router ${id} is already up.`);
          this.displayTopologyMenu(); // Stay in menu
        } else {
          console.log(`Router ${id} does not exist.`);
          this.displayTopologyMenu(); // Stay in menu
        }
      } else {
        console.log("Invalid router ID. Must be a single uppercase letter.");
        this.displayTopologyMenu(); // Stay in menu
      }
    });
  }
} // --- End of Network Class ---

// --- Global Instance and Execution ---

// Create the single network instance
const network = new Network();

// Main function to start the simulation
function runNetworkSimulation() {
  console.log("Initializing Link State Routing Simulation (Manual Step Mode)...");
  network.start(); // Start the simulation setup and listener
  // No automatic loop starts here
}

// Handle graceful shutdown on Ctrl+C more explicitly
process.on("SIGINT", () => {
  console.log("\nCtrl+C detected. Shutting down simulation gracefully...");
  network.stop();
  // Allow some time for cleanup messages before truly exiting
  setTimeout(() => process.exit(0), 100); // Exit after 100ms
});

// Run the simulation
runNetworkSimulation();
