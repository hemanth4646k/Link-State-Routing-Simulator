import React, { useRef, useState, useEffect } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

// Link component - represents a connection between routers
const Link3D = ({ source, target, cost, isSelected, isPingHighlighted, onClick, id }) => {
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
  
  // Update color based on selection, hover, and ping highlight states
  useEffect(() => {
    if (linkRef.current) {
      if (isPingHighlighted) {
        linkRef.current.material.color.set('#00ff00'); // Bright green for ping path
        linkRef.current.material.linewidth = 3.5; // Extra thick for ping highlight
      } else if (isSelected) {
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
  }, [isSelected, hovered, isPingHighlighted]);
  
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
            background: isPingHighlighted ? '#00ff00' : isSelected ? '#e74c3c' : '#fff',
            color: (isPingHighlighted || isSelected) ? '#fff' : '#333',
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

export default Link3D;
