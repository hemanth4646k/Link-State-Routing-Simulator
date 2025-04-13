import React, { useRef, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import Router3D from './Router3D';
import Link3D from './Link3D';
import Packet3D from './Packet3D';
import CameraController from './CameraController';
import DropMarker from './DropMarker';

// Main ThreeScene component
const ThreeScene = ({ 
  routers, 
  links, 
  packets, 
  onRouterClick, 
  onRouterDrag, 
  onLinkClick, 
  selectedRouters, 
  selectedElements,
  disabled, 
  connectMode,
  selectionMode,
  moveMode,
  simulationStatus,
  isDraggingRouter,
  dropIndicatorPos
}) => {
  // Reference to the canvas for position calculations
  const canvasRef = useRef(null);
  // Add state for drop marker
  const [showDropMarker, setShowDropMarker] = useState(false);
  const [dropMarkerPosition, setDropMarkerPosition] = useState([0, 0, 0]);
  
  // Track if simulation is running to enable controls during animation
  const isSimulationRunning = simulationStatus === 'running';
  
  // Convert 2D coordinates to 3D space for horizontal plane (x-z plane, y is up)
  const to3DCoordinates = (x, y) => {
    // Scale appropriately for the 3D scene
    const scale = 30;
    const offsetX = 500; 
    const offsetY = 500;
    
    return [(x - offsetX) / scale, 0, (y - offsetY) / scale];
  };

  // Convert 3D coordinates back to 2D for accurate positioning
  const to2DCoordinates = (x, y, z) => {
    const scale = 30;
    const offsetX = 500; 
    const offsetY = 500;
    
    return [x * scale + offsetX, z * scale + offsetY];
  };
  
  // Add handler for stage hover to show drop marker
  const handleCanvasPointerMove = (e) => {
    if (disabled || isSimulationRunning) return;
    
    // Get canvas bounds
    const canvasRect = canvasRef.current.getBoundingClientRect();
    
    // Calculate relative position within canvas
    const x = e.clientX - canvasRect.left;
    const y = e.clientY - canvasRect.top;
    
    // Update drop marker position
    const pos3D = to3DCoordinates(x, y);
    setDropMarkerPosition(pos3D);
    
    // Show the drop marker when not over a router
    setShowDropMarker(true);
  };
  
  // Add handler to hide marker when pointer leaves
  const handleCanvasPointerLeave = () => {
    setShowDropMarker(false);
  };
  
  // Set up event listeners for canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('pointermove', handleCanvasPointerMove);
      canvas.addEventListener('pointerleave', handleCanvasPointerLeave);
      
      return () => {
        canvas.removeEventListener('pointermove', handleCanvasPointerMove);
        canvas.removeEventListener('pointerleave', handleCanvasPointerLeave);
      };
    }
  }, [disabled, isSimulationRunning]);
  
  // Handle router click
  const handleRouterClick = (id) => {
    if (onRouterClick) {
      onRouterClick(id);
    }
  };
  
  // Handle router drag
  const handleRouterDrag = (id, x, y, z) => {
    if (onRouterDrag) {
      // Convert 3D coordinates back to 2D for the parent component
      const scale = 30;
      const offsetX = 500;
      const offsetY = 500;
      
      const x2D = x * scale + offsetX;
      // Use z for the 2D y-coordinate since we're in a horizontal plane simulation
      const y2D = z * scale + offsetY;
      
      onRouterDrag(id, x2D, y2D);
    }
  };
  
  // Handle link click
  const handleLinkClick = (id) => {
    if (onLinkClick) {
      onLinkClick(id);
    }
  };
  
  // Add a visual indicator for selection mode
  const cursorStyle = selectionMode 
    ? { cursor: 'pointer' } 
    : {};
  
  // Create animated links with proper thickness and styling
  const createLinks = () => {
    return links.map(link => {
      const source = routers.find(r => r.id === link.source);
      const target = routers.find(r => r.id === link.target);
      
      if (!source || !target) return null;
      
      // Convert router positions to 3D coordinates
      const sourcePos = to3DCoordinates(source.x, source.y);
      const targetPos = to3DCoordinates(target.x, target.y);
      
      return (
        <Link3D
          key={link.id}
          id={link.id}
          source={sourcePos}
          target={targetPos}
          cost={link.cost}
          isSelected={selectionMode && selectedElements.links.includes(link.id)}
          onClick={handleLinkClick}
        />
      );
    });
  };
  
  // Set CSS variable for the canvas cursor
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    
    if (selectionMode) {
      canvas.style.cursor = 'pointer';
    } else if (moveMode) {
      canvas.style.cursor = 'grab';
    } else if (connectMode) {
      canvas.style.cursor = 'crosshair';
    } else if (disabled && !isSimulationRunning) {
      canvas.style.cursor = 'default';
    } else {
      canvas.style.cursor = 'grab';
    }
  }, [selectionMode, moveMode, connectMode, disabled, isSimulationRunning]);
  
  return (
    <div 
      style={{ width: '100%', height: '100%', position: 'relative', ...cursorStyle }}
      ref={canvasRef}
    >
      <Canvas shadows>
        {/* Deep blue scene background */}
        <color attach="background" args={['#0a192f']} />
        
        {/* Scene lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[0, 10, 0]} 
          intensity={1} 
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <pointLight position={[10, 5, 10]} intensity={0.5} color="#4cc9f0" />
        
        {/* Camera controls - now enabled during simulation */}
        <CameraController 
          disabled={disabled} 
          selectionMode={selectionMode} 
          moveMode={moveMode}
          simulationRunning={isSimulationRunning}
        />
        
        {/* Grid for visual reference - no rotation for horizontal layout */}
        <gridHelper 
          args={[40, 40, '#304878', '#203050']} 
          position={[0, -0.01, 0]} // Slightly below the routers
        />
        
        {/* Render links first so they appear below routers */}
        {createLinks()}
        
        {/* Render routers */}
        {routers.map(router => (
          <Router3D
            key={router.id}
            id={router.id}
            position={to3DCoordinates(router.x, router.y)}
            isSelected={
              connectMode 
                ? selectedRouters.includes(router.id)
                : (selectionMode || moveMode) && selectedElements.routers.includes(router.id)
            }
            onClick={handleRouterClick}
            onDrag={handleRouterDrag}
            disabled={disabled && !isSimulationRunning && !selectionMode && !connectMode && !moveMode}
            connectMode={connectMode}
            selectionMode={selectionMode}
            moveMode={moveMode}
          />
        ))}
        
        {/* Render packets */}
        {packets.map(packet => (
          <Packet3D
            key={packet.id}
            id={packet.id}
            position={to3DCoordinates(packet.x, packet.y)}
            type={packet.type}
            data={packet.data}
          />
        ))}
        
        {/* Render drop marker only when dragging a router from toolbox */}
        {isDraggingRouter && dropIndicatorPos && (
          <DropMarker position={to3DCoordinates(dropIndicatorPos.x, dropIndicatorPos.y)} />
        )}
      </Canvas>
      
      {/* Selection mode indicator overlay */}
      {selectionMode && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          backgroundColor: 'rgba(233, 30, 99, 0.8)',
          color: 'white',
          padding: '10px',
          borderRadius: '5px',
          pointerEvents: 'none',
          zIndex: 100,
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
          fontWeight: 'bold'
        }}>
          Delete Mode: Click to Select
        </div>
      )}
      
      {/* Move mode indicator overlay */}
      {moveMode && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          backgroundColor: 'rgba(52, 152, 219, 0.8)',
          color: 'white',
          padding: '10px',
          borderRadius: '5px',
          pointerEvents: 'none',
          zIndex: 100,
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
          fontWeight: 'bold'
        }}>
          Move Mode: {selectedElements.routers.length > 0 ? 'Drag to Reposition' : 'Click to Select'}
        </div>
      )}
      
      {/* Connect mode indicator overlay */}
      {connectMode && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          backgroundColor: 'rgba(46, 204, 113, 0.8)',
          color: 'white',
          padding: '10px',
          borderRadius: '5px',
          pointerEvents: 'none',
          zIndex: 100,
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
          fontWeight: 'bold'
        }}>
          Connect Mode: {selectedRouters.length === 0 ? 'Select First Router' : 'Select Second Router'}
        </div>
      )}
    </div>
  );
};

export default ThreeScene; 