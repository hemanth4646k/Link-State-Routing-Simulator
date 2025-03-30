import React, { useState, useRef } from 'react';

const RouterNode = ({ id, x, y, onDrag, onClick, isSelected, disabled, connectMode }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [hasMovedDuringDrag, setHasMovedDuringDrag] = useState(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const nodeRef = useRef(null);
  
  const handleMouseDown = (e) => {
    e.preventDefault(); // Prevent text selection during drag
    if (disabled || connectMode) return; // Don't allow dragging in connect mode
    
    // Record initial position for dragging
    startPosRef.current = { 
      x: e.clientX - x, 
      y: e.clientY - y 
    };
    
    setIsDragging(true);
    setHasMovedDuringDrag(false);
    
    // Add event listeners for mouse movement and up
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    // Calculate new position
    const newX = Math.max(0, e.clientX - startPosRef.current.x);
    const newY = Math.max(0, e.clientY - startPosRef.current.y);
    
    // Only update if position has changed
    if (newX !== x || newY !== y) {
      setHasMovedDuringDrag(true);
      // Update position
      onDrag(id, newX, newY);
    }
  };
  
  const handleMouseUp = (e) => {
    if (isDragging) {
      // Only trigger click if we didn't drag significantly
      if (!hasMovedDuringDrag && onClick) {
        onClick(id);
      }
      
      setIsDragging(false);
      
      // Remove event listeners
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }
  };
  
  // Handle click for non-dragging mode (like connect mode)
  const handleClick = (e) => {
    if (connectMode && onClick) {
      onClick(id);
    }
  };
  
  // Determine the appropriate cursor based on the current mode
  const getCursor = () => {
    if (disabled) return 'not-allowed';
    if (connectMode) return 'pointer'; // Use pointer cursor for connecting
    return isDragging ? 'grabbing' : 'grab'; // Use grab cursors for dragging
  };
  
  return (
    <div 
      ref={nodeRef}
      className={`router-node ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
      style={{ 
        left: `${x}px`, 
        top: `${y}px`,
        cursor: getCursor()
      }}
      onMouseDown={handleMouseDown}
      onClick={connectMode ? handleClick : undefined}
    >
      Router {id}
    </div>
  );
};

export default RouterNode; 