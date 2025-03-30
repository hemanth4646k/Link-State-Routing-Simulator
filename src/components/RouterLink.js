import React from 'react';

const RouterLink = ({ source, target, cost }) => {
  if (!source || !target) return null;
  
  // Calculate the angle between the two routers
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  
  // Calculate the position of the cost label
  const midX = source.x + dx / 2;
  const midY = source.y + dy / 2;
  
  return (
    <>
      {/* Link line */}
      <div
        className="router-link"
        style={{
          left: `${source.x + 40}px`, // 40 is half the router width
          top: `${source.y + 40}px`, // 40 is half the router height
          width: `${length}px`,
          transform: `rotate(${angle}deg)`
        }}
      />
      
      {/* Cost label */}
      <div
        className="router-link-cost"
        style={{
          left: `${midX}px`,
          top: `${midY}px`,
          transform: 'translate(-50%, -50%)'
        }}
      >
        {cost}
      </div>
    </>
  );
};

export default RouterLink; 