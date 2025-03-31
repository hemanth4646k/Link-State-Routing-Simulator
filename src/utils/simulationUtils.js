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
  // Extract all animation instructions from flooding algorithm
  const { instructions, logs } = extractAnimationInstructions(edges, startNode);
  
  // Prepare logs for display with step markers
  const formattedLogs = prepareFormattedLogs(logs);
  
  // We'll track which logs we've already displayed
  const displayedLogs = [];
  
  // Initially, only send the header to the component
  if (onLogUpdate && formattedLogs.length > 0) {
    // Start with just the simulation header
    displayedLogs.push("=== LINK STATE ROUTING SIMULATION STARTING ===");
    onLogUpdate(displayedLogs);
  }
  
  // Set up variables for animation timing
  const stepInterval = 3000 / speed; // Time between major steps
  const packetAnimationDuration = 1500 / speed; // Duration for packet animations
  
  // For very slow speeds, cap the maximum animation duration
  const cappedAnimationDuration = Math.min(packetAnimationDuration, 8000); // Cap at 8 seconds
  
  // Group instructions by step
  const stepGroups = instructions.reduce((acc, inst) => {
    if (!acc[inst.step]) acc[inst.step] = [];
    acc[inst.step].push(inst);
    return acc;
  }, {});
  
  // Fixed timing parameters (in milliseconds)
  const fixedPacketTravelTime = 1200 / speed; // Travel time for packets
  const fixedPacketInterval = 250 / speed; // Interval between packets from the same source-target

  // List of active log indices for highlighting
  let activeLogIndices = [];
  
  // Function to add a specific log to the displayed logs
  const addLogToDisplay = (logIndex) => {
    if (logIndex >= 0 && logIndex < formattedLogs.length && !displayedLogs.includes(formattedLogs[logIndex])) {
      displayedLogs.push(formattedLogs[logIndex]);
      if (onLogUpdate) {
        onLogUpdate([...displayedLogs]);
      }
    }
  };

  // Add step header to displayed logs
  const addStepHeaderToDisplay = (stepNumber) => {
    const stepHeader = formattedLogs.find(log => log === `=== STEP ${stepNumber} ===` || 
                                             (stepNumber === 0 && log === "=== BEGIN HELLO PACKETS ==="));
    
    if (stepHeader && !displayedLogs.includes(stepHeader)) {
      displayedLogs.push(stepHeader);
      if (onLogUpdate) {
        onLogUpdate([...displayedLogs]);
      }
    }
  };
  
  // Process steps sequentially using a recursive function to ensure steps don't overlap
  const processStep = (stepIndex) => {
    const stepNumbers = Object.keys(stepGroups).sort((a, b) => parseInt(a) - parseInt(b));
    if (stepIndex >= stepNumbers.length) return; // All steps completed
    
    const currentStepNumber = parseInt(stepNumbers[stepIndex]);
    const stepInstructions = stepGroups[currentStepNumber];
    
    // Add the step header to displayed logs
    addStepHeaderToDisplay(currentStepNumber);
    
    // Within each step, organize packets and updates
    const packetInstructions = [];
    const updateInstructions = [];
    
    // Separate packet and update instructions
    stepInstructions.forEach(inst => {
      if (inst.type === 'packet') {
        packetInstructions.push(inst);
      } else if (inst.type === 'update') {
        if (inst.step !== 1) { // Skip step 1 updates as they're handled by packets
          updateInstructions.push(inst);
        }
      }
    });
    
    // Show step label first
    onStep({
      type: 'step',
      step: currentStepNumber
    });
    
    // Group packets by source-target pair to avoid overlap on the same edge
    const packetsByEdge = {};
    packetInstructions.forEach(instruction => {
      const edgeKey = `${instruction.from}-${instruction.to}`;
      if (!packetsByEdge[edgeKey]) {
        packetsByEdge[edgeKey] = [];
      }
      packetsByEdge[edgeKey].push(instruction);
    });
    
    // Count animation completions to track when all animations for this step are done
    let totalAnimations = packetInstructions.length;
    let completedAnimations = 0;
    
    // Define a function to be called when each animation completes
    const onAnimationComplete = (logIndex) => {
      completedAnimations++;
      
      // If all packet animations are complete, process any updates and then move to the next step
      if (completedAnimations === totalAnimations) {
        if (updateInstructions.length > 0) {
          // Process all update instructions
          updateInstructions.forEach(instruction => {
            // Add the update log to displayed logs first
            if (instruction.logIndex !== undefined) {
              addLogToDisplay(instruction.logIndex);
            }
            
            // Then trigger the update animation
            onStep({
              ...instruction,
              step: currentStepNumber
            });
          });
        }
        
        // Check if this is the last step
        if (stepIndex === stepNumbers.length - 1) {
          // Add completion message to logs
          displayedLogs.push("=== SIMULATION COMPLETED ===");
          if (onLogUpdate) {
            onLogUpdate([...displayedLogs]);
          }
          
          // Signal completion with minimal delay
          setTimeout(() => {
            onStep({ 
              type: 'completed',
              step: currentStepNumber
            });
          }, 500); 
        } else {
          // After a delay, process the next step
          setTimeout(() => {
            processStep(stepIndex + 1);
          }, Math.min(stepInterval, 1000));
        }
      }
    };
    
    // If there are no animations in this step, move to the next step immediately
    if (totalAnimations === 0) {
      onAnimationComplete();
      return;
    }
    
    // Start all packets from different source nodes simultaneously
    // For packets on the same edge (same source-target), stagger them slightly
    Object.keys(packetsByEdge).forEach(edgeKey => {
      const packets = packetsByEdge[edgeKey];
      
      // Schedule each packet on this edge with a slight delay between them
      packets.forEach((instruction, index) => {
        // Add delay for packets on the same edge to prevent overlap
        const delay = index * fixedPacketInterval;
        
        setTimeout(() => {
          // Add the packet log before starting animation
          if (instruction.logIndex !== undefined) {
            addLogToDisplay(instruction.logIndex);
          }
          
          // Create a callback for this specific packet animation
          const onPacketComplete = () => {
            // Signal animation completion to track overall progress
            onAnimationComplete(instruction.logIndex);
          };
          
          // Send packet animation to UI
          onStep({
            ...instruction,
            animationDuration: fixedPacketTravelTime,
            onComplete: onPacketComplete
          });
        }, delay);
      });
    });
  };
  
  // Start the simulation with step 0
  processStep(0);
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