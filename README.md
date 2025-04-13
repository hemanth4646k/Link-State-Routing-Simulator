# Link State Routing Simulator

A visual simulator for link state routing protocols, using drag-and-drop routers and animated packet transmission.

## Author

**Hemanth sai Somaraju**

## Features

- Drag and drop routers onto the simulation stage
- Connect routers with links and specify link costs
- Run animated simulations of the link state routing algorithm
- View Link State Database (LSDB) for each router
- View routing tables calculated from the LSDB using Dijkstra's algorithm
- Control simulation speed with a slider
- Pause, resume, and edit topology during simulations
- Observe network convergence after topology changes

## How to Use

### Getting Started
1. **Add Routers**: Drag routers from the toolbox onto the simulation stage
2. **Connect Routers**: 
   - Click the "Connect Routers" button
   - Click on the first router you want to connect
   - Click on the second router
   - Enter the link cost in the modal that appears

### Running Simulations
1. **Start Simulation**:
   - Click "Start Simulation" to begin the link state routing process
   - The simulation will initialize and wait for you to click "Next Step"
2. **Step Through the Simulation**:
   - Click "Next Step" to advance the simulation one step at a time
   - Each step progresses the Link State Algorithm
   - Watch as LSP packets are transmitted between routers
   - The Link State Database and routing tables update as packets are received
3. **Make Topology Changes**:
   - While simulation is running, click "Pause" to pause the simulation
   - Click "Select" to enter selection mode
   - Click on links or routers you want to delete
   - Click "Delete Selected" to remove them
   - Observe how LSPs with incremented sequence numbers are flooded
   - Watch how routing tables recalculate based on the new topology

### Understanding the Interface
1. **Left Panel**: Simulation controls and instructions
   - Start/Pause/Resume/Reset buttons
   - Speed control slider
   - Simulation steps explanation

2. **Right Panel**: Network state information
   - Router selector dropdown
   - View toggle for LSDB or Routing Table
   - Current LSDB showing links between routers
   - Routing Table showing best paths to destinations

3. **Main View**: Network topology visualization
   - Drag routers to reposition them
   - Visual packet animations showing LSP transmission
   - Router highlighting when receiving packets

## Real-World Application

This simulator demonstrates core principles of routing protocols like OSPF (Open Shortest Path First):

1. **Neighbor Discovery**: Routers exchange Hello packets to establish adjacencies
2. **LSP Flooding**: Routers create and flood Link State Packets containing their adjacency information
3. **LSDB Synchronization**: Each router maintains an identical Link State Database
4. **Topology Changes**: When network topology changes, affected routers flood updated LSPs with incremented sequence numbers
5. **Path Calculation**: Using Dijkstra's algorithm, routers compute optimal paths to all destinations

## Running the Project

```
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

## Technologies Used

- React 
- GSAP for animations
- JavaScript for routing algorithms
