import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';

// Drop marker component to show where a router will be placed
const DropMarker = ({ position }) => {
  const innerCircleRef = useRef();
  
  // Animation for the inner circle - soft pulsing effect
  useFrame((state) => {
    if (innerCircleRef.current) {
      // Gentle pulsing animation using sin wave
      const pulse = Math.sin(state.clock.getElapsedTime() * 3) * 0.2 + 0.8;
      innerCircleRef.current.scale.set(pulse, pulse, 1);
      
      // Also pulse the opacity for added effect
      innerCircleRef.current.material.opacity = pulse * 0.5;
    }
  });
  
  return (
    <group position={position}>
      {/* Semi-transparent outer ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.9, 1.1, 32]} />
        <meshBasicMaterial color="#3498db" transparent opacity={0.7} />
      </mesh>
      
      {/* Pulsing inner circle */}
      <mesh 
        ref={innerCircleRef} 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, 0.02, 0]}
      >
        <circleGeometry args={[0.5, 32]} />
        <meshBasicMaterial color="#2ecc71" transparent opacity={0.5} />
      </mesh>
      
      {/* Cross marker in the center */}
      <group position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        {/* Horizontal line */}
        <mesh>
          <boxGeometry args={[0.6, 0.08, 0.01]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
        </mesh>
        {/* Vertical line */}
        <mesh>
          <boxGeometry args={[0.08, 0.6, 0.01]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
        </mesh>
      </group>
    </group>
  );
};

export default DropMarker;
