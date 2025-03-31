import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// Router component - represents a 3D router node
const Router = ({ id, position, isSelected, onClick, disabled, connectMode, onDrag, selectionMode }) => {
  const meshRef = useRef();
  const groupRef = useRef();
  const [hovered, setHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Use a simple sphere for the router model
  useEffect(() => {
    if (meshRef.current) {
      if (isSelected) {
        meshRef.current.material.color.set('#e74c3c'); // Red color for selected
      } else if (hovered) {
        meshRef.current.material.color.set('#2ecc71'); // Green color for hover
      } else {
        meshRef.current.material.color.set('#3498db'); // Default blue color
      }
    }
  }, [isSelected, hovered]);
  
  // Get Three.js context
  const { camera, raycaster, mouse, gl } = useThree();
  
  // Variables for dragging
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const dragOffset = useRef(new THREE.Vector3());
  
  // Method to start dragging
  const startDragging = (e) => {
    if (!isSelected || !selectionMode) return;
    
    // Prevent event propagation
    e.stopPropagation();
    setIsDragging(true);
    
    // Update mouse coordinates for raycaster
    raycaster.setFromCamera(mouse, camera);
    
    // Create a drag plane at the router's height, aligned with the view
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    
    // If looking from directly above, use horizontal plane
    if (Math.abs(cameraDirection.y) > 0.9) {
      dragPlane.current.normal.set(0, 1, 0);
    } else {
      // Otherwise create a plane more aligned with the view
      dragPlane.current.normal.set(cameraDirection.x, 0, cameraDirection.z).normalize();
    }
    
    // Set the plane to pass through the router
    dragPlane.current.constant = -position[1];
    
    // Find the intersection with the plane
    const intersection = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(dragPlane.current, intersection)) {
      // Calculate offset between intersection and router position
      dragOffset.current.copy(intersection).sub(new THREE.Vector3(...position));
      
      // Set up UI and capture pointer
      gl.domElement.style.cursor = 'grabbing';
      gl.domElement.setPointerCapture(e.pointerId);
      
      // Add event listeners for movement and release
      gl.domElement.addEventListener('pointermove', handleDrag);
      gl.domElement.addEventListener('pointerup', stopDragging);
    }
  };
  
  // Method to handle dragging movement
  const handleDrag = (e) => {
    if (!isDragging) return;
    
    // Update the raycaster with current mouse position
    raycaster.setFromCamera(mouse, camera);
    
    // Find the new intersection with the drag plane
    const intersection = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(dragPlane.current, intersection)) {
      // Calculate new position by subtracting the offset
      const newPosition = new THREE.Vector3().copy(intersection).sub(dragOffset.current);
      
      // Keep the y-coordinate consistent
      newPosition.y = position[1];
      
      // Update position via parent component
      onDrag(id, newPosition.x, newPosition.z);
    }
  };
  
  // Method to stop dragging
  const stopDragging = (e) => {
    if (!isDragging) return;
    
    setIsDragging(false);
    gl.domElement.style.cursor = 'grab';
    
    // Remove event listeners
    gl.domElement.removeEventListener('pointermove', handleDrag);
    gl.domElement.removeEventListener('pointerup', stopDragging);
    
    // Release pointer capture
    if (e.pointerId) {
      gl.domElement.releasePointerCapture(e.pointerId);
    }
  };
  
  // Handle all pointer interactions
  const handlePointerDown = (e) => {
    // If disabled and not in selection mode, do nothing
    if (disabled && !selectionMode) return;
    
    // In connect mode, just register click
    if (connectMode) {
      onClick(id);
      return;
    }
    
    // In selection mode
    if (selectionMode) {
      // If already selected, start dragging
      if (isSelected) {
        startDragging(e);
      } else {
        // Otherwise, select this router
        onClick(id);
      }
    } else {
      // Regular click in normal mode
      onClick(id);
    }
  };
  
  // Clean up event listeners when component unmounts
  useEffect(() => {
    return () => {
      if (isDragging) {
        gl.domElement.removeEventListener('pointermove', handleDrag);
        gl.domElement.removeEventListener('pointerup', stopDragging);
      }
    };
  }, [isDragging]);
  
  return (
    <group 
      ref={groupRef}
      position={position}
      onPointerOver={() => !disabled && setHovered(true)}
      onPointerOut={() => !disabled && setHovered(false)}
      onPointerDown={handlePointerDown}
    >
      {/* 3D Sphere representing the router */}
      <mesh 
        ref={meshRef} 
        castShadow 
        receiveShadow
      >
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial 
          color="#3498db" 
          roughness={0.3} 
          metalness={0.7}
          emissive="#204060"
          emissiveIntensity={0.3}
          transparent={true} 
          opacity={0.9} // Slightly transparent to see text better
        />
      </mesh>
      
      {/* HTML overlay for router ID - billboarded to always face camera */}
      <Html 
        position={[0, 0, 0]} 
        center 
        transform 
        sprite // This makes the HTML element always face the camera
        distanceFactor={8} // Scale with distance from camera
        zIndexRange={[100, 0]} // Ensure visibility 
        style={{
          pointerEvents: 'none' // Make sure click events pass through to the router
        }}
      >
        <div style={{
          backgroundColor: isSelected ? '#e74c3c' : 'rgba(0,0,0,0.6)',
          color: 'white',
          padding: '2px 8px',
          borderRadius: '16px',
          fontWeight: 'bold',
          fontSize: '16px',
          whiteSpace: 'nowrap',
          userSelect: 'none',
          textAlign: 'center',
          width: '30px',
          height: '30px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 8px rgba(0,0,0,0.8)',
          border: '2px solid rgba(255,255,255,0.7)'
        }}>
          {id}
        </div>
      </Html>
    </group>
  );
};

// Link component - represents a connection between routers
const Link = ({ source, target, cost, isSelected, onClick, id }) => {
  const linkRef = useRef();
  const [hovered, setHovered] = useState(false);
  
  // Calculate midpoint for the cost label
  const midpoint = [
    (source[0] + target[0]) / 2,
    (source[1] + target[1]) / 2 + 0.5, // Higher above the link for better visibility
    (source[2] + target[2]) / 2
  ];
  
  // Calculate line points and add slight elevation to make it more visible
  const points = [
    new THREE.Vector3(source[0], source[1] + 0.1, source[2]),
    new THREE.Vector3(target[0], target[1] + 0.1, target[2])
  ];
  
  // Create geometry from points
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
  
  // Update color based on selection and hover states
  useEffect(() => {
    if (linkRef.current) {
      if (isSelected) {
        linkRef.current.material.color.set('#e74c3c'); // Red for selected
        linkRef.current.material.linewidth = 3; // Thicker when selected
      } else if (hovered) {
        linkRef.current.material.color.set('#f39c12'); // Orange for hover
        linkRef.current.material.linewidth = 2.5; // Slightly thicker on hover
      } else {
        linkRef.current.material.color.set('#4cc9f0'); // Brighter blue for better visibility
        linkRef.current.material.linewidth = 2; // Default thickness
      }
    }
  }, [isSelected, hovered]);
  
  return (
    <group>
      {/* Link line */}
      <line 
        ref={linkRef}
        geometry={lineGeometry}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onPointerDown={(e) => {
          e.stopPropagation();
          onClick(id);
        }}
      >
        <lineBasicMaterial 
          color="#4cc9f0" 
          linewidth={2} 
          linecap="round" 
          linejoin="round"
        />
      </line>
      
      {/* Cost label as HTML - always face camera */}
      <Html position={midpoint} center transform sprite distanceFactor={8}>
        <div 
          style={{ 
            background: isSelected ? '#e74c3c' : '#fff',
            color: isSelected ? '#fff' : '#333',
            borderRadius: '50%',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            fontWeight: 'bold',
            boxShadow: '0 0 8px rgba(0,0,0,0.5)',
            userSelect: 'none',
            pointerEvents: 'none',
            border: '2px solid rgba(255,255,255,0.7)'
          }}
        >
          {cost}
        </div>
      </Html>
    </group>
  );
};

// Packet component - represents a data packet traveling between routers
const Packet = ({ id, position, type, data }) => {
  const meshRef = useRef();
  
  // Get display text
  const getDisplayText = () => {
    if (type === 'hello') {
      return 'Hello';
    }
    
    if (type === 'lsp' && Array.isArray(data) && data.length >= 1) {
      // Format as LSP-X where X is the router ID
      return `LSP-${data[0]}`;
    } else if (typeof data === 'string' && data.includes('LSP')) {
      // Try to extract router ID from strings like "LSPA: ["B","C"]"
      const match = data.match(/LSP([A-Z])/);
      if (match && match[1]) {
        return `LSP-${match[1]}`;
      }
    }
    
    return 'LSP';
  };
  
  // Set color based on packet type
  const packetColor = type === 'hello' ? '#f1c40f' : '#9b59b6';
  const displayText = getDisplayText();
  
  return (
    <group position={position}>
      {/* 3D sphere for the packet */}
      <mesh ref={meshRef} castShadow>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial 
          color={packetColor} 
          emissive={packetColor} 
          emissiveIntensity={0.5}
          roughness={0.3} 
          metalness={0.7}
          transparent={true}
          opacity={0.85} // Slightly transparent to see text
        />
      </mesh>
      
      {/* HTML overlay for packet label - always face camera */}
      <Html position={[0, 0, 0]} center transform sprite distanceFactor={10}>
        <div style={{
          backgroundColor: type === 'hello' ? 'rgba(241,196,15,0.8)' : 'rgba(155,89,182,0.8)',
          color: 'white',
          padding: '3px 8px',
          borderRadius: '12px', 
          fontSize: '12px',
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
          userSelect: 'none',
          pointerEvents: 'none',
          boxShadow: '0 0 8px rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.7)',
          textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
        }}>
          {displayText}
        </div>
      </Html>
    </group>
  );
};

// Camera controls component
const CameraController = ({ disabled, selectionMode, simulationRunning }) => {
  const { camera, gl } = useThree();
  const controls = useRef();
  
  useEffect(() => {
    // Set up camera for better view of the scene
    camera.position.set(0, 18, 18);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    
    return () => {
      if (controls.current) {
        controls.current.dispose();
      }
    };
  }, [camera]);
  
  // Update control state based on props
  useEffect(() => {
    if (!controls.current) return;
    
    // Allow controls during simulation regardless of disabled state
    // But respect selection mode
    const shouldEnableControls = simulationRunning || !disabled;
    controls.current.enabled = shouldEnableControls;
    
    // In selection mode, disable rotation/pan but allow zoom
    if (selectionMode) {
      controls.current.enableRotate = false;
      controls.current.enablePan = false;
      controls.current.enableZoom = true;
    } else {
      controls.current.enableRotate = shouldEnableControls;
      controls.current.enablePan = shouldEnableControls;
      controls.current.enableZoom = true;
    }
    
    // Configure zoom limits
    controls.current.minDistance = 2;
    controls.current.maxDistance = 100;
    controls.current.maxPolarAngle = Math.PI * 0.85;
    
    // Increase zoom speed for better usability
    controls.current.zoomSpeed = 1.5;
    
    // Damping and rotation speed adjustments
    controls.current.enableDamping = true;
    controls.current.dampingFactor = 0.1;
    controls.current.rotateSpeed = 0.8;
  }, [disabled, selectionMode, simulationRunning]);
  
  return (
    <OrbitControls
      ref={controls}
      args={[camera, gl.domElement]}
      enableRotate={(!disabled || simulationRunning) && !selectionMode}
      enablePan={(!disabled || simulationRunning) && !selectionMode}
      enableZoom={true}
      minDistance={2}
      maxDistance={100}
      minPolarAngle={0}
      maxPolarAngle={Math.PI * 0.85}
      zoomSpeed={1.5}
      dampingFactor={0.1}
      enableDamping={true}
      rotateSpeed={0.8}
    />
  );
};

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
  simulationStatus
}) => {
  // Track if simulation is running to enable controls during animation
  const simulationRunning = simulationStatus === 'running';
  
  // Reference to the canvas for position calculations
  const canvasRef = useRef(null);

  // Convert 2D coordinates to 3D space for horizontal plane (x-z plane, y is up)
  const to3DCoordinates = (x, y) => {
    // Scale appropriately for the 3D scene
    const scale = 30;
    const offsetX = 500; 
    const offsetY = 500;
    
    return [(x - offsetX) / scale, 0, (y - offsetY) / scale];
  };
  
  // Handle router click
  const handleRouterClick = (id) => {
    if (onRouterClick) {
      onRouterClick(id);
    }
  };
  
  // Handle router drag
  const handleRouterDrag = (id, x, z) => {
    if (onRouterDrag) {
      // Convert 3D coordinates back to 2D for the parent component
      const scale = 30;
      const offsetX = 500;
      const offsetY = 500;
      
      const x2D = x * scale + offsetX;
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
        <Link
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
    } else if (disabled && !simulationRunning) {
      canvas.style.cursor = 'default';
    } else {
      canvas.style.cursor = 'grab';
    }
  }, [selectionMode, disabled, simulationRunning]);
  
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
          simulationRunning={simulationRunning}
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
          <Router
            key={router.id}
            id={router.id}
            position={to3DCoordinates(router.x, router.y)}
            isSelected={
              connectMode 
                ? selectedRouters.includes(router.id)
                : selectionMode && selectedElements.routers.includes(router.id)
            }
            onClick={handleRouterClick}
            onDrag={handleRouterDrag}
            disabled={disabled && !simulationRunning}
            connectMode={connectMode}
            selectionMode={selectionMode}
          />
        ))}
        
        {/* Render packets */}
        {packets.map(packet => (
          <Packet
            key={packet.id}
            id={packet.id}
            position={to3DCoordinates(packet.x, packet.y)}
            type={packet.type}
            data={packet.data}
          />
        ))}
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
          Selection Mode: {selectedElements.routers.length > 0 ? 'Drag to Reposition' : 'Click to Select'}
        </div>
      )}
    </div>
  );
};

export default ThreeScene; 