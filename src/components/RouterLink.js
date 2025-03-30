import React from 'react';

const RouterLink = ({ id, source, target, cost, onClick, isSelected }) => {
  if (!source || !target) return null;
  
  const sourceX = source.x + 40; // Center of router
  const sourceY = source.y + 40;
  const targetX = target.x + 40;
  const targetY = target.y + 40;
  
  // Calculate midpoint for the cost label
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;
  
  // Calculate offset for the cost label to avoid overlapping with the line
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const angle = Math.atan2(dy, dx);
  const offsetX = Math.sin(angle) * 15;
  const offsetY = -Math.cos(angle) * 15;
  
  const handleClick = (e) => {
    e.stopPropagation();
    if (onClick) onClick(id);
  };
  
  return (
    <div className="router-link-container">
      <svg 
        width="100%" 
        height="100%" 
        className="router-link-svg"
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      >
        <line
          x1={sourceX}
          y1={sourceY}
          x2={targetX}
          y2={targetY}
          stroke={isSelected ? "#ff4500" : "#666"}
          strokeWidth={isSelected ? 3 : 2}
          className="router-link-line"
          style={{ pointerEvents: 'auto', cursor: 'pointer' }}
          onClick={handleClick}
        />
      </svg>
      <div 
        className={`link-cost ${isSelected ? 'selected' : ''}`}
        style={{
          position: 'absolute',
          left: `${midX + offsetX - 15}px`,
          top: `${midY + offsetY - 15}px`,
          backgroundColor: isSelected ? "#fff3cd" : "#fff",
          border: isSelected ? "2px solid #ff4500" : "1px solid #ccc",
          zIndex: 5,
          padding: '2px 8px',
          borderRadius: '10px',
          fontSize: '12px',
          userSelect: 'none',
          cursor: 'pointer',
          pointerEvents: 'auto'
        }}
        onClick={handleClick}
      >
        {cost}
      </div>
    </div>
  );
};

export default RouterLink; 