import React from 'react';

const LSPPacket = ({ id, x, y, data, type }) => {
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
  
  return (
    <div
      id={id}
      className={`packet ${type}`}
      style={{
        position: 'absolute',
        left: `${x - 25}px`, // Center the 50px wide packet
        top: `${y - 25}px`,  // Center the 50px tall packet
      }}
    >
      {getDisplayText()}
    </div>
  );
};

export default LSPPacket; 