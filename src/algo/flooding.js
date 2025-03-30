// Build the graph and send Hello packets to neighbors.
export function sendHelloPackets(edges, startNode) {
    // Build adjacency list.
    const graph = {};
    edges.forEach(([u, v]) => {
      if (!graph[u]) graph[u] = [];
      if (!graph[v]) graph[v] = [];
      graph[u].push(v);
      graph[v].push(u);
    });
  
    const visited = new Set();
    const queue = [startNode];
  
    console.log("--- Sending Hello Packets ---");
    while (queue.length > 0) {
      const node = queue.shift();
      if (!visited.has(node)) {
        visited.add(node);
        graph[node].forEach(neighbor => {
          console.log(`Sending Hello packet from ${node} to ${neighbor}`);
          if (!visited.has(neighbor)) {
            queue.push(neighbor);
          }
        });
      }
    }
    return graph;
  }
  
  // Step 1: Each node sends its own LSP (i.e. its neighbor list) to all neighbors.
  // The ordering is arranged as follows:
  //   - For the start node, use natural neighbor order.
  //   - For other nodes, rotate their neighbor list (first element moves to the end).
  //   - Then, transmissions are ordered: first from the start node, then transmissions
  //     from other nodes where the destination is not the start node (sorted by sender ascending),
  //     and finally transmissions destined to the start node (sorted by sender descending).
  function step1Transmissions(graph, startNode, lsp) {
    const transmissions = []; // Array of objects: {sender, receiver, packet}
    const orderNeighbors = {};
  
    // Determine ordered neighbor list for each node.
    for (const node in graph) {
      const nbrs = graph[node];
      if (node === startNode) {
        orderNeighbors[node] = [...nbrs]; // keep natural order.
      } else {
        if (nbrs.length > 1) {
          // Rotate left: move first element to the end.
          orderNeighbors[node] = nbrs.slice(1).concat(nbrs[0]);
        } else {
          orderNeighbors[node] = [...nbrs];
        }
      }
    }
  
    // Build transmissions: each node sends its own LSP to every neighbor (in the rotated order).
    for (const node in graph) {
      orderNeighbors[node].forEach(neighbor => {
        transmissions.push({ sender: node, receiver: neighbor, packet: lsp[node] });
      });
    }
  
    // Partition transmissions:
    const startTx = transmissions.filter(tx => tx.sender === startNode);
    const nonStartTx = transmissions.filter(tx => tx.sender !== startNode && tx.receiver !== startNode);
    const destStartTx = transmissions.filter(tx => tx.sender !== startNode && tx.receiver === startNode);
  
    nonStartTx.sort((a, b) => a.sender.localeCompare(b.sender));
    destStartTx.sort((a, b) => b.sender.localeCompare(a.sender));
  
    const ordered = [...startTx, ...nonStartTx, ...destStartTx];
  
    console.log("\n--- Flooding Link State Packets (LSPs) ---");
    console.log("Step 1:");
    ordered.forEach(({ sender, receiver, packet }) => {
      console.log(`Sending ${packet} from ${sender} to ${receiver}`);
    });
  
    // Build pending transmissions for subsequent rounds.
    const pending = {};
    for (const node in graph) {
      pending[node] = [];
    }
    ordered.forEach(({ sender, receiver, packet }) => {
      pending[receiver].push({ sender, packet });
    });
    return pending;
  }
  
  // Flood LSPs in synchronous rounds.
  // In each round, each node processes all pending LSPs.
  // If an LSP is new (not already received), the node updates its table (printed inline)
  // and then forwards that LSP to all neighbors (except the sender).
  // Duplicate LSPs are discarded.
  export function floodLSP(graph, startNode) {
    // Prepare LSP for each node as a string representation of its neighbor list.
    const lsp = {};
    for (const node in graph) {
      lsp[node] = `LSP${node}: ${JSON.stringify(graph[node])}`;
    }
    // Each node initially knows its own LSP.
    const received = {};
    for (const node in graph) {
      received[node] = new Set();
      received[node].add(lsp[node]);
    }
  
    // Step 1: Each node sends its own LSP to all neighbors.
    let pending = step1Transmissions(graph, startNode, lsp);
  
    let step = 2;
    // Continue rounds until no new transmissions.
    while (Object.values(pending).some(arr => arr.length > 0)) {
      const nextPending = {};
      for (const node in graph) {
        nextPending[node] = [];
      }
      console.log(`\nStep ${step}:`);
      // For each node, process all pending messages.
      for (const node in graph) {
        const newMsgs = pending[node];
        newMsgs.forEach(({ sender, packet }) => {
          // If the node has already processed this LSP, discard it.
          if (received[node].has(packet)) return;
          // Otherwise, process it (update table) and mark it as received.
          received[node].add(packet);
          // Forward to all neighbors except the sender.
          graph[node].forEach(nbr => {
            if (nbr === sender) return;
            console.log(`Node ${node} updates table with ${packet}; Sending ${packet} from ${node} to ${nbr}`);
            nextPending[nbr].push({ sender: node, packet });
          });
        });
      }
      pending = nextPending;
      step++;
    }
  }
  
  // Test function that can be called to demonstrate the algorithm
  export function runTest() {
    // Example Input
    const edges = [
      ["A", "B"],
      ["A", "C"],
      ["B", "D"],
      ["C", "D"],
      ["C", "E"],
      ["D", "E"]
    ];
    const startNode = "A";
    
    // Run simulation.
    const graph = sendHelloPackets(edges, startNode);
    floodLSP(graph, startNode);
  }
  