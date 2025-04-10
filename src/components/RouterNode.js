import React, { useRef, useEffect, useState } from 'react';

const RouterNode = ({ id, x, y, onDrag, onClick, isSelected, disabled, connectMode }) => {
  const nodeRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const [glowEffect, setGlowEffect] = useState(null); // null, 'accept', 'reject', or 'receive'
  
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
    if (nodeRef.current) {
      nodeRef.current.glow = glow;
    }
  }, []);
  
  const handleMouseDown = (e) => {
    // Prevent default to stop text selection
    e.preventDefault();
    
    if (disabled) return;
    
    // If in connect mode, just handle the click
    if (connectMode) {
      onClick(id);
      return;
    }
    
    // Otherwise, prepare for dragging
    setIsDragging(true);
    setHasMoved(false);
    
    // Store starting positions
    const startX = e.clientX;
    const startY = e.clientY;
    const routerX = x;
    const routerY = y;
    
    const handleMouseMove = (moveEvent) => {
      // Calculate distance moved
      const dx = Math.abs(moveEvent.clientX - startX);
      const dy = Math.abs(moveEvent.clientY - startY);
      
      // If moved more than 3px, consider it a drag
      if (dx > 3 || dy > 3) {
        setHasMoved(true);
      }
      
      // Calculate new position
      const newX = routerX + (moveEvent.clientX - startX);
      const newY = routerY + (moveEvent.clientY - startY);
      
      // Update position via callback
      onDrag(id, newX, newY);
    };
    
    const handleMouseUp = (upEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      // If not moved significantly, handle as a click
      if (!hasMoved) {
        onClick(id);
      }
      
      setIsDragging(false);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  // Touch event handler for mobile devices
  const handleTouchStart = (e) => {
    if (disabled) return;
    
    // If in connect mode, just handle the click/tap
    if (connectMode) {
      onClick(id);
      return;
    }
    
    // Prevent scrolling
    e.preventDefault();
    
    // Prepare for dragging
    setIsDragging(true);
    setHasMoved(false);
    
    // Store starting positions
    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;
    const routerX = x;
    const routerY = y;
    
    const handleTouchMove = (moveEvent) => {
      // Prevent scrolling
      moveEvent.preventDefault();
      
      const touch = moveEvent.touches[0];
      
      // Calculate distance moved
      const dx = Math.abs(touch.clientX - startX);
      const dy = Math.abs(touch.clientY - startY);
      
      // If moved more than 3px, consider it a drag
      if (dx > 3 || dy > 3) {
        setHasMoved(true);
      }
      
      // Calculate new position
      const newX = routerX + (touch.clientX - startX);
      const newY = routerY + (touch.clientY - startY);
      
      // Update position via callback
      onDrag(id, newX, newY);
    };
    
    const handleTouchEnd = (endEvent) => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      
      // If not moved significantly, handle as a tap
      if (!hasMoved) {
        onClick(id);
      }
      
      setIsDragging(false);
    };
    
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  };
  
  // Handle keyboard events for accessibility
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(id);
    }
  };
  
  // Generate CSS for the glow effect
  const getGlowStyles = () => {
    if (!glowEffect) return {};
    
    let color, shadowColor;
    
    switch (glowEffect) {
      case 'accept':
        color = '#2ecc71'; // Green for acceptance
        shadowColor = 'rgba(46, 204, 113, 0.8)';
        break;
      case 'reject':
        color = '#e74c3c'; // Red for rejection
        shadowColor = 'rgba(231, 76, 60, 0.8)';
        break;
      case 'receive':
        color = '#3498db'; // Blue for packet reception
        shadowColor = 'rgba(52, 152, 219, 0.8)';
        break;
      default:
        return {};
    }
    
    return {
      boxShadow: `0 0 15px 5px ${shadowColor}`,
      filter: `drop-shadow(0 0 5px ${color})`,
      transition: 'box-shadow 0.1s ease-in-out, filter 0.1s ease-in-out',
    };
  };
  
  return (
    <div
      ref={nodeRef}
      id={`router-${id}`}
      className={`router-node ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''} ${glowEffect ? `glow-${glowEffect}` : ''}`}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        cursor: connectMode ? 'pointer' : disabled ? 'not-allowed' : isDragging ? 'grabbing' : 'grab',
        ...getGlowStyles()
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onKeyDown={handleKeyDown}
      role="button"
      aria-label={`Router ${id}`}
      tabIndex={0}
    >
      {id}
    </div>
  );
};

export default RouterNode; 