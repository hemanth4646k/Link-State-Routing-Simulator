import React from 'react';

const RouterLink = ({ id, source, target, cost, onClick, isSelected, isPingHighlighted }) => {
  if (!source || !target) return null;
  
  // Calculate center points of source and target routers
  const sourceSize = window.innerWidth <= 600 ? 60 : 80; // Adjust for responsive router size
  const targetSize = window.innerWidth <= 600 ? 60 : 80;
  
  const sourceCenter = {
    x: source.x + sourceSize / 2,
    y: source.y + sourceSize / 2
  };
  
  const targetCenter = {
    x: target.x + targetSize / 2,
    y: target.y + targetSize / 2
  };
  
  // Calculate the angle for rotation
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  
  // Calculate the distance between centers
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Handle link click
  const handleClick = (e) => {
    e.stopPropagation();
    if (onClick) {
      onClick(id);
    }
  };
  
  // Handle touch events for mobile
  const handleTouch = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (onClick) {
      onClick(id);
    }
  };
  
  // Position for the cost label - midpoint of the link
  const labelPos = {
    x: sourceCenter.x + dx / 2 - 10,
    y: sourceCenter.y + dy / 2 - 10
  };
  
  return (
    <>
      <div
        className={`router-link ${isSelected ? 'selected' : ''} ${isPingHighlighted ? 'ping-highlighted' : ''}`}
        style={{
          left: `${sourceCenter.x}px`,
          top: `${sourceCenter.y}px`,
          width: `${distance}px`,
          transform: `rotate(${angle}deg)`,
        }}
        onClick={handleClick}
        onTouchEnd={handleTouch}
      />
      <div
        className={`router-link-cost ${isSelected ? 'selected' : ''} ${isPingHighlighted ? 'ping-highlighted' : ''}`}
        style={{
          left: `${labelPos.x}px`,
          top: `${labelPos.y}px`,
        }}
        onClick={handleClick}
        onTouchEnd={handleTouch}
      >
        {cost}
      </div>
    </>
  );
};

export default RouterLink; 