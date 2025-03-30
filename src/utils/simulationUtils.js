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
  
  return { instructions, logs };
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
  
  // Send logs back to the component
  if (onLogUpdate) {
    onLogUpdate(logs);
  }
  
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
          // After a delay, process the next step
          // We'll add a maximum wait of 1000ms between steps
          // This ensures that even with very slow speeds, the simulation doesn't stall
          setTimeout(() => {
            processStep(stepIndex + 1);
          }, Math.min(stepInterval, 1000));
        }
      }
    };
    
    // Process packet animations by sender to avoid visual overlap
    if (totalAnimations === 0) {
      // If there are no animations in this step, move to the next step immediately
      onAnimationComplete();
    } else {
      // Process animations for each sender one by one
      let senderIndex = 0;
      const senders = Object.keys(packetsBySender);
      
      const processSender = () => {
        if (senderIndex >= senders.length) return; // All senders processed
        
        const sender = senders[senderIndex];
        const instructions = packetsBySender[sender];
        
        // Process each packet from this sender
        let instructionIndex = 0;
        
        const processPacket = () => {
          if (instructionIndex >= instructions.length) {
            // This sender's packets are all processed, move to next sender
            senderIndex++;
            processSender();
            return;
          }
          
          const instruction = instructions[instructionIndex];
          
          // Create a callback for this specific packet animation
          const onPacketComplete = () => {
            // Signal animation completion to track overall progress
            onAnimationComplete();
          };
          
          // Send packet animation to UI
          onStep({
            ...instruction,
            animationDuration: fixedPacketTravelTime,
            onComplete: onPacketComplete
          });
          
          // Increment instruction index for next packet
          instructionIndex++;
          
          // Schedule next packet after an interval
          setTimeout(processPacket, fixedPacketInterval);
        };
        
        // Start processing this sender's packets
        processPacket();
      };
      
      // Begin processing senders
      processSender();
    }
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