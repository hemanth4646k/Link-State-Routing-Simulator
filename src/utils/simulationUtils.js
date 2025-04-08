// Import flooding.js to access its functionality directly
import { sendHelloPackets, floodLSP } from '../algo/flooding';

// Regex patterns to extract packet information from flooding.js output
const PACKET_REGEX = /Sending (LSP[A-Z]): (\[[^\]]+\]) from ([A-Z]) to ([A-Z])/;
const HELLO_REGEX = /Sending Hello packet from ([A-Z]) to ([A-Z])/;
const UPDATE_REGEX = /Node ([A-Z]) updates table with (LSP[A-Z]: \[[^\]]+\]); Sending/;

/**
 * Extract animation instructions from flooding algorithm
 * @param {Array} edges - Array of [source, target, cost] arrays
 * @param {string} startNode - ID of the starting node
 * @returns {Object} - Object containing instructions and captured logs
 */
const extractAnimationInstructions = (edges, startNode) => {
  const instructions = [];
  const logs = [];
  
  // Override console.log to capture all output
  const originalConsoleLog = console.log;
  console.log = (...args) => {
    const logMessage = args.join(' ');
    logs.push(logMessage);
    // originalConsoleLog(...args); // Uncomment to see logs in console
  };
  
  try {
    // Run the flooding algorithm to collect all logs
    const edgesForAlgo = edges.map(([u, v, cost]) => [u, v]); // Remove cost for the algorithm
    const graph = sendHelloPackets(edgesForAlgo, startNode);
    floodLSP(graph, startNode);
    
    // Process each log line into animation instructions
    let currentStep = 0; // 0 for hello packets, 1+ for LSP steps
    
    logs.forEach((line, index) => {
      if (line.includes("--- Sending Hello Packets ---")) {
        currentStep = 0;
      } else if (line.includes("--- Flooding Link State Packets (LSPs) ---")) {
        currentStep = 0; // Reset for upcoming steps
      } else if (line.match(/Step \d+:/)) {
        const stepMatch = line.match(/Step (\d+):/);
        if (stepMatch) {
          currentStep = parseInt(stepMatch[1]);
        }
      } else {
        // Match Hello packets
        const helloMatch = line.match(HELLO_REGEX);
        if (helloMatch && currentStep === 0) {
          const [_, fromNode, toNode] = helloMatch;
          instructions.push({
            step: 0,
            type: 'packet',
            packetType: 'hello',
            packet: `Hello packet from ${fromNode} to ${toNode}`,
            from: fromNode,
            to: toNode,
            data: null,
            logIndex: index
          });
        }
        
        // Match LSP packets from the log output
        // Format: "Sending LSPX: ["Y","Z"] from A to B"
        const lspMatch = line.match(PACKET_REGEX);
        if (lspMatch && !line.includes("updates table")) {
          const [_, packetType, packetData, fromNode, toNode] = lspMatch;
          
          // Extract nodeid from packet (e.g., "LSPA: ["B","C"]" -> "A")
          const nodeIdMatch = packetType.match(/LSP([A-Z])/);
          const nodeId = nodeIdMatch ? nodeIdMatch[1] : null;
          
          // Parse adjacency list
          let adjList = [];
          try {
            adjList = JSON.parse(packetData);
          } catch (e) {
            console.error("Error parsing packet data:", e);
          }
          
          instructions.push({
            step: currentStep,
            type: 'packet',
            packetType: 'lsp',
            packet: `${packetType}: ${packetData}`,
            from: fromNode,
            to: toNode,
            data: [nodeId, adjList],
            logIndex: index
          });
        }
        
        // Match lines where a node updates its table and forwards a packet
        // Format: "Node A updates table with LSPB: ["C","D"]; Sending LSPB: ["C","D"] from A to C"
        const updateMatch = line.match(UPDATE_REGEX);
        if (updateMatch && currentStep >= 2) {
          const [_, routerId, packetInfo] = updateMatch;
          
          // Extract nodeid from packet (e.g., "LSPA: ["B","C"]" -> "A")
          const nodeIdMatch = packetInfo.match(/LSP([A-Z]):/);
          const nodeId = nodeIdMatch ? nodeIdMatch[1] : null;
          
          // Extract adjacency list
          const adjListMatch = packetInfo.match(/: (\[[^\]]+\])/);
          let adjList = [];
          
          if (adjListMatch) {
            try {
              adjList = JSON.parse(adjListMatch[1]);
            } catch (e) {
              console.error("Error parsing adjacency list:", e);
            }
          }
          
          // In Step 2+ of the flooding algorithm, a node updates its table with a new LSP
          // and then forwards it to its neighbors
          instructions.push({
            step: currentStep,
            type: 'update',
            router: routerId,
            data: [nodeId, adjList],
            logIndex: index
          });
          
          // Extract the forwarding part: "Sending LSPB: ["C","D"] from A to C"
          const forwardMatch = line.match(/Sending ([^;]+) from ([A-Z]) to ([A-Z])/);
          if (forwardMatch) {
            const [__, packetInfo, fromNode, toNode] = forwardMatch;
            
            instructions.push({
              step: currentStep,
              type: 'packet',
              packetType: 'lsp',
              packet: packetInfo,
              from: fromNode,
              to: toNode,
              data: [nodeId, adjList],
              logIndex: index
            });
          }
        }
      }
    });
  } finally {
    // Restore original console.log
    console.log = originalConsoleLog;
  }
  
  return { instructions, logs };
};

/**
 * Prepare logs with step markers for display
 * @param {Array} logs - Raw logs from algorithm
 * @returns {Array} - Processed logs with step markers
 */
const prepareFormattedLogs = (logs) => {
  const formattedLogs = [];
  let currentLogStep = 0;
  
  logs.forEach((log, index) => {
    if (log.includes("--- Sending Hello Packets ---")) {
      formattedLogs.push("=== BEGIN HELLO PACKETS ===");
      currentLogStep = 0;
    } else if (log.includes("--- Flooding Link State Packets (LSPs) ---")) {
      formattedLogs.push("=== BEGIN LINK STATE FLOODING ===");
    } else if (log.match(/Step \d+:/)) {
      const stepMatch = log.match(/Step (\d+):/);
      if (stepMatch) {
        currentLogStep = parseInt(stepMatch[1]);
        formattedLogs.push(`=== STEP ${currentLogStep} ===`);
      }
    } else {
      // Add a step indicator to each log line for clarity
      const stepPrefix = currentLogStep === 0 ? "[Hello] " : `[Step ${currentLogStep}] `;
      formattedLogs.push(stepPrefix + log);
    }
  });
  
  return formattedLogs;
};

/**
 * Run flooding simulation with the provided edges
 * @param {Array} edges - Array of [source, target, cost] arrays
 * @param {string} startNode - ID of the starting node
 * @param {number} speed - Animation speed multiplier
 * @param {Function} onStep - Callback for animation steps
 * @param {Function} onLogUpdate - Callback for log updates
 */
export const runSimulation = (edges, startNode, speed, onStep, onLogUpdate) => {
  // Extract animation instructions from flooding algorithm's logs
  const { instructions, logs } = extractAnimationInstructions(edges, startNode);
  
  // Prepare formatted logs for display
  const formattedLogs = prepareFormattedLogs(logs);
  
  // Group instructions by step number for sequential processing
  const stepGroups = {};
  instructions.forEach(inst => {
    const step = inst.step;
    if (!stepGroups[step]) {
      stepGroups[step] = [];
    }
    stepGroups[step].push(inst);
  });
  
  // Track logs displayed to the user (used to ensure order)
  const displayedLogs = [];
  
  // This is a modified version that doesn't process any steps automatically
  // We'll just display the starting simulation message and keep simulation running
  
  // Add simulation header
  displayedLogs.push("=== LINK STATE ROUTING SIMULATION STARTED ===");
  displayedLogs.push("=== Use Custom Packet button to send packets manually ===");
  
  if (onLogUpdate) {
    onLogUpdate([...displayedLogs]);
  }
  
  // Signal simulation is running, but NOT completed
  onStep({ 
    type: 'step',
    step: 0
  });
};

// Export for testing
export const _extractAnimationInstructions = extractAnimationInstructions;

// Mock implementation if the real flooding.js functions are not available
if (typeof sendHelloPackets !== 'function') {
  // Define mock implementations
  const mockSendHelloPackets = (edges, startNode) => {
    console.log("--- Sending Hello Packets ---");
    const graph = {};
    edges.forEach(([u, v]) => {
      if (!graph[u]) graph[u] = [];
      if (!graph[v]) graph[v] = [];
      graph[u].push(v);
      graph[v].push(u);
    });
    
    // Only emit hello packets from start node for simplicity
    graph[startNode].forEach(neighbor => {
      console.log(`Sending Hello packet from ${startNode} to ${neighbor}`);
    });
    
    return graph;
  };
  
  // Export mock functions 
  exports.sendHelloPackets = mockSendHelloPackets;
  exports.floodLSP = () => {};
}