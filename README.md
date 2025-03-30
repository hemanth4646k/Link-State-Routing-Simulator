# Link State Routing Simulator

A visual simulator for link state routing protocols, using drag-and-drop routers and animated packet transmission.

## Features

- Drag and drop routers onto the simulation stage
- Connect routers with links and specify link costs
- Run animated simulations of the link state routing algorithm
- View Link State Database (LSDB) for each router
- View routing tables calculated from the LSDB using Dijkstra's algorithm
- Control simulation speed with a slider
- Pause, resume, and end simulations

## How to Use

1. **Add Routers**: Drag routers from the toolbox onto the simulation stage
2. **Connect Routers**: 
   - Click the "Connect Routers" button
   - Click on the first router you want to connect
   - Click on the second router
   - Enter the link cost in the modal that appears
3. **Run Simulation**:
   - Click "Start Simulation" to begin the link state routing process
   - Watch as LSP packets are transmitted between routers
   - The Link State Database for each router is updated as packets are received
4. **View Results**:
   - After the simulation completes, you can view either the LSDB or routing tables
   - Select a router from the dropdown to see its specific information
5. **Control Options**:
   - Adjust animation speed using the slider
   - Pause/Resume simulation as needed
   - End simulation to reset and start over

## Technical Details

This simulator demonstrates how link state routing protocols work:

1. Each router discovers its neighbors
2. Routers create Link State Packets (LSPs) containing their neighbor information
3. Routers flood these LSPs to their neighbors
4. Each router builds a complete map of the network topology
5. Routers compute the shortest paths using Dijkstra's algorithm

## Running the Project

```
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

## Technologies Used

- React 19
- GSAP for animations
- JavaScript for routing algorithms
