import React from 'react';

const LSPPacket = ({ id, x, y, data, type, size = 50 }) => {
  // Display for the packet based on type and data
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
  
  // Calculate half size for positioning
  const halfSize = size / 2;
  
  // Adjust font size based on packet size
  const fontSize = Math.max(10, Math.min(12, size * 0.25));
  
  return (
    <div
      id={id}
      className={`packet ${type}`}
      style={{
        position: 'absolute',
        left: `${x - halfSize}px`, // Center the packet
        top: `${y - halfSize}px`,  // Center the packet
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: `${halfSize}px`,
        fontSize: `${fontSize}px`
      }}
    >
      {getDisplayText()}
    </div>
  );
};

export default LSPPacket; 