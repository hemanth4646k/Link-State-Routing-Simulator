import React, { useRef, useState, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

// Router component - represents a 3D router node
const Router3D = ({ id, position, isSelected, onClick, disabled, connectMode, onDrag, selectionMode, moveMode }) => {
  const meshRef = useRef();
  const groupRef = useRef();
  const [hovered, setHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [glowEffect, setGlowEffect] = useState(null); // 'accept', 'reject', 'receive', or 'ping-trail'
  const dragPointerId = useRef(null);
  
  // Function to make router glow with appropriate color
  const glow = (effect) => {
    // Set glow effect state based on the type of effect
    setGlowEffect(effect);
    
    // Clear glow effect after 200ms
    setTimeout(() => {
      setGlowEffect(null);
    }, 200);
  };
  
  // Expose the glow function via ref
  useEffect(() => {
    // Create a global reference to this router by ID for the animation effects
    window[`router3D_${id}`] = {
      glow: glow
    };
    
    // Cleanup function
    return () => {
      delete window[`router3D_${id}`];
    };
  }, [id]);
  
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
  
  // Update glow effect
  useEffect(() => {
    if (!meshRef.current) return;
    
    if (glowEffect) {
      // Create glow effect based on type
      switch(glowEffect) {
        case 'accept':
          // Green glow for acceptance
          meshRef.current.material.emissive.set('#2ecc71');
          meshRef.current.material.emissiveIntensity = 2.0;
          break;
        case 'reject':
          // Red glow for rejection
          meshRef.current.material.emissive.set('#e74c3c');
          meshRef.current.material.emissiveIntensity = 2.0;
          break;
        case 'receive':
          // Blue glow for packet reception
          meshRef.current.material.emissive.set('#3498db');
          meshRef.current.material.emissiveIntensity = 2.0;
          break;
        case 'ping-trail':
          // Yellow glow for ping trail
          meshRef.current.material.emissive.set('#ffcc00');
          meshRef.current.material.emissiveIntensity = 1.5;
          break;
        default:
          // Reset glow effect
          meshRef.current.material.emissive.set('#204060');
          meshRef.current.material.emissiveIntensity = 0.3;
      }
    } else {
      // Reset glow effect
      meshRef.current.material.emissive.set('#204060');
      meshRef.current.material.emissiveIntensity = 0.3;
    }
  }, [glowEffect]);
  
  // Get Three.js context
  const { camera, raycaster, mouse, gl } = useThree();
  
  // Variables for dragging
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const dragOffset = useRef(new THREE.Vector3());
  
  // Method to start dragging
  const startDragging = (e) => {
    // Only allow dragging in moveMode (and don't require preselection anymore)
    if (!moveMode) return;
    
    // Prevent event propagation
    e.stopPropagation();
    setIsDragging(true);
    
    // Set cursor style
    gl.domElement.style.cursor = 'grabbing';
    
    // Capture the pointer to ensure we get all events even when the mouse moves quickly
    if (e.pointerId) {
      dragPointerId.current = e.pointerId;
      gl.domElement.setPointerCapture(e.pointerId);
    }
    
    // Update mouse coordinates for raycaster
    raycaster.setFromCamera(mouse, camera);
    
    // Create a drag plane perpendicular to the camera direction
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    
    // Use a plane perpendicular to the camera view for more intuitive dragging
    dragPlane.current.normal.copy(cameraDirection);
    
    // Position the plane at the router's position
    const routerPosition = new THREE.Vector3(...position);
    dragPlane.current.constant = -routerPosition.dot(cameraDirection);
    
    // Find the intersection with the plane
    const intersection = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(dragPlane.current, intersection)) {
      // Calculate drag offset
      dragOffset.current.copy(intersection).sub(routerPosition);
    }
    
    // Add event listeners for drag and release
    gl.domElement.addEventListener('pointermove', handleDrag);
    gl.domElement.addEventListener('pointerup', stopDragging);
    gl.domElement.addEventListener('pointerleave', stopDragging);
    gl.domElement.addEventListener('pointercancel', stopDragging);
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
      
      // Update position via parent component with all coordinates
      onDrag(id, newPosition.x, newPosition.y, newPosition.z);
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
    gl.domElement.removeEventListener('pointerleave', stopDragging);
    gl.domElement.removeEventListener('pointercancel', stopDragging);
    
    // Release pointer capture using our stored pointerId
    if (dragPointerId.current !== null) {
      try {
        gl.domElement.releasePointerCapture(dragPointerId.current);
      } catch (err) {
        // Ignore errors if the pointer was already released
      }
      dragPointerId.current = null;
    }
  };
  
  // Handle all pointer interactions
  const handlePointerDown = (e) => {
    // If disabled and not in selection/connect/move mode, do nothing
    if (disabled && !selectionMode && !connectMode && !moveMode) return;
    
    // Important: stop propagation for all pointer events
    e.stopPropagation();
    
    // In connect mode, just register click
    if (connectMode) {
      onClick(id);
      return;
    }
    
    // In selection mode
    if (selectionMode) {
      // Just select the router (no dragging in selection/delete mode)
      onClick(id);
      return;
    }
    
    // In move mode
    if (moveMode) {
      // Always click to select first
      onClick(id);
      
      // Then start dragging immediately
      // Add a small timeout to ensure selection state is updated first
      setTimeout(() => {
        startDragging(e);
      }, 0);
      
      return;
    }
    
    // Regular click in normal mode
    onClick(id);
  };
  
  // Clean up event listeners when component unmounts or when dragging state changes
  useEffect(() => {
    return () => {
      if (isDragging) {
        gl.domElement.removeEventListener('pointermove', handleDrag);
        gl.domElement.removeEventListener('pointerup', stopDragging);
        gl.domElement.removeEventListener('pointerleave', stopDragging);
        gl.domElement.removeEventListener('pointercancel', stopDragging);
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

export default Router3D;
