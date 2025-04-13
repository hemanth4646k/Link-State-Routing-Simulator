import React, { useRef } from 'react';
import { Html } from '@react-three/drei';

// Packet component - represents a data packet traveling between routers
const Packet3D = ({ id, position, type, data }) => {
  const meshRef = useRef();
  
  // Get display text
  const getDisplayText = () => {
    if (type === 'hello') {
      return 'Hello';
    }
    
    if (type === 'lsp') {
      // For the new format: "LSP-A-2" - return it exactly as is
      if (typeof data === 'string' && data.match(/LSP-[A-Z]-\d+/)) {
        return data; // Return the exact string
      }
      // For old array format: [routerId, adjList]
      else if (Array.isArray(data) && data.length >= 1) {
        return `LSP-${data[0]}`; // Format as LSP-X without sequence
      }
      // For old string format: "LSPA: ["B","C"]"
      else if (typeof data === 'string' && data.includes('LSP')) {
        const match = data.match(/LSP([A-Z])/);
        if (match && match[1]) {
          return `LSP-${match[1]}`; // Format as LSP-X without sequence
        }
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

export default Packet3D;
