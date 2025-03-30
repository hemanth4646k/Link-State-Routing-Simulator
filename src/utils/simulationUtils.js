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
 * @returns {Array} - List of animation instructions in sequence
 */
const extractAnimationInstructions = (edges, startNode) => {
  const instructions = [];
  const logs = [];
  
  // Override console.log to capture all output
  const originalConsoleLog = console.log;
  console.log = (...args) => {
    logs.push(args.join(' '));
    // originalConsoleLog(...args); // Uncomment to see logs in console
  };
  
  try {
    // Run the flooding algorithm to collect all logs
    const edgesForAlgo = edges.map(([u, v, cost]) => [u, v]); // Remove cost for the algorithm
    const graph = sendHelloPackets(edgesForAlgo, startNode);
    floodLSP(graph, startNode);
    
    // Process each log line into animation instructions
    let currentStep = 0; // 0 for hello packets, 1+ for LSP steps
    
    logs.forEach(line => {
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
            data: null
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
            data: [nodeId, adjList]
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
            data: [nodeId, adjList]
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
              data: [nodeId, adjList]
            });
          }
        }
      }
    });
  } finally {
    // Restore original console.log
    console.log = originalConsoleLog;
  }
  
  return instructions;
};

/**
 * Run flooding simulation with the provided edges
 * @param {Array} edges - Array of [source, target, cost] arrays
 * @param {string} startNode - ID of the starting node
 * @param {number} speed - Animation speed multiplier
 * @param {Function} onStep - Callback for animation steps
 */
export const runSimulation = (edges, startNode, speed, onStep) => {
  // Extract all animation instructions from flooding algorithm
  const instructions = extractAnimationInstructions(edges, startNode);
  
  // Set up variables for animation timing - reduced for faster transitions
  const stepInterval = 3000 / speed; // Reduced from 5000 to 3000ms between major steps
  const packetAnimationDuration = 1500 / speed; // Reduced from 2000 to 1500ms for packet animations
  
  // For very slow speeds, cap the maximum animation duration
  const cappedAnimationDuration = Math.min(packetAnimationDuration, 8000); // Cap at 8 seconds (reduced from 10s)
  
  // Group instructions by step
  const stepGroups = instructions.reduce((acc, inst) => {
    if (!acc[inst.step]) acc[inst.step] = [];
    acc[inst.step].push(inst);
    return acc;
  }, {});
  
  // Fixed timing parameters (in milliseconds)
  const fixedPacketTravelTime = 1200 / speed; // Reduced from 1500 to 1200ms travel time
  const fixedPacketInterval = 250 / speed; // Reduced from 300 to 250ms interval between packets
  
  // Process steps sequentially using a recursive function to ensure steps don't overlap
  const processStep = (stepIndex) => {
    const stepNumbers = Object.keys(stepGroups).sort((a, b) => parseInt(a) - parseInt(b));
    if (stepIndex >= stepNumbers.length) return; // All steps completed
    
    const currentStepNumber = stepNumbers[stepIndex];
    const stepInstructions = stepGroups[currentStepNumber];
    
    // Within each step, organize packets and updates
    const packetInstructions = [];
    const updateInstructions = [];
    
    // Separate packet and update instructions
    stepInstructions.forEach(inst => {
      if (inst.type === 'packet') {
        packetInstructions.push(inst);
      } else if (inst.type === 'update') {
        // In the flooding algorithm, LSDBs are only updated when packets are received and processed,
        // never with standalone update events. However, we need to keep "explicit" updates
        // that aren't triggered by packets (e.g., when a node discovers its neighbors)
        if (inst.step !== 1) { // Skip step 1 updates as they're handled by packets
          updateInstructions.push(inst);
        }
      }
    });
    
    // Show step label first
    onStep({
      type: 'step',
      step: parseInt(currentStepNumber)
    });
    
    // Group packets by sender to avoid overlapping
    const packetsBySender = {};
    packetInstructions.forEach(instruction => {
      if (!packetsBySender[instruction.from]) {
        packetsBySender[instruction.from] = [];
      }
      packetsBySender[instruction.from].push(instruction);
    });
    
    // Count animation completions to track when all animations for this step are done
    let totalAnimations = 0;
    let completedAnimations = 0;
    
    // Calculate how many animations we're going to have in total
    Object.values(packetsBySender).forEach(instructions => {
      totalAnimations += instructions.length;
    });
    
    // Define a function to be called when each animation completes
    const onAnimationComplete = () => {
      completedAnimations++;
      
      // If all packet animations are complete, process any updates and then move to the next step
      if (completedAnimations === totalAnimations) {
        if (updateInstructions.length > 0) {
          // Process all update instructions
          updateInstructions.forEach(instruction => {
            onStep({
              ...instruction,
              step: parseInt(currentStepNumber)
            });
          });
        }
        
        // Check if this is the last step
        if (stepIndex === stepNumbers.length - 1) {
          // Signal completion with minimal delay (reduced from 1000ms to 500ms)
          setTimeout(() => {
            onStep({ 
              type: 'completed',
              step: parseInt(currentStepNumber)
            });
          }, 500); 
        } else {
          // Move to the next step with reduced delay
          setTimeout(() => {
            processStep(stepIndex + 1);
          }, stepInterval);
        }
      }
    };
    
    // If there are no packet animations, move directly to updates
    if (totalAnimations === 0) {
      if (updateInstructions.length > 0) {
        updateInstructions.forEach(instruction => {
          onStep({
            ...instruction,
            step: parseInt(currentStepNumber)
          });
        });
      }
      
      // Check if this is the last step
      if (stepIndex === stepNumbers.length - 1) {
        // Signal completion with minimal delay
        setTimeout(() => {
          onStep({ 
            type: 'completed',
            step: parseInt(currentStepNumber)
          });
        }, 500); // Reduced from 1000ms to 500ms
      } else {
        // Move to the next step with reduced delay
        setTimeout(() => {
          processStep(stepIndex + 1);
        }, Math.min(1000, stepInterval)); // Use at most 1000ms between empty steps
      }
      return;
    }
    
    // Schedule packets with synchronized timing
    Object.entries(packetsBySender).forEach(([sender, instructions]) => {
      // For each sender, schedule its packets with a fixed interval
      instructions.forEach((instruction, index) => {
        const packetStartTime = index * fixedPacketInterval;
        
        setTimeout(() => {
          onStep({
            ...instruction,
            animationDuration: fixedPacketTravelTime,
            step: parseInt(currentStepNumber),
            onComplete: onAnimationComplete // Pass the callback function for tracking completion
          });
        }, packetStartTime);
      });
    });
  };
  
  // Start processing steps from the first step
  processStep(0);
};

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