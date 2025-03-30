import React from 'react';

const LSPPacket = ({ id, x, y, data, type = 'lsp' }) => {
  // Extract the packet data for display
  let displayText = "LSP";
  let packetClass = "lsp-packet";
  
  if (type === 'hello') {
    displayText = "HELLO";
    packetClass = "hello-packet";
  } else if (data && typeof data === 'string') {
    // Try to extract the router ID from the data string
    // Expected format: "LSPX: ["A","D","E"]"
    const match = data.match(/LSP([A-Z]):/);
    if (match && match[1]) {
      displayText = `LSP-${match[1]}`;
    }
  }
  
  // Position the packet, accounting for its size (50px width and height)
  // so it's centered at the given coordinates
  return (
    <div
      id={id}
      className={packetClass}
      style={{
        position: 'absolute',
        left: `${x - 25}px`, // Center the 50px packet on x coordinate
        top: `${y - 25}px`,  // Center the 50px packet on y coordinate
        // No transforms - let GSAP handle all transforms during animation
      }}
    >
      {displayText}
    </div>
  );
};

export default LSPPacket; 